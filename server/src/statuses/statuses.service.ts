import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { RealtimeService } from '../common/realtime/realtime.service';
import {
  Notification,
  Status,
  StatusComment,
  StatusReaction,
  User,
} from '../database/entities';
import {
  NotificationType,
  StatusMediaType,
  SubscriptionStatus,
} from '../database/enums';
import { CreateStatusCommentDto } from './dto/create-comment.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { ReactStatusDto } from './dto/react-status.dto';

@Injectable()
export class StatusesService {
  constructor(
    @InjectRepository(Status)
    private readonly statusRepo: Repository<Status>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(StatusComment)
    private readonly commentRepo: Repository<StatusComment>,
    @InjectRepository(StatusReaction)
    private readonly reactionRepo: Repository<StatusReaction>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  private hasActivePro(user: User): boolean {
    const subStatus = user.subscription?.status;
    return Boolean(
      user.isPro ||
        user.professionalProfile?.isPro ||
        subStatus === SubscriptionStatus.ACTIVE ||
        subStatus === SubscriptionStatus.TRIALING,
    );
  }

  private resolveAuthorMeta(user?: User | null) {
    const profile = user?.profile;
    const pro = user?.professionalProfile;
    const authorName =
      pro?.businessName ||
      profile?.displayName ||
      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
      'Profesional Yewi';
    return {
      authorName,
      authorAvatar: profile?.avatarUrl ?? null,
      businessName: pro?.businessName ?? null,
      isPro: Boolean(user?.isPro || pro?.isPro),
    };
  }

  async getFeed(userId: string, followedIds?: string[]) {
    const whereClause: any = {
      expiresAt: MoreThan(new Date()),
    };
    if (followedIds && followedIds.length > 0) {
      const ids = Array.from(new Set([userId, ...followedIds]));
      whereClause.authorId = In(ids);
    }

    const statuses = await this.statusRepo.find({
      where: whereClause,
      relations: {
        author: {
          profile: true,
          professionalProfile: true,
        },
        comments: {
          author: { profile: true },
        },
        reactions: true,
      },
      order: { createdAt: 'DESC' },
    });

    const groupedMap = new Map<
      string,
      {
        authorId: string;
        authorName: string;
        authorAvatar: string | null;
        businessName: string | null;
        isPro: boolean;
        category: string | null;
        hasUnseen: boolean;
        latestStatusCreatedAt: string;
        statuses: Array<Record<string, unknown>>;
      }
    >();

    for (const status of statuses) {
      const meta = this.resolveAuthorMeta(status.author);
      if (!groupedMap.has(status.authorId)) {
        groupedMap.set(status.authorId, {
          authorId: status.authorId,
          ...meta,
          category: null,
          hasUnseen: true,
          latestStatusCreatedAt:
            status.createdAt instanceof Date
              ? status.createdAt.toISOString()
              : String(status.createdAt),
          statuses: [],
        });
      }

      const myReaction = status.reactions?.find((r) => r.userId === userId);
      const likesCount = status.reactions?.length ?? 0;
      groupedMap.get(status.authorId)!.statuses.push({
        id: status.id,
        authorId: status.authorId,
        mediaUrl: status.mediaUrl,
        mediaType: status.mediaType,
        caption: status.caption,
        backgroundColor: status.backgroundColor,
        viewCount: status.viewCount,
        expiresAt: status.expiresAt,
        createdAt: status.createdAt,
        likesCount,
        reactionsCount: likesCount,
        commentsCount: status.comments?.length ?? 0,
        isLikedByMe: Boolean(myReaction),
        myReaction: myReaction?.reactionType ?? null,
        comments: (status.comments ?? []).map((c) => ({
          id: c.id,
          content: c.content,
          createdAt: c.createdAt,
          authorId: c.authorId,
          authorName:
            c.author?.profile?.displayName ||
            [c.author?.profile?.firstName, c.author?.profile?.lastName]
              .filter(Boolean)
              .join(' ') ||
            'Usuario Yewi',
          authorAvatar: c.author?.profile?.avatarUrl ?? null,
        })),
      });
    }

    return Array.from(groupedMap.values());
  }

  async createStatus(userId: string, dto: CreateStatusDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        profile: true,
        professionalProfile: true,
        subscription: true,
      },
    });

    if (!user || !this.hasActivePro(user)) {
      throw new ForbiddenException(
        'Publicar estados e historias requiere una suscripción Yewi Pro activa',
      );
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await this.statusRepo.save(
      this.statusRepo.create({
        authorId: userId,
        mediaUrl: dto.mediaUrl ?? null,
        mediaType: dto.mediaType ?? (dto.mediaUrl ? StatusMediaType.IMAGE : StatusMediaType.TEXT),
        caption: dto.caption?.trim() ?? null,
        backgroundColor: dto.backgroundColor ?? null,
        expiresAt,
      }),
    );

    if (this.realtimeService) {
      this.realtimeService.emitStatusCreated({
        status: created,
        authorGroup: {
          authorId: userId,
          ...this.resolveAuthorMeta(user),
        },
      });
    }

    return created;
  }

  async getStatusById(statusId: string, viewerId?: string) {
    const status = await this.statusRepo.findOne({
      where: { id: statusId },
      relations: {
        author: {
          profile: true,
          professionalProfile: true,
        },
        comments: {
          author: { profile: true },
        },
        reactions: true,
      },
    });

    if (!status) {
      throw new NotFoundException('Estado no encontrado');
    }

    if (viewerId && viewerId !== status.authorId) {
      await this.statusRepo.increment({ id: statusId }, 'viewCount', 1);
      status.viewCount += 1;
    }

    return {
      ...status,
      ...this.resolveAuthorMeta(status.author),
      reactionsCount: status.reactions?.length ?? 0,
      commentsCount: status.comments?.length ?? 0,
    };
  }

  async addComment(
    userId: string,
    statusId: string,
    dto: CreateStatusCommentDto,
  ) {
    const status = await this.statusRepo.findOne({ where: { id: statusId } });
    if (!status) {
      throw new NotFoundException('Estado no encontrado');
    }

    const saved = await this.commentRepo.save(
      this.commentRepo.create({
        statusId,
        authorId: userId,
        content: dto.content.trim(),
      }),
    );

    const hydrated = await this.commentRepo.findOne({
      where: { id: saved.id },
      relations: {
        author: {
          profile: true,
          professionalProfile: true,
        },
      },
    });

    const authorName =
      hydrated?.author?.profile?.displayName ||
      hydrated?.author?.professionalProfile?.businessName ||
      [
        hydrated?.author?.profile?.firstName,
        hydrated?.author?.profile?.lastName,
      ]
        .filter(Boolean)
        .join(' ') ||
      'Usuario Yewi';
    const authorAvatar = hydrated?.author?.profile?.avatarUrl ?? null;

    if (status.authorId && status.authorId !== userId) {
      const notif = await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: status.authorId,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Nuevo comentario en tu estado',
          message: `${authorName}: ${dto.content.trim().slice(0, 80)}`,
          link: '/search',
        }),
      );
      if (this.realtimeService) {
        this.realtimeService.emitNotification(notif);
      }
    }

    const payload = {
      id: saved.id,
      statusId,
      authorId: userId,
      content: saved.content,
      createdAt: saved.createdAt,
      authorName,
      authorAvatar,
    };

    if (this.realtimeService) {
      this.realtimeService.emitStatusComment({
        statusId,
        comment: payload,
      });
    }

    return payload;
  }

  async reactToStatus(
    userId: string,
    statusId: string,
    dto: ReactStatusDto,
  ) {
    const status = await this.statusRepo.findOne({ where: { id: statusId } });
    if (!status) {
      throw new NotFoundException('Estado no encontrado');
    }

    const reactionType = (dto.reactionType || 'LIKE').toUpperCase();
    const existing = await this.reactionRepo.findOne({
      where: { statusId, userId },
    });

    if (existing) {
      if (existing.reactionType === reactionType) {
        await this.reactionRepo.delete({ id: existing.id });
        const total = await this.reactionRepo.count({ where: { statusId } });
        if (this.realtimeService) {
          this.realtimeService.emitStatusReaction({
            statusId,
            userId,
            reactionType: null,
            likesCount: total,
          });
        }
        return { reacted: false, reactionType: null };
      }

      existing.reactionType = reactionType;
      await this.reactionRepo.save(existing);
      const total = await this.reactionRepo.count({ where: { statusId } });
      if (this.realtimeService) {
        this.realtimeService.emitStatusReaction({
          statusId,
          userId,
          reactionType,
          likesCount: total,
        });
      }
      return { reacted: true, reactionType };
    }

    await this.reactionRepo.save(
      this.reactionRepo.create({
        statusId,
        userId,
        reactionType,
      }),
    );

    if (status.authorId && status.authorId !== userId) {
      const notif = await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: status.authorId,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Reacción a tu estado',
          message: 'Alguien ha reaccionado a tu actualización.',
          link: '/search',
        }),
      );
      if (this.realtimeService) {
        this.realtimeService.emitNotification(notif);
      }
    }

    const total = await this.reactionRepo.count({ where: { statusId } });
    if (this.realtimeService) {
      this.realtimeService.emitStatusReaction({
        statusId,
        userId,
        reactionType,
        likesCount: total,
      });
    }

    return { reacted: true, reactionType };
  }

  async deleteStatus(userId: string, statusId: string) {
    const status = await this.statusRepo.findOne({ where: { id: statusId } });
    if (!status) {
      throw new NotFoundException('Estado no encontrado');
    }
    if (status.authorId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este estado');
    }
    await this.statusRepo.remove(status);
    return { success: true };
  }
}
