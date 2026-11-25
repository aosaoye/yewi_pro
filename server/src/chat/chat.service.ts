import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { v2 as cloudinary } from 'cloudinary';
import * as jwt from 'jsonwebtoken';
import { In, Not, Repository } from 'typeorm';
import { RealtimeService } from '../common/realtime/realtime.service';
import { AntiFraudUtils } from '../common/utils/anti-fraud.utils';
import {
  Conversation,
  Message,
  Notification,
  Order,
  ProfessionalProfile,
  ServiceRequest,
  User,
} from '../database/entities';
import {
  MessageType,
  NotificationType,
  SubscriptionStatus,
} from '../database/enums';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(ServiceRequest)
    private readonly requestRepo: Repository<ServiceRequest>,
    @InjectRepository(ProfessionalProfile)
    private readonly proRepo: Repository<ProfessionalProfile>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @Optional() private readonly realtimeService?: RealtimeService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  private resolveUserName(user?: User | null): string {
    if (!user) return 'Usuario Yewi';
    return (
      user.professionalProfile?.businessName ||
      user.profile?.displayName ||
      [user.profile?.firstName, user.profile?.lastName]
        .filter(Boolean)
        .join(' ') ||
      user.email?.split('@')[0] ||
      'Usuario Yewi'
    );
  }

  async getStreamToken(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        profile: true,
        professionalProfile: true,
        subscription: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const name = this.resolveUserName(user);
    const avatar = user.profile?.avatarUrl ?? undefined;
    const isPro = Boolean(
      user.isPro ||
        user.professionalProfile?.isPro ||
        user.subscription?.status === SubscriptionStatus.ACTIVE,
    );

    const apiKey =
      this.configService?.get<string>('STREAM_API_KEY') ||
      process.env.STREAM_API_KEY ||
      'yewi_dev_stream_key';
    const apiSecret =
      this.configService?.get<string>('STREAM_API_SECRET') ||
      process.env.STREAM_API_SECRET ||
      '';

    let token: string;
    if (apiKey !== 'yewi_dev_stream_key' && apiSecret) {
      token = jwt.sign({ user_id: user.id }, apiSecret, {
        algorithm: 'HS256',
        noTimestamp: true,
      });
      const serverToken = jwt.sign({ server: true }, apiSecret, {
        algorithm: 'HS256',
        noTimestamp: true,
      });
      try {
        await fetch(
          `https://chat.stream-io-api.com/users?api_key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'stream-auth-type': 'jwt',
              Authorization: serverToken,
            },
            body: JSON.stringify({
              users: {
                [user.id]: {
                  id: user.id,
                  name,
                  image: avatar,
                  role: isPro ? 'admin' : 'user',
                },
              },
            }),
          },
        );
      } catch {
        // Stream REST upsert es best-effort para mantener el token local funcional
      }
    } else {
      const fallbackSecret =
        this.configService?.get<string>('JWT_SECRET') ||
        process.env.JWT_SECRET ||
        'yewi_stream_fallback_secret';
      token = jwt.sign({ user_id: user.id }, fallbackSecret);
    }

    return {
      userId: user.id,
      token,
      apiKey,
      user: {
        id: user.id,
        name,
        image: avatar ?? null,
        isPro,
        roles: user.roles,
      },
    };
  }

  async getContacts(userId: string) {
    const conversations = await this.convRepo.find({
      where: [{ participantAId: userId }, { participantBId: userId }],
      order: { updatedAt: 'DESC' },
      take: 30,
    });

    const contactIds = new Set<string>();
    const convByPartner = new Map<string, string>();
    for (const c of conversations) {
      const partnerId =
        c.participantAId === userId ? c.participantBId : c.participantAId;
      if (partnerId && partnerId !== userId) {
        contactIds.add(partnerId);
        convByPartner.set(partnerId, c.id);
      }
    }

    const featuredPros = await this.proRepo.find({
      where: { userId: Not(userId) },
      relations: { user: { profile: true } },
      order: { isPro: 'DESC', avgRating: 'DESC' },
      take: 15,
    });
    for (const pro of featuredPros) {
      if (pro.userId) contactIds.add(pro.userId);
    }

    if (contactIds.size === 0) {
      return [];
    }

    const users = await this.userRepo.find({
      where: { id: In(Array.from(contactIds)), isActive: true },
      relations: {
        profile: true,
        professionalProfile: { categories: true },
      },
    });

    const enriched = await Promise.all(
      users.map(async (u) => {
        const convId = convByPartner.get(u.id) ?? null;
        const lastMsg = convId
          ? await this.messageRepo.findOne({
              where: { conversationId: convId },
              order: { createdAt: 'DESC' },
            })
          : null;
        return {
          id: u.id,
          email: u.email,
          roles: u.roles,
          isPro: Boolean(u.isPro || u.professionalProfile?.isPro),
          displayName: this.resolveUserName(u),
          name: this.resolveUserName(u),
          businessName: u.professionalProfile?.businessName ?? null,
          avatarUrl: u.profile?.avatarUrl ?? null,
          phone: u.profile?.phoneNumber ?? null,
          city: u.professionalProfile?.city ?? u.profile?.city ?? null,
          category: u.professionalProfile?.categories?.[0]?.name ?? null,
          rating: u.professionalProfile?.avgRating ?? 0,
          totalReviews: u.professionalProfile?.totalReviews ?? 0,
          conversationId: convId,
          lastMessage: lastMsg?.content ?? null,
          lastMessageAt: lastMsg?.createdAt ?? null,
          hasExistingConversation: Boolean(convId),
        };
      }),
    );

    return enriched;
  }

  async getMyConversations(userId: string) {
    const conversations = await this.convRepo.find({
      where: [{ participantAId: userId }, { participantBId: userId }],
      relations: {
        order: true,
        serviceRequest: true,
      },
      order: { lastMessageAt: 'DESC', updatedAt: 'DESC' },
    });

    const partnerIds = Array.from(
      new Set(
        conversations.map((c) =>
          c.participantAId === userId ? c.participantBId : c.participantAId,
        ),
      ),
    );

    const partners =
      partnerIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(partnerIds) },
            relations: {
              profile: true,
              professionalProfile: true,
              subscription: true,
            },
          })
        : [];
    const partnerMap = new Map(partners.map((u) => [u.id, u]));

    const results: Array<Record<string, unknown>> = [];
    for (const conv of conversations) {
      const partnerId =
        conv.participantAId === userId
          ? conv.participantBId
          : conv.participantAId;
      const partner = partnerMap.get(partnerId);
      const lastMessage = await this.messageRepo.findOne({
        where: { conversationId: conv.id },
        order: { createdAt: 'DESC' },
      });
      const unreadCount = await this.messageRepo.count({
        where: {
          conversationId: conv.id,
          senderId: Not(userId),
          isRead: false,
        },
      });
      const partnerPresence = partner
        ? this.realtimeService?.getUserPresence?.(partner.id)
        : undefined;
      const partnerIsPro = partner
        ? Boolean(
            partner.isPro ||
              partner.professionalProfile?.isPro ||
              partner.subscription?.status === SubscriptionStatus.ACTIVE ||
              partner.subscription?.status === SubscriptionStatus.TRIALING,
          )
        : false;

      results.push({
        ...conv,
        otherParticipant: partner
          ? {
              id: partner.id,
              name: this.resolveUserName(partner),
              avatarUrl: partner.profile?.avatarUrl ?? null,
              isPro: partnerIsPro,
              isOnline: Boolean(partnerPresence?.isOnline),
              lastSeenAt:
                partnerPresence?.lastSeenAt ??
                partner.updatedAt?.toISOString() ??
                null,
            }
          : null,
        lastMessage,
        unreadCount,
      });
    }

    return results;
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) return false;
    return conv.participantAId === userId || conv.participantBId === userId;
  }

  async getMessages(userId: string, conversationId: string) {
    const conv = await this.convRepo.findOne({
      where: [
        { id: conversationId },
        { orderId: conversationId },
        { serviceRequestId: conversationId },
      ],
      relations: {
        order: true,
        serviceRequest: { category: true },
      },
    });
    if (!conv) {
      throw new NotFoundException('Conversación no encontrada');
    }
    if (conv.participantAId !== userId && conv.participantBId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    await this.messageRepo.update(
      { conversationId: conv.id, senderId: Not(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    );

    const messages = await this.messageRepo.find({
      where: { conversationId: conv.id },
      relations: {
        sender: { profile: true },
      },
      order: { createdAt: 'ASC' },
    });

    const otherId =
      conv.participantAId === userId ? conv.participantBId : conv.participantAId;
    const otherUser = otherId
      ? await this.userRepo.findOne({
          where: { id: otherId },
          relations: {
            profile: true,
            professionalProfile: true,
            subscription: true,
          },
        })
      : null;

    const partnerIsPro = otherUser
      ? Boolean(
          otherUser.isPro ||
            otherUser.professionalProfile?.isPro ||
            otherUser.subscription?.status === SubscriptionStatus.ACTIVE ||
            otherUser.subscription?.status === SubscriptionStatus.TRIALING,
        )
      : false;
    const presence = otherUser
      ? this.realtimeService?.getUserPresence?.(otherUser.id)
      : undefined;
    const lastPartnerMsg = otherUser
      ? [...messages].reverse().find((m) => m.senderId === otherUser.id)
      : undefined;
    const lastSeenAt = otherUser
      ? presence?.lastSeenAt ??
        lastPartnerMsg?.createdAt?.toISOString() ??
        otherUser.updatedAt?.toISOString() ??
        null
      : null;

    return {
      conversationId: conv.id,
      orderId: conv.orderId ?? undefined,
      serviceRequestId: conv.serviceRequestId ?? undefined,
      otherParticipant: otherUser
        ? {
            id: otherUser.id,
            email: otherUser.email,
            displayName: this.resolveUserName(otherUser),
            avatarUrl: otherUser.profile?.avatarUrl ?? undefined,
            businessName: otherUser.professionalProfile?.businessName ?? undefined,
            isPro: partnerIsPro,
            isOnline: Boolean(presence?.isOnline),
            lastSeenAt,
            city: otherUser.professionalProfile?.city ?? otherUser.profile?.city ?? undefined,
            rating: otherUser.professionalProfile?.avgRating ?? 0,
            totalReviews: otherUser.professionalProfile?.totalReviews ?? 0,
            completedOrdersCount:
              otherUser.professionalProfile?.completedOrdersCount ?? 0,
          }
        : undefined,
      order: conv.order ?? undefined,
      serviceRequest: conv.serviceRequest ?? undefined,
      messages,
    };
  }

  async sendMessage(userId: string, dto: SendMessageDto) {
    let conversation: Conversation | null = await this.convRepo.findOne({
      where: { id: dto.conversationId },
    });

    if (!conversation && dto.conversationId.startsWith('new:')) {
      const targetUserId = dto.conversationId.slice(4);
      conversation = await this.convRepo.findOne({
        where: [
          { participantAId: userId, participantBId: targetUserId },
          { participantAId: targetUserId, participantBId: userId },
        ],
      });
      if (!conversation) {
        conversation = await this.convRepo.save(
          this.convRepo.create({
            participantAId: userId,
            participantBId: targetUserId,
          }),
        );
      }
    }

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (
      conversation.participantAId !== userId &&
      conversation.participantBId !== userId
    ) {
      throw new ForbiddenException(
        'No eres participante de esta conversación',
      );
    }

    const rawContent = dto.content.trim();
    if (AntiFraudUtils.containsExternalContactInfo(rawContent)) {
      throw new BadRequestException(
        'Por tu seguridad, no está permitido enviar correos electrónicos, redes sociales ni teléfonos en el chat.',
      );
    }

    const sanitizedContent = AntiFraudUtils.sanitizeText(rawContent);
    const message = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        senderId: userId,
        type: dto.type ?? MessageType.TEXT,
        content: sanitizedContent,
        attachments: dto.attachments ?? [],
        metadata: dto.metadata ?? null,
        isRead: false,
      }),
    );

    await this.convRepo.update(conversation.id, { lastMessageAt: new Date() });

    const recipientId =
      conversation.participantAId === userId
        ? conversation.participantBId
        : conversation.participantAId;

    if (recipientId && recipientId !== userId) {
      const notif = await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: recipientId,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Nuevo mensaje recibido',
          message: sanitizedContent.slice(0, 100),
          link: '/chat',
        }),
      );
      if (this.realtimeService) {
        this.realtimeService.emitNotification(notif);
      }
    }

    return message;
  }

  async toggleReaction(userId: string, messageId: string, emoji: string) {
    if (!emoji || !emoji.trim()) {
      throw new BadRequestException('El emoji de reacción es obligatorio');
    }

    const msg = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: { conversation: true },
    });
    if (!msg || !msg.conversation) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    if (
      msg.conversation.participantAId !== userId &&
      msg.conversation.participantBId !== userId
    ) {
      throw new ForbiddenException('No tienes permiso para reaccionar');
    }

    const metadata = (msg.metadata ?? {}) as Record<string, any>;
    const existingList: Array<{
      emoji: string;
      userId: string;
      userName: string;
    }> = Array.isArray(metadata.reactions) ? [...metadata.reactions] : [];

    const reactor = await this.userRepo.findOne({
      where: { id: userId },
      relations: { profile: true, professionalProfile: true },
    });
    const userName = this.resolveUserName(reactor);
    const key = emoji.trim();
    const matchIndex = existingList.findIndex(
      (r) => r.emoji === key && r.userId === userId,
    );

    if (matchIndex >= 0) {
      existingList.splice(matchIndex, 1);
    } else {
      existingList.push({ emoji: key, userId, userName });
    }

    msg.metadata = { ...metadata, reactions: existingList };
    await this.messageRepo.save(msg);

    return {
      messageId: msg.id,
      conversationId: msg.conversationId,
      reactions: existingList,
    };
  }

  async editMessage(userId: string, messageId: string, content: string) {
    const rawContent = (content ?? '').trim();
    if (!rawContent) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }
    if (AntiFraudUtils.containsExternalContactInfo(rawContent)) {
      throw new BadRequestException(
        'Por tu seguridad, no está permitido enviar correos electrónicos, redes sociales ni teléfonos en el chat.',
      );
    }

    const msg = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: { conversation: true },
    });
    if (!msg || !msg.conversation) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    if (msg.senderId !== userId) {
      throw new ForbiddenException('Solo puedes editar tus propios mensajes');
    }

    msg.content = AntiFraudUtils.sanitizeText(rawContent);
    msg.metadata = {
      ...(msg.metadata ?? {}),
      editedAt: new Date().toISOString(),
    };
    return this.messageRepo.save(msg);
  }

  async deleteMessages(userId: string, messageIds: string[]) {
    const ids = Array.isArray(messageIds)
      ? messageIds.filter((id) => typeof id === 'string' && id.trim())
      : [];
    if (ids.length === 0) {
      throw new BadRequestException('Debes seleccionar al menos un mensaje');
    }

    const messages = await this.messageRepo.find({
      where: { id: In(ids) },
    });
    const owned = messages.filter((m) => m.senderId === userId);
    if (owned.length === 0) {
      throw new ForbiddenException(
        'Solo puedes eliminar tus propios mensajes',
      );
    }

    await this.messageRepo.remove(owned);
    return { deletedIds: owned.map((m) => m.id) };
  }

  async uploadAttachment(
    userId: string,
    file: string,
    fileName?: string,
    mimeType?: string,
    size?: number,
  ) {
    if (!file || !file.trim()) {
      throw new BadRequestException('El archivo adjunto es obligatorio');
    }

    const cloudName =
      this.configService?.get<string>('CLOUDINARY_CLOUD_NAME') ||
      this.configService?.get<string>('CLOUDINARY_NAME');
    const apiKey = this.configService?.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService?.get<string>('CLOUDINARY_API_SECRET');

    let url = file;
    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      const res = await cloudinary.uploader.upload(file, {
        folder: `yewi/chat/${userId}`,
        resource_type: 'auto',
      });
      url = res.secure_url;
    }

    const mime = (mimeType || '').toLowerCase();
    const resolvedType = mime.includes('pdf')
      ? 'pdf'
      : mime.includes('sheet') || mime.includes('excel')
        ? 'excel'
        : mime.includes('word') || mime.includes('document')
          ? 'word'
          : mime.startsWith('image/')
            ? 'image'
            : 'file';

    return {
      url,
      name: fileName || 'archivo',
      fileName: fileName || 'archivo',
      mimeType: mimeType || 'application/octet-stream',
      type: resolvedType,
      size: size ?? 0,
    };
  }
}
