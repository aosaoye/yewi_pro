import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { normalizeSpanishPhone } from '../common/fiscal-id';
import { Order, Profile, User } from '../database/entities';
import { OrderStatus, SubscriptionStatus } from '../database/enums';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        profile: true,
        professionalProfile: {
          categories: true,
        },
        wallet: true,
        subscription: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const activeSub =
      user.subscription?.status === SubscriptionStatus.ACTIVE ||
      user.subscription?.status === SubscriptionStatus.TRIALING;

    const {
      passwordHash: _pw,
      refreshTokenHash: _rt,
      emailVerificationToken: _evt,
      passwordResetToken: _prt,
      ...safeUser
    } = user;

    return {
      ...safeUser,
      isPro: Boolean(user.isPro || user.professionalProfile?.isPro || activeSub),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    let formattedPhone = dto.phoneNumber;
    if (dto.phoneNumber !== undefined && dto.phoneNumber !== null) {
      const normalized = normalizeSpanishPhone(dto.phoneNumber);
      if (!normalized) {
        throw new BadRequestException(
          'El número de teléfono no tiene un formato válido',
        );
      }
      const existingPhone = await this.profileRepo.findOne({
        where: { phoneNumber: normalized, userId: Not(userId) },
      });
      if (existingPhone) {
        throw new ConflictException(
          'Este número de teléfono ya está asociado a otra cuenta',
        );
      }
      formattedPhone = normalized;
    }

    let profile = user.profile;
    if (!profile) {
      profile = this.profileRepo.create({
        userId,
        firstName: 'Usuario',
        lastName: 'Yewi',
        preferredLanguage: 'es',
      });
    }

    if (dto.displayName !== undefined) {
      profile.displayName = dto.displayName.trim();
    }
    if (dto.avatarUrl !== undefined) profile.avatarUrl = dto.avatarUrl;
    if (formattedPhone !== undefined) profile.phoneNumber = formattedPhone;
    if (dto.country !== undefined) profile.country = dto.country;
    if (dto.region !== undefined) profile.region = dto.region;
    if (dto.province !== undefined) profile.province = dto.province;
    if (dto.city !== undefined) profile.city = dto.city;
    if (dto.postalCode !== undefined) profile.postalCode = dto.postalCode;
    if (dto.address !== undefined) profile.address = dto.address;
    if (dto.bio !== undefined) profile.bio = dto.bio;

    const saved = await this.profileRepo.save(profile);
    return saved;
  }

  async deleteAccount(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { professionalProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const blockingStatuses = [
      OrderStatus.IN_PROGRESS,
      OrderStatus.DELIVERED,
      OrderStatus.REVISION_REQUESTED,
      OrderStatus.DISPUTED,
    ];

    const activeClientOrders = await this.orderRepo.count({
      where: { clientId: userId, status: In(blockingStatuses) },
    });

    const activeProOrders = user.professionalProfile
      ? await this.orderRepo.count({
          where: {
            professionalProfileId: user.professionalProfile.id,
            status: In(blockingStatuses),
          },
        })
      : 0;

    if (activeClientOrders > 0 || activeProOrders > 0) {
      throw new BadRequestException(
        'No puedes eliminar tu cuenta mientras existan pedidos activos o en disputa sin resolver.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const anonymizedEmail = `deleted_${userId}_${Date.now()}@deleted.yewi.local`;
      await manager.update(User, userId, {
        email: anonymizedEmail,
        isActive: false,
        isPro: false,
        refreshTokenHash: null,
        emailVerificationToken: null,
        passwordResetToken: null,
        deletedAt: new Date(),
      });

      await manager.update(
        Profile,
        { userId },
        {
          firstName: 'Usuario',
          lastName: 'Eliminado',
          displayName: 'Cuenta eliminada',
          avatarUrl: null,
          phoneNumber: null,
          phoneVerified: false,
          address: null,
          bio: null,
        },
      );
    });

    return {
      success: true,
      message: 'Cuenta y datos personales eliminados correctamente',
    };
  }
}
