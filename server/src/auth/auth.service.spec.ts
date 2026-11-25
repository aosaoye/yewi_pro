import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { vi } from 'vitest';
import { UserRole } from '../database/enums';
import { AuthService } from './auth.service';

describe('AuthService (TypeORM)', () => {
  const userRepo = {
    findOne: vi.fn(),
    update: vi.fn(),
  };
  const profileRepo = {
    findOne: vi.fn(),
    update: vi.fn(),
  };
  const proRepo = {
    findOne: vi.fn(),
  };
  const mockManager = {
    create: vi.fn((_entity, data) => ({ id: 'new-id', ...data })),
    save: vi.fn(async (_entity, entity) => ({ id: 'user-1', ...entity })),
  };
  const dataSource = {
    transaction: vi.fn(async (cb: (m: typeof mockManager) => Promise<unknown>) =>
      cb(mockManager),
    ),
  };
  const jwtService = {
    signAsync: vi.fn().mockResolvedValue('signed-jwt-token'),
    verifyAsync: vi.fn(),
  } as unknown as JwtService;
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test_jwt_secret_1234567890';
      if (key === 'JWT_REFRESH_SECRET') return 'test_refresh_secret_1234567890';
      if (key === 'JWT_EXPIRATION') return '15m';
      if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: AuthService;
  let validPasswordHash: string;

  beforeAll(async () => {
    validPasswordHash = await argon2.hash('Password123!#');
  }, 20000);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      dataSource as any,
      userRepo as any,
      profileRepo as any,
      proRepo as any,
      jwtService,
      configService,
    );
  });

  it('rejects duplicate email registration with ConflictException', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register({
        email: 'juan@ejemplo.com',
        password: 'Password123!#',
        firstName: 'Juan',
        lastName: 'Pérez',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('forbids direct registration with ADMIN role', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(
      service.register({
        email: 'admin-attempt@ejemplo.com',
        password: 'Password123!#',
        firstName: 'Admin',
        lastName: 'Fake',
        roles: [UserRole.ADMIN],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects invalid Spanish NIF/NIE/CIF during registration', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(
      service.register({
        email: 'pro@ejemplo.com',
        password: 'Password123!#',
        firstName: 'Carlos',
        lastName: 'Ruiz',
        roles: [UserRole.PROFESSIONAL],
        taxId: '12345678A',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('verifies argon2 password on login and omits passwordHash', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'laura@ejemplo.com',
      passwordHash: validPasswordHash,
      roles: [UserRole.CLIENT],
      isActive: true,
      isPro: false,
      refreshTokenHash: null,
    });

    const result = await service.login({
      email: 'laura@ejemplo.com',
      password: 'Password123!#',
    });

    expect(result.accessToken).toBe('signed-jwt-token');
    expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
    expect(userRepo.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ refreshTokenHash: expect.any(String) }),
    );
  }, 20000);

  it('throws UnauthorizedException for wrong password', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'laura@ejemplo.com',
      passwordHash: validPasswordHash,
      roles: [UserRole.CLIENT],
      isActive: true,
    });

    await expect(
      service.login({
        email: 'laura@ejemplo.com',
        password: 'WrongPassword!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  }, 20000);

  it('checks email, phone, and Spanish fiscal ID availability', async () => {
    userRepo.findOne.mockResolvedValue(null);
    profileRepo.findOne.mockResolvedValue(null);
    proRepo.findOne.mockResolvedValue(null);

    const res = await service.checkAvailability({
      email: 'nuevo@ejemplo.com',
      phoneNumber: '611223344',
      taxId: '12345678Z',
    });

    expect(res.email?.available).toBe(true);
    expect(res.phoneNumber?.available).toBe(true);
    expect(res.phoneNumber?.formatted).toBe('+34611223344');
    expect(res.taxId?.available).toBe(true);
  });
});
