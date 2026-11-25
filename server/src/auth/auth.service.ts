import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createPublicKey, randomInt, randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { networkInterfaces } from 'os';
import { DataSource, Repository } from 'typeorm';
import { RedisCacheService } from '../common/cache/redis.service';
import {
  isValidSpanishFiscalId,
  normalizeFiscalId,
  normalizeSpanishPhone,
} from '../common/fiscal-id';
import {
  ProfessionalProfile,
  Profile,
  User,
  Wallet,
} from '../database/entities';
import { KycStatus, UserRole } from '../database/enums';
import {
  CheckAvailabilityDto,
  CheckAvailabilityResult,
} from './dto/check-availability.dto';
import {
  ClerkWatchOAuthDto,
  GoogleAuthDto,
} from './dto/google-auth.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { SendPhoneOtpDto, VerifyPhoneOtpDto } from './dto/phone-auth.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

interface ExternalTokenClaims {
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  azp?: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly inMemoryOtpStore = new Map<
    string,
    { code: string; expiresAt: number }
  >();
  private readonly jwksCache = new Map<
    string,
    { jwk: Record<string, unknown>; expiresAt: number }
  >();
  private readonly whitelistedRedirectUrls = new Set<string>();
  private latestAppRedirectUrl = 'exp://192.168.1.14:8081/--/sso-callback';
  private latestOAuthNonce: { nonce: string; receivedAt: number } | null =
    null;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(ProfessionalProfile)
    private readonly proRepo: Repository<ProfessionalProfile>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  onModuleInit() {
    const clerkSecretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!clerkSecretKey) return;

    const port = this.configService.get<number>('port') ?? 3000;
    const rawPrefix =
      this.configService.get<string>('apiPrefix') || 'api/v1';
    const apiPrefix = rawPrefix.replace(/^\/+|\/+$/g, '');

    const hosts = new Set<string>(['localhost', '127.0.0.1', '10.0.2.2']);
    try {
      const ifaces = networkInterfaces();
      for (const list of Object.values(ifaces)) {
        for (const info of list || []) {
          if (info.family === 'IPv4' && !info.internal && info.address) {
            hosts.add(info.address);
          }
        }
      }
    } catch {
      // noop
    }

    const startupUrls = new Set<string>([
      'yewi://sso-callback',
      'yewi:///sso-callback',
    ]);
    for (const host of hosts) {
      startupUrls.add(`exp://${host}:8081/--/sso-callback`);
      startupUrls.add(
        `http://${host}:${port}/${apiPrefix}/auth/clerk/oauth-callback`,
      );
    }

    void Promise.allSettled(
      Array.from(startupUrls).map((u) => this.registerClerkRedirectUrl(u)),
    );
  }

  private normalizePhone(phone: string, country?: string): string | null {
    const cleaned = phone.trim().replace(/[\s().-]/g, '');
    if (!cleaned) return null;

    if (!cleaned.startsWith('+') && !cleaned.startsWith('00')) {
      const normalizedCountry = (country || '').toLowerCase();
      if (normalizedCountry.includes('francia') || normalizedCountry === 'fr') {
        const digits = cleaned.replace(/^0/, '');
        return /^\d{9}$/.test(digits) ? `+33${digits}` : null;
      }
      if (
        normalizedCountry.includes('reino') ||
        normalizedCountry === 'uk' ||
        normalizedCountry === 'gb'
      ) {
        const digits = cleaned.replace(/^0/, '');
        return /^\d{10}$/.test(digits) ? `+44${digits}` : null;
      }
    }

    return normalizeSpanishPhone(cleaned);
  }

  private sanitizeUser(user: User) {
    const {
      passwordHash: _pw,
      refreshTokenHash: _rt,
      emailVerificationToken: _evt,
      passwordResetToken: _prt,
      ...safe
    } = user;
    return safe;
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessSecret = this.configService.get<string>('JWT_SECRET');
    const accessExpiration =
      this.configService.get<string>('JWT_EXPIRATION') || '15m';
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiration =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT_SECRET / JWT_REFRESH_SECRET no configurados');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiration as jwt.SignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiration as jwt.SignOptions['expiresIn'],
      }),
    ]);

    const refreshTokenHash = await argon2.hash(refreshToken);
    await this.userRepo.update(user.id, { refreshTokenHash });

    return { accessToken, refreshToken };
  }

  private async loadFullUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: {
        profile: true,
        professionalProfile: true,
        subscription: true,
        wallet: true,
      },
    });
  }

  async checkAvailability(
    dto: CheckAvailabilityDto,
  ): Promise<CheckAvailabilityResult> {
    const result: CheckAvailabilityResult = {};

    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      const existing = await this.userRepo.findOne({
        where: { email: normalizedEmail },
      });
      result.email = existing
        ? {
            available: false,
            message: 'Este correo electrónico ya está registrado',
          }
        : {
            available: true,
            message: 'Correo electrónico disponible',
          };
    }

    if (dto.phoneNumber) {
      const normalizedPhone = this.normalizePhone(dto.phoneNumber, dto.country);
      if (!normalizedPhone) {
        result.phoneNumber = {
          available: false,
          message:
            'El número de teléfono no tiene un formato internacional válido',
        };
      } else {
        const existingPhone = await this.profileRepo.findOne({
          where: { phoneNumber: normalizedPhone },
        });
        result.phoneNumber = existingPhone
          ? {
              available: false,
              message: 'Este número de teléfono ya está asociado a otra cuenta',
              formatted: normalizedPhone,
            }
          : {
              available: true,
              message: 'Teléfono disponible',
              formatted: normalizedPhone,
            };
      }
    }

    if (dto.taxId) {
      const normalizedTax = normalizeFiscalId(dto.taxId);
      if (!isValidSpanishFiscalId(normalizedTax)) {
        result.taxId = {
          available: false,
          message: 'El NIF, NIE o CIF introducido no es válido en España',
          formatted: normalizedTax,
        };
      } else {
        const existingTax = await this.proRepo.findOne({
          where: { taxId: normalizedTax },
        });
        result.taxId = existingTax
          ? {
              available: false,
              message: 'Este NIF/NIE/CIF ya está registrado por otro profesional',
              formatted: normalizedTax,
            }
          : {
              available: true,
              message: 'Identificación fiscal válida y disponible',
              formatted: normalizedTax,
            };
      }
    }

    return result;
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(
        'El correo electrónico ya se encuentra registrado',
      );
    }

    let formattedPhone: string | null = null;
    if (dto.phoneNumber) {
      formattedPhone = this.normalizePhone(dto.phoneNumber, dto.country);
      if (!formattedPhone) {
        throw new BadRequestException(
          'El número de teléfono debe incluir un prefijo válido (ej. +34600112233)',
        );
      }
      const phoneTaken = await this.profileRepo.findOne({
        where: { phoneNumber: formattedPhone },
      });
      if (phoneTaken) {
        throw new ConflictException('El número de teléfono ya está en uso');
      }
    }

    const requestedRoles =
      dto.roles && dto.roles.length > 0 ? dto.roles : [UserRole.CLIENT];
    if (requestedRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException(
        'No está permitido registrarse directamente como administrador',
      );
    }
    const isProfessional = requestedRoles.includes(UserRole.PROFESSIONAL);
    const finalRoles = Array.from(
      new Set([UserRole.CLIENT, ...requestedRoles]),
    );

    let normalizedTaxId: string | null = null;
    if (dto.taxId) {
      normalizedTaxId = normalizeFiscalId(dto.taxId);
      if (!isValidSpanishFiscalId(normalizedTaxId)) {
        throw new BadRequestException(
          'El NIF, NIE o CIF español proporcionado no es válido',
        );
      }
      const taxTaken = await this.proRepo.findOne({
        where: { taxId: normalizedTaxId },
      });
      if (taxTaken) {
        throw new ConflictException(
          'Este NIF/NIE/CIF ya está registrado en la plataforma',
        );
      }
    }

    const passwordHash = await argon2.hash(dto.password);

    const createdUserId = await this.dataSource.transaction(async (manager) => {
      const userEntity = manager.create(User, {
        email,
        passwordHash,
        roles: finalRoles,
        isActive: true,
        isEmailVerified: false,
        isPro: false,
      });
      const savedUser = await manager.save(User, userEntity);

      const profileEntity = manager.create(Profile, {
        userId: savedUser.id,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        displayName: `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
        phoneNumber: formattedPhone,
        phoneVerified: false,
        country: dto.country || 'España',
        city: dto.city || null,
        postalCode: dto.postalCode || null,
        address: dto.address || null,
        preferredLanguage: 'es',
      });
      await manager.save(Profile, profileEntity);

      const walletEntity = manager.create(Wallet, {
        userId: savedUser.id,
        creditBalance: isProfessional ? 10 : 0,
        fiatPendingBalance: 0,
        fiatAvailableBalance: 0,
        currency: 'EUR',
      });
      await manager.save(Wallet, walletEntity);

      if (isProfessional) {
        const proEntity = manager.create(ProfessionalProfile, {
          userId: savedUser.id,
          businessName:
            dto.businessName?.trim() ||
            `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
          taxId: normalizedTaxId,
          bio:
            dto.bio?.trim() ||
            'Profesional disponible en Yewi para encargos y presupuestos.',
          isPro: false,
          hourlyRate: dto.hourlyRate ?? null,
          serviceRadiusKm: dto.serviceRadiusKm ?? 50,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          country: dto.country || 'España',
          city: dto.city || null,
          postalCode: dto.postalCode || null,
          address: dto.address || null,
          kycStatus: KycStatus.UNVERIFIED,
          skills: dto.skills ?? [],
        });
        await manager.save(ProfessionalProfile, proEntity);
      }

      return savedUser.id;
    });

    const fullUser = await this.loadFullUser(createdUserId);
    if (!fullUser) {
      throw new BadRequestException('No se pudo cargar el usuario recién creado');
    }

    const tokens = await this.issueTokens(fullUser);
    return {
      user: this.sanitizeUser(fullUser),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email },
      relations: {
        profile: true,
        professionalProfile: true,
        subscription: true,
        wallet: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas o cuenta inactiva');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.issueTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async loginWithGoogleOAuthUser(oauthUser: {
    email?: string;
    name?: string;
    picture?: string;
  }) {
    if (!oauthUser?.email) {
      throw new UnauthorizedException(
        'Google no proporcionó una dirección de correo electrónico válida',
      );
    }

    return this.findOrCreateSocialUser({
      email: oauthUser.email.toLowerCase(),
      name: oauthUser.name,
      avatarUrl: oauthUser.picture,
      roles: [UserRole.CLIENT],
    });
  }

  private async verifyExternalIdToken(idToken: string): Promise<ExternalTokenClaims> {
    const googleClientIdsRaw =
      this.configService.get<string>('GOOGLE_CLIENT_IDS') ||
      this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      '';
    const googleClientIds = googleClientIdsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const clerkJwksUrl = this.configService.get<string>('CLERK_JWKS_URL');
    const clerkIssuer = this.configService.get<string>('CLERK_ISSUER');
    const clerkAuthorizedParty = this.configService.get<string>(
      'CLERK_AUTHORIZED_PARTY',
    );
    const clerkSecretKey = this.configService.get<string>('CLERK_SECRET_KEY');

    const decodedComplete = jwt.decode(idToken, { complete: true });
    if (!decodedComplete || typeof decodedComplete === 'string') {
      throw new UnauthorizedException('Token externo inválido o mal formado');
    }

    const header = decodedComplete.header;
    const unverifiedPayload = decodedComplete.payload as ExternalTokenClaims;
    const iss = unverifiedPayload.iss || '';

    // 1. Verificar token de Clerk vía JWKS o Backend API
    if (iss.includes('clerk') || clerkJwksUrl) {
      const sanitizedJwksUrl =
        clerkJwksUrl && !clerkJwksUrl.includes('clerk.yewi.com')
          ? clerkJwksUrl
          : '';
      const sanitizedIssuer =
        clerkIssuer && !clerkIssuer.includes('clerk.yewi.com')
          ? clerkIssuer
          : '';
      const jwksEndpoint =
        sanitizedJwksUrl ||
        (iss ? `${iss.replace(/\/$/, '')}/.well-known/jwks.json` : '');
      if (jwksEndpoint && header.kid) {
        const cacheKey = `${jwksEndpoint}:${header.kid}`;
        const cached = this.jwksCache.get(cacheKey);
        let matchingKey =
          cached && cached.expiresAt > Date.now() ? cached.jwk : undefined;

        if (!matchingKey) {
          let res: Response;
          try {
            res = await fetch(jwksEndpoint, {
              signal: AbortSignal.timeout(6000),
            });
          } catch {
            throw new UnauthorizedException(
              'Tiempo de espera agotado al contactar con Clerk JWKS',
            );
          }
          if (!res.ok) {
            throw new UnauthorizedException(
              'No se pudo obtener la clave pública JWKS de Clerk',
            );
          }
          const jwks = (await res.json()) as {
            keys?: Array<Record<string, unknown> & { kid?: string }>;
          };
          matchingKey = jwks.keys?.find((k) => k.kid === header.kid);
          if (!matchingKey) {
            throw new UnauthorizedException(
              'La firma JWKS del token de Clerk no coincide',
            );
          }
          this.jwksCache.set(cacheKey, {
            jwk: matchingKey,
            expiresAt: Date.now() + 10 * 60 * 1000,
          });
        }

        const publicKey = createPublicKey({
          key: matchingKey as import('crypto').JsonWebKey,
          format: 'jwk',
        });
        const verified = jwt.verify(idToken, publicKey, {
          algorithms: ['RS256'],
          issuer: sanitizedIssuer || undefined,
        }) as ExternalTokenClaims;

        if (
          clerkAuthorizedParty &&
          verified.azp &&
          verified.azp !== clerkAuthorizedParty
        ) {
          throw new UnauthorizedException(
            'Authorized party (azp) del token Clerk no autorizado',
          );
        }

        if (!verified.email && verified.sub && clerkSecretKey) {
          const clerkProfile = await this.fetchClerkUserProfile(verified.sub);
          if (clerkProfile) {
            if (clerkProfile.email) {
              verified.email = clerkProfile.email;
            }
            verified.given_name = clerkProfile.firstName;
            verified.family_name = clerkProfile.lastName;
            verified.picture = clerkProfile.imageUrl;
          }
        }

        if (!verified.email && !clerkSecretKey) {
          throw new UnauthorizedException(
            'Falta configurar CLERK_SECRET_KEY en el servidor (o incluir el claim email en la plantilla JWT de Clerk) para verificar tu correo.',
          );
        }

        return verified;
      }
    }

    // 2. Verificar Google ID Token mediante tokeninfo de Google
    let googleRes: Response;
    try {
      googleRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        { signal: AbortSignal.timeout(6000) },
      );
    } catch {
      throw new UnauthorizedException(
        'Tiempo de espera agotado al verificar el token con Google',
      );
    }
    if (!googleRes.ok) {
      throw new UnauthorizedException(
        'No se pudo verificar criptográficamente el ID token con Google',
      );
    }
    const claims = (await googleRes.json()) as ExternalTokenClaims;
    if (
      googleClientIds.length > 0 &&
      typeof claims.aud === 'string' &&
      !googleClientIds.includes(claims.aud)
    ) {
      throw new UnauthorizedException(
        'El ID token de Google no pertenece a un Client ID autorizado',
      );
    }
    return claims;
  }

  async loginWithGoogle(dto: GoogleAuthDto) {
    const claims = await this.verifyExternalIdToken(dto.idToken);
    if (!claims.email) {
      throw new UnauthorizedException(
        'El proveedor externo no incluyó un correo electrónico verificado',
      );
    }

    const fullName =
      dto.name ||
      claims.name ||
      [claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
      claims.email.split('@')[0];

    const roles =
      dto.roles && !dto.roles.includes(UserRole.ADMIN)
        ? dto.roles
        : [UserRole.CLIENT];

    return this.findOrCreateSocialUser({
      email: claims.email.toLowerCase(),
      name: fullName,
      avatarUrl: dto.avatarUrl || claims.picture,
      roles,
    });
  }

  private async findOrCreateSocialUser(params: {
    email: string;
    name?: string;
    avatarUrl?: string;
    roles: UserRole[];
  }) {
    let user = await this.userRepo.findOne({
      where: { email: params.email },
      relations: {
        profile: true,
        professionalProfile: true,
        subscription: true,
        wallet: true,
      },
    });

    if (!user) {
      const nameParts = (params.name || 'Usuario Yewi').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Usuario';
      const lastName = nameParts.slice(1).join(' ') || 'Yewi';
      const randomSecretHash = await argon2.hash(randomUUID());
      const finalRoles = Array.from(
        new Set([UserRole.CLIENT, ...params.roles.filter((r) => r !== UserRole.ADMIN)]),
      );

      const userId = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          User,
          manager.create(User, {
            email: params.email,
            passwordHash: randomSecretHash,
            roles: finalRoles,
            isActive: true,
            isEmailVerified: true,
            isPro: false,
          }),
        );

        await manager.save(
          Profile,
          manager.create(Profile, {
            userId: created.id,
            firstName,
            lastName,
            displayName: params.name || `${firstName} ${lastName}`.trim(),
            avatarUrl: params.avatarUrl || null,
            country: 'España',
            preferredLanguage: 'es',
          }),
        );

        await manager.save(
          Wallet,
          manager.create(Wallet, {
            userId: created.id,
            creditBalance: finalRoles.includes(UserRole.PROFESSIONAL) ? 10 : 0,
            fiatPendingBalance: 0,
            fiatAvailableBalance: 0,
            currency: 'EUR',
          }),
        );

        if (finalRoles.includes(UserRole.PROFESSIONAL)) {
          await manager.save(
            ProfessionalProfile,
            manager.create(ProfessionalProfile, {
              userId: created.id,
              businessName: params.name || `${firstName} ${lastName}`.trim(),
              bio: 'Profesional en Yewi',
              isPro: false,
              kycStatus: KycStatus.UNVERIFIED,
            }),
          );
        }

        return created.id;
      });

      user = await this.loadFullUser(userId);
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Cuenta desactivada o inaccesible');
    }

    const tokens = await this.issueTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async sendPhoneOtp(dto: SendPhoneOtpDto) {
    const formattedPhone = this.normalizePhone(dto.phoneNumber);
    if (!formattedPhone) {
      throw new BadRequestException(
        'El número de teléfono debe tener formato E.164 válido (ej. +34612345678)',
      );
    }

    const code = String(randomInt(100000, 999999));
    const cacheKey = `otp:${formattedPhone}`;

    if (this.redisCache) {
      await this.redisCache.set(cacheKey, { code }, 300);
    }
    this.inMemoryOtpStore.set(formattedPhone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const twilioFrom = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (twilioSid && twilioToken && twilioFrom) {
      try {
        const body = new URLSearchParams({
          To: formattedPhone,
          From: twilioFrom,
          Body: `Tu código de verificación de Yewi es: ${code}`,
        });
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          },
        );
      } catch (err) {
        this.logger.warn(
          `Error enviando SMS Twilio a ${formattedPhone}: ${(err as Error).message}`,
        );
      }
    }

    return {
      success: true,
      phoneNumber: formattedPhone,
      message: 'Código de verificación enviado correctamente',
      ...(nodeEnv !== 'production' ? { devCode: code } : {}),
    };
  }

  async verifyPhoneOtp(dto: VerifyPhoneOtpDto) {
    const formattedPhone = this.normalizePhone(dto.phoneNumber);
    if (!formattedPhone) {
      throw new BadRequestException('Número de teléfono inválido');
    }

    let expectedCode: string | null = null;
    if (this.redisCache) {
      const cached = await this.redisCache.get<{ code: string }>(
        `otp:${formattedPhone}`,
      );
      if (cached?.code) {
        expectedCode = cached.code;
      }
    }
    if (!expectedCode) {
      const entry = this.inMemoryOtpStore.get(formattedPhone);
      if (entry && entry.expiresAt > Date.now()) {
        expectedCode = entry.code;
      }
    }

    if (!expectedCode || expectedCode !== dto.code.trim()) {
      throw new UnauthorizedException('Código OTP inválido o expirado');
    }

    if (this.redisCache) {
      await this.redisCache.del(`otp:${formattedPhone}`);
    }
    this.inMemoryOtpStore.delete(formattedPhone);

    const existingProfile = await this.profileRepo.findOne({
      where: { phoneNumber: formattedPhone },
    });

    let userId = existingProfile?.userId;
    if (!userId) {
      const roles =
        dto.roles && !dto.roles.includes(UserRole.ADMIN)
          ? Array.from(new Set([UserRole.CLIENT, ...dto.roles]))
          : [UserRole.CLIENT];
      const syntheticEmail = `${formattedPhone.replace('+', 'tel')}@phone.yewi.local`;
      const passwordHash = await argon2.hash(randomUUID());

      userId = await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(
          User,
          manager.create(User, {
            email: syntheticEmail,
            passwordHash,
            roles,
            isActive: true,
            isEmailVerified: false,
            isPro: false,
          }),
        );
        const firstName = dto.firstName?.trim() || 'Usuario';
        const lastName = dto.lastName?.trim() || 'Yewi';
        await manager.save(
          Profile,
          manager.create(Profile, {
            userId: user.id,
            firstName,
            lastName,
            displayName: `${firstName} ${lastName}`.trim(),
            phoneNumber: formattedPhone,
            phoneVerified: true,
            country: 'España',
            preferredLanguage: 'es',
          }),
        );
        await manager.save(
          Wallet,
          manager.create(Wallet, {
            userId: user.id,
            creditBalance: roles.includes(UserRole.PROFESSIONAL) ? 10 : 0,
            fiatPendingBalance: 0,
            fiatAvailableBalance: 0,
            currency: 'EUR',
          }),
        );
        if (roles.includes(UserRole.PROFESSIONAL)) {
          await manager.save(
            ProfessionalProfile,
            manager.create(ProfessionalProfile, {
              userId: user.id,
              businessName: `${firstName} ${lastName}`.trim(),
              bio: 'Profesional verificado por teléfono en Yewi.',
              isPro: false,
              kycStatus: KycStatus.UNVERIFIED,
            }),
          );
        }
        return user.id;
      });
    } else if (existingProfile && !existingProfile.phoneVerified) {
      await this.profileRepo.update(existingProfile.id, { phoneVerified: true });
    }

    const user = await this.loadFullUser(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Cuenta de usuario no disponible');
    }

    const tokens = await this.issueTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET no configurado');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        { secret: refreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.loadFullUser(payload.sub);
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Sesión revocada o usuario inactivo');
    }

    const matches = await argon2.verify(user.refreshTokenHash, dto.refreshToken);
    if (!matches) {
      throw new UnauthorizedException('Refresh token reutilizado o inválido');
    }

    const tokens = await this.issueTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private async fetchClerkUserProfile(userId: string): Promise<{
    email?: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  } | null> {
    const clerkSecretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!clerkSecretKey || !userId) return null;

    try {
      const clerkUserRes = await fetch(
        `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`,
        {
          headers: { Authorization: `Bearer ${clerkSecretKey}` },
          signal: AbortSignal.timeout(6000),
        },
      );
      if (!clerkUserRes.ok) return null;

      const clerkUser = (await clerkUserRes.json()) as {
        primary_email_address_id?: string;
        email_addresses?: Array<{
          id?: string;
          email_address: string;
          verification?: { status?: string };
        }>;
        first_name?: string;
        last_name?: string;
        image_url?: string;
      };
      const primaryEmail =
        clerkUser.email_addresses?.find(
          (e) => e.id === clerkUser.primary_email_address_id,
        ) || clerkUser.email_addresses?.[0];

      const verifiedEmail =
        primaryEmail?.email_address &&
        (!primaryEmail.verification?.status ||
          primaryEmail.verification.status === 'verified')
          ? primaryEmail.email_address
          : undefined;

      return {
        email: verifiedEmail,
        firstName: clerkUser.first_name,
        lastName: clerkUser.last_name,
        imageUrl: clerkUser.image_url,
      };
    } catch (err) {
      this.logger.warn(
        `Error consultando usuario Clerk ${userId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private isAllowedClerkRedirectUrl(url: string): boolean {
    const hasAllowedScheme =
      url.startsWith('exp://') ||
      url.startsWith('yewi://') ||
      url.startsWith('http://') ||
      url.startsWith('https://');
    const hasAllowedPath =
      url.includes('sso-callback') || url.includes('oauth-callback');
    return Boolean(url && hasAllowedScheme && hasAllowedPath);
  }

  private async registerClerkRedirectUrl(url: string): Promise<boolean> {
    const clean = url.trim();
    if (!this.isAllowedClerkRedirectUrl(clean)) return false;
    if (this.whitelistedRedirectUrls.has(clean)) return true;

    const clerkSecretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!clerkSecretKey) return false;

    try {
      const res = await fetch('https://api.clerk.com/v1/redirect_urls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: clean }),
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok || res.status === 422) {
        this.whitelistedRedirectUrls.add(clean);
        return true;
      }

      this.logger.warn(
        `Clerk redirect_urls devolvió HTTP ${res.status} para ${clean}`,
      );
      return false;
    } catch (err) {
      this.logger.warn(
        `No se pudo registrar redirectUrl en Clerk (${clean}): ${(err as Error).message}`,
      );
      return false;
    }
  }

  async ensureClerkRedirectUrl(
    redirectUrl: string,
    appRedirectUrl?: string,
    bounceUrl?: string,
  ): Promise<{ registered: boolean; url: string; bounceUrl: string }> {
    const clean = redirectUrl.trim();
    if (!this.isAllowedClerkRedirectUrl(clean)) {
      throw new BadRequestException('URL de redirección OAuth no permitida');
    }

    const cleanAppRedirect = appRedirectUrl?.trim();
    if (cleanAppRedirect && this.isAllowedClerkRedirectUrl(cleanAppRedirect)) {
      this.latestAppRedirectUrl = cleanAppRedirect;
    }

    const cleanBounce = bounceUrl?.trim();
    const candidates = Array.from(
      new Set(
        [clean, cleanAppRedirect, cleanBounce].filter(
          (u): u is string => Boolean(u && this.isAllowedClerkRedirectUrl(u)),
        ),
      ),
    );

    const results = await Promise.all(
      candidates.map((u) => this.registerClerkRedirectUrl(u)),
    );
    const primaryRegistered = results[0] ?? false;

    return {
      registered: primaryRegistered,
      url: clean,
      bounceUrl: cleanBounce || clean,
    };
  }

  resolveClerkOAuthDeepLink(query: Record<string, unknown>): string {
    const params = new URLSearchParams();
    for (const [key, raw] of Object.entries(query)) {
      if (raw !== undefined && raw !== null && raw !== '') {
        params.append(key, Array.isArray(raw) ? String(raw[0]) : String(raw));
      }
    }

    const nonce = params.get('rotating_token_nonce');
    if (nonce) {
      this.latestOAuthNonce = { nonce, receivedAt: Date.now() };
    }

    const baseTarget = this.latestAppRedirectUrl || 'yewi://sso-callback';
    const qs = params.toString();
    return qs
      ? `${baseTarget}${baseTarget.includes('?') ? '&' : '?'}${qs}`
      : baseTarget;
  }

  buildClerkOAuthBounceHtml(
    query: Record<string, unknown>,
    userAgent = '',
  ): string {
    const deepLink = this.resolveClerkOAuthDeepLink(query);
    const isAndroid = /android/i.test(userAgent);
    const androidIntentLink =
      isAndroid && deepLink.startsWith('exp://')
        ? `intent://${deepLink.slice('exp://'.length)}#Intent;scheme=exp;package=host.exp.exponent;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`
        : deepLink;
    const primaryTarget = isAndroid ? androidIntentLink : deepLink;

    const escapeAttr = (val: string) =>
      val
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const escapedPrimary = escapeAttr(primaryTarget);
    const jsPrimary = JSON.stringify(primaryTarget);
    const jsFallback = JSON.stringify(deepLink);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Volviendo a Yewi...</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000000;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      text-align: center;
    }
    .card {
      max-width: 340px;
      width: 100%;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 8px;
    }
    p {
      font-size: 14px;
      color: #94a3b8;
      margin: 0 0 24px;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      background: #00b4d8;
      color: #062129;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 9999px;
    }
    .hint {
      font-size: 12px;
      color: #64748b;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Google verificado</h1>
    <p>Volviendo a Yewi...</p>
    <a class="btn" href="${escapedPrimary}">Volver a Yewi</a>
    <p class="hint">Si no abre solo, pulsa el botón o cierra (✕) arriba.</p>
  </div>
  <script>
    (function() {
      var primary = ${jsPrimary};
      var fallback = ${jsFallback};
      try { window.location.replace(primary); } catch (e) {}
      if (fallback !== primary) {
        setTimeout(function() {
          try { window.location.href = fallback; } catch (e) {}
        }, 350);
      }
    })();
  </script>
</body>
</html>`;
  }

  async watchClerkOAuthSession(dto: ClerkWatchOAuthDto): Promise<{
    completed: boolean;
    sessionId: string | null;
    rotatingTokenNonce: string | null;
    auth: Awaited<ReturnType<AuthService['findOrCreateSocialUser']>> | null;
  }> {
    const clerkSecretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!clerkSecretKey) {
      return {
        completed: false,
        sessionId: null,
        rotatingTokenNonce: null,
        auth: null,
      };
    }

    for (let attempt = 0; attempt < 22; attempt++) {
      try {
        const res = await fetch(
          `https://api.clerk.com/v1/clients/${encodeURIComponent(dto.clientId)}`,
          {
            headers: { Authorization: `Bearer ${clerkSecretKey}` },
            signal: AbortSignal.timeout(4000),
          },
        );

        if (res.ok) {
          const client = (await res.json()) as {
            sign_in_id?: string | null;
            sessions?: Array<{
              id: string;
              user_id: string;
              status: string;
              updated_at?: number;
            }>;
          };

          const cutoff = Date.now() - 45_000;
          const activeSession = client.sessions?.find(
            (s) =>
              s.status === 'active' &&
              (client.sign_in_id === null ||
                !dto.signInId ||
                client.sign_in_id !== dto.signInId ||
                (typeof s.updated_at === 'number' && s.updated_at >= cutoff)),
          );

          if (activeSession?.user_id) {
            const profile = await this.fetchClerkUserProfile(
              activeSession.user_id,
            );
            if (profile?.email) {
              const fullName =
                [profile.firstName, profile.lastName]
                  .filter(Boolean)
                  .join(' ') || profile.email.split('@')[0];
              const requestedRoles =
                dto.roles &&
                dto.roles.length > 0 &&
                !dto.roles.includes(UserRole.ADMIN)
                  ? dto.roles
                  : [UserRole.CLIENT];
              const auth = await this.findOrCreateSocialUser({
                email: profile.email.toLowerCase(),
                name: fullName,
                avatarUrl: profile.imageUrl,
                roles: requestedRoles,
              });
              return {
                completed: true,
                sessionId: activeSession.id,
                rotatingTokenNonce:
                  this.latestOAuthNonce &&
                  Date.now() - this.latestOAuthNonce.receivedAt <= 30_000
                    ? this.latestOAuthNonce.nonce
                    : null,
                auth,
              };
            }
          }

          if (
            this.latestOAuthNonce &&
            Date.now() - this.latestOAuthNonce.receivedAt <= 60_000
          ) {
            const nonce = this.latestOAuthNonce.nonce;
            this.latestOAuthNonce = null;
            return {
              completed: true,
              sessionId: null,
              rotatingTokenNonce: nonce,
              auth: null,
            };
          }
        }
      } catch {
        // Reintentar en la siguiente iteración
      }

      if (attempt < 21) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return {
      completed: false,
      sessionId: null,
      rotatingTokenNonce: null,
      auth: null,
    };
  }

  async logout(userId: string) {
    await this.userRepo.update(userId, { refreshTokenHash: null });
    return { success: true, message: 'Sesión cerrada correctamente' };
  }
}
