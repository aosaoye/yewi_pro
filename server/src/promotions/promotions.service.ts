import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ProfessionalProfile, Promotion } from '../database/entities';
import { CreatePromotionDto } from './dto/create-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
    @InjectRepository(ProfessionalProfile)
    private readonly proRepo: Repository<ProfessionalProfile>,
  ) {}

  async getActivePromotions(category?: string) {
    const qb = this.promotionRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.professionalProfile', 'pro')
      .leftJoinAndSelect('pro.user', 'user')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('promo.isActive = :isActive', { isActive: true })
      .andWhere('promo.expiresAt > :now', { now: new Date() });

    if (category && category.trim()) {
      qb.andWhere('promo.category ILIKE :category', {
        category: `%${category.trim()}%`,
      });
    }

    const rows = await qb.orderBy('promo.createdAt', 'DESC').getMany();
    return rows.map((p) => {
      const pro = p.professionalProfile;
      const prof = pro?.user?.profile;
      return {
        ...p,
        professional: pro
          ? {
              id: pro.id,
              userId: pro.userId,
              name:
                pro.businessName ||
                prof?.displayName ||
                [prof?.firstName, prof?.lastName].filter(Boolean).join(' ') ||
                'Profesional Yewi',
              avatarUrl: prof?.avatarUrl ?? null,
              city: pro.city ?? prof?.city ?? null,
              avgRating: pro.avgRating,
              totalReviews: pro.totalReviews,
              isPro: pro.isPro,
            }
          : undefined,
      };
    });
  }

  async createPromotion(userId: string, dto: CreatePromotionDto) {
    const pro = await this.proRepo.findOne({ where: { userId } });
    if (!pro) {
      throw new ForbiddenException(
        'Solo los profesionales pueden crear promociones',
      );
    }

    let expiresAt: Date;
    if (dto.isPermanent) {
      expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 5);
    } else if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw new BadRequestException(
          'La fecha de expiración de la promoción debe ser futura',
        );
      }
    } else {
      expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    }

    return this.promotionRepo.save(
      this.promotionRepo.create({
        professionalProfileId: pro.id,
        title: dto.title.trim(),
        description: dto.description.trim(),
        discountPercent: dto.discountPercent ?? null,
        discountAmount: dto.discountAmount ?? null,
        promoCode: dto.promoCode?.trim().toUpperCase() || null,
        category: dto.category?.trim() || null,
        badge: dto.badge?.trim() || null,
        expiresAt,
        isActive: true,
      }),
    );
  }

  async getMyPromotions(userId: string) {
    const pro = await this.proRepo.findOne({ where: { userId } });
    if (!pro) {
      throw new ForbiddenException('Perfil profesional no encontrado');
    }

    return this.promotionRepo.find({
      where: {
        professionalProfileId: pro.id,
        expiresAt: MoreThan(new Date(0)),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async deletePromotion(userId: string, promotionId: string) {
    const promo = await this.promotionRepo.findOne({
      where: { id: promotionId },
      relations: { professionalProfile: true },
    });
    if (!promo) {
      throw new NotFoundException('Promoción no encontrada');
    }
    if (promo.professionalProfile?.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para eliminar esta promoción',
      );
    }
    await this.promotionRepo.remove(promo);
    return { success: true };
  }
}
