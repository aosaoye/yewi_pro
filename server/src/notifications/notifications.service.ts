import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RealtimeService } from '../common/realtime/realtime.service';
import { Notification } from '../database/entities';
import { NotificationType } from '../database/enums';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const saved = await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link ?? null,
        metadata: params.metadata ?? null,
        isRead: false,
      }),
    );

    if (this.realtimeService) {
      this.realtimeService.emitNotification(saved);
    }
    return saved;
  }

  async getMyNotifications(userId: string) {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count, count };
  }

  async markAllAsRead(userId: string) {
    const res = await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return { success: true, count: res.affected ?? 0 };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }
    notification.isRead = true;
    return this.notificationRepo.save(notification);
  }

  async deleteNotification(userId: string, id: string) {
    const result = await this.notificationRepo.delete({ id, userId });
    return { success: true, count: result.affected ?? 0 };
  }

  async deleteNotifications(userId: string, ids?: string[]) {
    if (ids && ids.length > 0) {
      const result = await this.notificationRepo.delete({
        id: In(ids),
        userId,
      });
      return { success: true, count: result.affected ?? 0 };
    }
    const result = await this.notificationRepo.delete({ userId });
    return { success: true, count: result.affected ?? 0 };
  }
}
