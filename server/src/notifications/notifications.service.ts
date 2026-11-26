import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RealtimeService } from '../common/realtime/realtime.service';
import { Notification, User } from '../database/entities';
import { NotificationType } from '../database/enums';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @Optional() private readonly realtimeService?: RealtimeService,
    @Optional()
    @InjectRepository(User)
    private readonly userRepo?: Repository<User>,
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
    void this.sendExpoPushNotification(saved);
    return saved;
  }

  async registerPushToken(userId: string, token: string) {
    if (!this.userRepo) {
      return { success: false };
    }
    await this.userRepo.update({ id: userId }, { expoPushToken: token.trim() });
    return { success: true };
  }

  async unregisterPushToken(userId: string) {
    if (!this.userRepo) {
      return { success: false };
    }
    await this.userRepo.update({ id: userId }, { expoPushToken: null });
    return { success: true };
  }

  private async sendExpoPushNotification(notification: Notification) {
    if (!this.userRepo) return;
    try {
      const user = await this.userRepo.findOne({
        where: { id: notification.userId },
        select: { id: true, expoPushToken: true },
      });
      const token = user?.expoPushToken?.trim();
      if (!token || !token.startsWith('ExponentPushToken[')) return;

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title: notification.title,
          body: notification.message,
          channelId: 'default',
          data: {
            notificationId: notification.id,
            type: notification.type,
            link: notification.link,
            ...(notification.metadata ?? {}),
          },
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Expo Push API respondió ${response.status} para usuario ${notification.userId}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar push a usuario ${notification.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
