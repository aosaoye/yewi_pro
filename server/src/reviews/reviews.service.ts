import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RealtimeService } from '../common/realtime/realtime.service';
import {
  Gig,
  Notification,
  Order,
  ProfessionalProfile,
  Review,
  User,
} from '../database/entities';
import { NotificationType, OrderStatus } from '../database/enums';
import { CreateReviewDto, ReplyReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(ProfessionalProfile)
    private readonly proRepo: Repository<ProfessionalProfile>,
    @InjectRepository(Gig)
    private readonly gigRepo: Repository<Gig>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  private async recalculateStats(params: {
    professionalProfileId?: string | null;
    gigId?: string | null;
  }) {
    if (params.professionalProfileId) {
      const proReviews = await this.reviewRepo.find({
        where: { professionalProfileId: params.professionalProfileId },
      });
      const total = proReviews.length;
      const avg =
        total > 0
          ? Number(
              (
                proReviews.reduce((sum, r) => sum + r.rating, 0) / total
              ).toFixed(2),
            )
          : 0;
      await this.proRepo.update(params.professionalProfileId, {
        avgRating: avg,
        totalReviews: total,
      });
    }

    if (params.gigId) {
      const gigReviews = await this.reviewRepo.find({
        where: { gigId: params.gigId },
      });
      const total = gigReviews.length;
      const avg =
        total > 0
          ? Number(
              (
                gigReviews.reduce((sum, r) => sum + r.rating, 0) / total
              ).toFixed(2),
            )
          : 0;
      await this.gigRepo.update(params.gigId, {
        avgRating: avg,
        totalReviews: total,
      });
    }
  }

  async createReview(userId: string, dto: CreateReviewDto) {
    let professionalProfileId = dto.professionalProfileId ?? null;
    let targetUserId: string | null = null;
    let gigId: string | null = null;
    let orderId: string | null = null;

    if (dto.orderId) {
      const order = await this.orderRepo.findOne({
        where: { id: dto.orderId },
        relations: { professionalProfile: true },
      });
      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }
      if (order.clientId !== userId) {
        throw new ForbiddenException(
          'Solo el cliente del pedido puede valorarlo',
        );
      }
      if (order.status !== OrderStatus.COMPLETED) {
        throw new BadRequestException(
          'Solo puedes dejar una reseña en pedidos completados',
        );
      }

      const existing = await this.reviewRepo.findOne({
        where: { orderId: order.id },
      });
      if (existing) {
        throw new ConflictException('Este pedido ya tiene una reseña');
      }

      orderId = order.id;
      professionalProfileId = order.professionalProfileId;
      gigId = order.gigId;
      targetUserId = order.professionalProfile?.userId ?? null;
    } else if (professionalProfileId) {
      const pro = await this.proRepo.findOne({
        where: [
          { id: professionalProfileId },
          { userId: professionalProfileId },
        ],
      });
      if (!pro) {
        throw new NotFoundException('Perfil profesional no encontrado');
      }
      if (pro.userId === userId) {
        throw new BadRequestException(
          'No puedes dejarte una reseña a ti mismo',
        );
      }
      professionalProfileId = pro.id;
      targetUserId = pro.userId;
    } else {
      throw new BadRequestException(
        'Debes indicar orderId o professionalProfileId para valorar',
      );
    }

    if (!targetUserId) {
      throw new BadRequestException('No se pudo determinar el destinatario');
    }

    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        orderId,
        professionalProfileId,
        gigId,
        authorId: userId,
        targetUserId,
        rating: dto.rating,
        qualityRating: dto.qualityRating ?? dto.rating,
        communicationRating: dto.communicationRating ?? dto.rating,
        deliveryRating: dto.deliveryRating ?? dto.rating,
        comment: dto.comment.trim(),
      }),
    );

    await this.recalculateStats({ professionalProfileId, gigId });

    const notif = await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: targetUserId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Nueva valoración recibida',
        message: `Has recibido una reseña de ${dto.rating} estrellas.`,
        link: `/profile`,
      }),
    );
    if (this.realtimeService) {
      this.realtimeService.emitNotification(notif);
    }

    return review;
  }

  async replyToReview(userId: string, reviewId: string, dto: ReplyReviewDto) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Reseña no encontrada');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { profile: true },
    });
    const authorName =
      user?.profile?.displayName ||
      [user?.profile?.firstName, user?.profile?.lastName]
        .filter(Boolean)
        .join(' ') ||
      user?.email?.split('@')[0] ||
      'Usuario Yewi';

    const replyText = dto.reply.trim();
    const existingReplies = Array.isArray(review.replies) ? review.replies : [];
    review.replies = [
      ...existingReplies,
      {
        id: randomUUID(),
        authorId: userId,
        authorName,
        authorAvatar: user?.profile?.avatarUrl ?? null,
        comment: replyText,
        createdAt: new Date().toISOString(),
      },
    ];

    if (review.targetUserId === userId) {
      review.sellerReply = replyText;
      review.sellerRepliedAt = new Date();
    }

    return this.reviewRepo.save(review);
  }

  async getReviewsByTargetUser(targetUserId: string) {
    return this.reviewRepo.find({
      where: { targetUserId },
      relations: {
        author: { profile: true },
        gig: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getReviewsByProfessional(professionalId: string) {
    const pro = await this.proRepo.findOne({
      where: [{ id: professionalId }, { userId: professionalId }],
    });
    if (!pro) {
      return [];
    }
    return this.reviewRepo.find({
      where: { professionalProfileId: pro.id },
      relations: {
        author: { profile: true },
        gig: true,
      },
      order: { createdAt: 'DESC' },
    });
  }
}
