import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { DataSource, In, Repository } from 'typeorm';
import { RealtimeService } from '../common/realtime/realtime.service';
import {
  Conversation,
  Gig,
  GigExtra,
  GigPackage,
  LedgerTransaction,
  Notification,
  Order,
  OrderDelivery,
  OrderDispute,
  ProfessionalProfile,
  Wallet,
} from '../database/entities';
import {
  EscrowStatus,
  NotificationType,
  OrderStatus,
  OrderType,
  TransactionStatus,
  TransactionType,
} from '../database/enums';
import {
  CancelOrderDto,
  CreateGigOrderDto,
  OpenDisputeDto,
  RequestRevisionDto,
  SubmitDeliveryDto,
  SubmitRequirementsDto,
} from './dto/create-gig-order.dto';

@Injectable()
export class OrdersService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(GigPackage)
    private readonly packageRepo: Repository<GigPackage>,
    @InjectRepository(Gig)
    private readonly gigRepo: Repository<Gig>,
    @InjectRepository(GigExtra)
    private readonly extraRepo: Repository<GigExtra>,
    @InjectRepository(ProfessionalProfile)
    private readonly proRepo: Repository<ProfessionalProfile>,
    @InjectRepository(OrderDelivery)
    private readonly deliveryRepo: Repository<OrderDelivery>,
    @InjectRepository(OrderDispute)
    private readonly disputeRepo: Repository<OrderDispute>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey && stripeKey.trim() !== '') {
      this.stripe = new Stripe(stripeKey);
    }
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Pasarela de pagos Stripe no configurada en el servidor',
      );
    }
    return this.stripe;
  }

  async resolveGigPackageAndTotals(
    userId: string,
    dto: CreateGigOrderDto,
  ) {
    let gigPackage = await this.packageRepo.findOne({
      where: { id: dto.gigPackageId },
      relations: { gig: { professionalProfile: true } },
    });

    if (!gigPackage && dto.gigId) {
      gigPackage = await this.packageRepo.findOne({
        where: { gigId: dto.gigId },
        relations: { gig: { professionalProfile: true } },
      });
    }

    if (!gigPackage || !gigPackage.gig) {
      throw new NotFoundException('Paquete o servicio (Gig) no encontrado');
    }

    if (gigPackage.gig.professionalProfile?.userId === userId) {
      throw new BadRequestException('No puedes contratar tu propio servicio');
    }

    const extras =
      dto.extraIds && dto.extraIds.length > 0
        ? await this.extraRepo.find({
            where: { id: In(dto.extraIds), gigId: gigPackage.gigId },
          })
        : [];

    const extrasPrice = extras.reduce((sum, e) => sum + Number(e.price), 0);
    const extrasDays = extras.reduce(
      (sum, e) => sum + Number(e.additionalDeliveryDays || 0),
      0,
    );

    const subtotal = Number((Number(gigPackage.price) + extrasPrice).toFixed(2));
    const commissionRate =
      (this.configService.get<number>('business.platformCommission') ?? 15) /
      100;
    const platformFee = Number((subtotal * commissionRate).toFixed(2));
    const totalAmount = subtotal;
    const proEarnings = Number((subtotal - platformFee).toFixed(2));
    const deliveryDays = Math.max(1, gigPackage.deliveryDays + extrasDays);

    return {
      gigPackage,
      gig: gigPackage.gig,
      subtotal,
      platformFee,
      totalAmount,
      proEarnings,
      deliveryDays,
    };
  }

  async createGigCheckoutSession(userId: string, dto: CreateGigOrderDto) {
    const { gigPackage, gig, totalAmount } =
      await this.resolveGigPackageAndTotals(userId, dto);

    const stripe = this.ensureStripe();
    const publicAppUrl =
      this.configService.get<string>('PUBLIC_APP_URL') || 'https://yewi.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${gig.title} (${gigPackage.name})`,
              description: gigPackage.description.slice(0, 200),
            },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        paymentType: 'GIG_PURCHASE',
        gigPackageId: gigPackage.id,
        gigId: gig.id,
        extraIds: JSON.stringify(dto.extraIds ?? []),
        requirementsAnswers: dto.requirementsAnswers
          ? JSON.stringify(dto.requirementsAnswers)
          : '',
      },
      success_url: `${publicAppUrl}/orders?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicAppUrl}/orders?checkout=cancel`,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async confirmGigCheckoutSession(
    userId: string,
    sessionId: string,
    paymentIntentId?: string,
  ) {
    const existingTx = await this.dataSource
      .getRepository(LedgerTransaction)
      .createQueryBuilder('tx')
      .where(`tx.metadata->>'sessionId' = :sessionId`, { sessionId })
      .getOne();

    if (existingTx?.referenceId) {
      const existingOrder = await this.orderRepo.findOne({
        where: { id: existingTx.referenceId },
        relations: { gig: true, gigPackage: true },
      });
      if (existingOrder) {
        return existingOrder;
      }
    }

    const stripe = this.ensureStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      throw new BadRequestException(
        'La sesión de Checkout aún no está completada',
      );
    }

    const gigPackageId = session.metadata?.gigPackageId;
    const gigId = session.metadata?.gigId;
    if (!gigPackageId) {
      throw new BadRequestException(
        'Metadatos incompletos en sesión de Checkout',
      );
    }

    let extraIds: string[] = [];
    try {
      if (session.metadata?.extraIds) {
        extraIds = JSON.parse(session.metadata.extraIds);
      }
    } catch {
      extraIds = [];
    }

    let requirementsAnswers: Record<string, unknown> | null = null;
    try {
      if (session.metadata?.requirementsAnswers) {
        requirementsAnswers = JSON.parse(session.metadata.requirementsAnswers);
      }
    } catch {
      requirementsAnswers = null;
    }

    const { gigPackage, gig, subtotal, platformFee, totalAmount, proEarnings, deliveryDays } =
      await this.resolveGigPackageAndTotals(userId, {
        gigPackageId,
        gigId,
        extraIds,
        requirementsAnswers: requirementsAnswers ?? undefined,
      });

    return this.dataSource.transaction(async (manager) => {
      let clientWallet = await manager.findOne(Wallet, { where: { userId } });
      if (!clientWallet) {
        clientWallet = await manager.save(
          Wallet,
          manager.create(Wallet, { userId, currency: 'EUR' }),
        );
      }

      const requiresAnswers = (gig.requirements?.length ?? 0) > 0;
      const initialStatus =
        requirementsAnswers || !requiresAnswers
          ? OrderStatus.IN_PROGRESS
          : OrderStatus.PENDING_REQUIREMENTS;

      const orderNumber = `YW-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
      const order = await manager.save(
        Order,
        manager.create(Order, {
          orderNumber,
          clientId: userId,
          professionalProfileId: gig.professionalProfileId,
          orderType: OrderType.GIG_PURCHASE,
          gigId: gig.id,
          gigPackageId: gigPackage.id,
          status: initialStatus,
          subtotal,
          platformFee,
          totalAmount,
          proEarnings,
          escrowStatus: EscrowStatus.HELD,
          requirementsAnswers,
          deliveryDeadline: new Date(
            Date.now() + deliveryDays * 24 * 60 * 60 * 1000,
          ),
        }),
      );

      await manager.increment(Gig, { id: gig.id }, 'ordersCount', 1);

      const proUserId = gig.professionalProfile?.userId;
      if (proUserId) {
        let proWallet = await manager.findOne(Wallet, {
          where: { userId: proUserId },
        });
        if (!proWallet) {
          proWallet = await manager.save(
            Wallet,
            manager.create(Wallet, { userId: proUserId, currency: 'EUR' }),
          );
        }
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            fiatPendingBalance: () => `"fiat_pending_balance" + :earnings`,
          })
          .where('id = :id', { id: proWallet.id })
          .setParameter('earnings', proEarnings)
          .execute();

        const existingConv = await manager.findOne(Conversation, {
          where: [
            { participantAId: userId, participantBId: proUserId },
            { participantAId: proUserId, participantBId: userId },
          ],
        });
        if (!existingConv) {
          await manager.save(
            Conversation,
            manager.create(Conversation, {
              orderId: order.id,
              participantAId: userId,
              participantBId: proUserId,
            }),
          );
        }

        const notif = await manager.save(
          Notification,
          manager.create(Notification, {
            userId: proUserId,
            type: NotificationType.ORDER_CREATED,
            title: '¡Nuevo pedido recibido!',
            message: `Han contratado "${gig.title}" (${orderNumber}).`,
            link: `/orders`,
          }),
        );
        if (this.realtimeService) {
          this.realtimeService.emitNotification(notif);
        }
      }

      await manager.save(
        LedgerTransaction,
        manager.create(LedgerTransaction, {
          walletId: clientWallet.id,
          type: TransactionType.ORDER_PAYMENT,
          amount: totalAmount,
          currency: 'EUR',
          status: TransactionStatus.COMPLETED,
          stripePaymentIntentId:
            paymentIntentId ||
            (typeof session.payment_intent === 'string'
              ? session.payment_intent
              : null),
          referenceId: order.id,
          metadata: { sessionId, orderNumber, gigId: gig.id },
        }),
      );

      return order;
    });
  }

  async createGigOrderFromIap(
    userId: string,
    params: {
      gigPackageId: string;
      gigId?: string;
      extraIds?: string[];
      transactionId: string;
      platform: string;
      productId: string;
    },
  ) {
    const existingTx = await this.dataSource
      .getRepository(LedgerTransaction)
      .createQueryBuilder('tx')
      .where(`tx.metadata->>'iapTransactionId' = :txId`, {
        txId: params.transactionId,
      })
      .getOne();

    if (existingTx?.referenceId) {
      const existingOrder = await this.orderRepo.findOne({
        where: { id: existingTx.referenceId },
        relations: { gig: true, gigPackage: true },
      });
      if (existingOrder) {
        return existingOrder;
      }
    }

    const {
      gigPackage,
      gig,
      subtotal,
      platformFee,
      totalAmount,
      proEarnings,
      deliveryDays,
    } = await this.resolveGigPackageAndTotals(userId, {
      gigPackageId: params.gigPackageId,
      gigId: params.gigId,
      extraIds: params.extraIds,
    });

    return this.dataSource.transaction(async (manager) => {
      let clientWallet = await manager.findOne(Wallet, { where: { userId } });
      if (!clientWallet) {
        clientWallet = await manager.save(
          Wallet,
          manager.create(Wallet, { userId, currency: 'EUR' }),
        );
      }

      const orderNumber = `YW-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
      const order = await manager.save(
        Order,
        manager.create(Order, {
          orderNumber,
          clientId: userId,
          professionalProfileId: gig.professionalProfileId,
          orderType: OrderType.GIG_PURCHASE,
          gigId: gig.id,
          gigPackageId: gigPackage.id,
          status: OrderStatus.IN_PROGRESS,
          subtotal,
          platformFee,
          totalAmount,
          proEarnings,
          escrowStatus: EscrowStatus.HELD,
          deliveryDeadline: new Date(
            Date.now() + deliveryDays * 24 * 60 * 60 * 1000,
          ),
        }),
      );

      await manager.increment(Gig, { id: gig.id }, 'ordersCount', 1);

      const proUserId = gig.professionalProfile?.userId;
      if (proUserId) {
        let proWallet = await manager.findOne(Wallet, {
          where: { userId: proUserId },
        });
        if (!proWallet) {
          proWallet = await manager.save(
            Wallet,
            manager.create(Wallet, { userId: proUserId, currency: 'EUR' }),
          );
        }
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            fiatPendingBalance: () => `"fiat_pending_balance" + :earnings`,
          })
          .where('id = :id', { id: proWallet.id })
          .setParameter('earnings', proEarnings)
          .execute();

        const existingConv = await manager.findOne(Conversation, {
          where: [
            { participantAId: userId, participantBId: proUserId },
            { participantAId: proUserId, participantBId: userId },
          ],
        });
        if (!existingConv) {
          await manager.save(
            Conversation,
            manager.create(Conversation, {
              orderId: order.id,
              participantAId: userId,
              participantBId: proUserId,
            }),
          );
        }

        const notif = await manager.save(
          Notification,
          manager.create(Notification, {
            userId: proUserId,
            type: NotificationType.ORDER_CREATED,
            title: '¡Nuevo pedido recibido!',
            message: `Han contratado "${gig.title}" (${orderNumber}).`,
            link: `/orders`,
          }),
        );
        if (this.realtimeService) {
          this.realtimeService.emitNotification(notif);
        }
      }

      await manager.save(
        LedgerTransaction,
        manager.create(LedgerTransaction, {
          walletId: clientWallet.id,
          type: TransactionType.ORDER_PAYMENT,
          amount: totalAmount,
          currency: 'EUR',
          status: TransactionStatus.COMPLETED,
          referenceId: order.id,
          metadata: {
            iapTransactionId: params.transactionId,
            iapPlatform: params.platform,
            iapProductId: params.productId,
            orderNumber,
            gigId: gig.id,
          },
        }),
      );

      return order;
    });
  }

  async createGigOrder(userId: string, dto: CreateGigOrderDto) {
    const { gigPackage, gig, subtotal, platformFee, totalAmount, proEarnings, deliveryDays } =
      await this.resolveGigPackageAndTotals(userId, dto);

    return this.dataSource.transaction(async (manager) => {
      const clientWallet = await manager.findOne(Wallet, { where: { userId } });
      if (!clientWallet) {
        throw new BadRequestException(
          'No dispones de saldo en billetera para realizar esta compra',
        );
      }

      const debit = await manager
        .createQueryBuilder()
        .update(Wallet)
        .set({
          fiatAvailableBalance: () => `"fiat_available_balance" - :total`,
        })
        .where('id = :id AND fiat_available_balance >= :total', {
          id: clientWallet.id,
          total: totalAmount,
        })
        .execute();

      if (!debit.affected || debit.affected === 0) {
        throw new BadRequestException(
          'Saldo disponible insuficiente en tu billetera para completar el pago',
        );
      }

      const requiresAnswers = (gig.requirements?.length ?? 0) > 0;
      const initialStatus =
        dto.requirementsAnswers || !requiresAnswers
          ? OrderStatus.IN_PROGRESS
          : OrderStatus.PENDING_REQUIREMENTS;

      const orderNumber = `YW-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
      const order = await manager.save(
        Order,
        manager.create(Order, {
          orderNumber,
          clientId: userId,
          professionalProfileId: gig.professionalProfileId,
          orderType: OrderType.GIG_PURCHASE,
          gigId: gig.id,
          gigPackageId: gigPackage.id,
          status: initialStatus,
          subtotal,
          platformFee,
          totalAmount,
          proEarnings,
          escrowStatus: EscrowStatus.HELD,
          requirementsAnswers: dto.requirementsAnswers ?? null,
          deliveryDeadline: new Date(
            Date.now() + deliveryDays * 24 * 60 * 60 * 1000,
          ),
        }),
      );

      await manager.increment(Gig, { id: gig.id }, 'ordersCount', 1);

      const proUserId = gig.professionalProfile?.userId;
      if (proUserId) {
        let proWallet = await manager.findOne(Wallet, {
          where: { userId: proUserId },
        });
        if (!proWallet) {
          proWallet = await manager.save(
            Wallet,
            manager.create(Wallet, { userId: proUserId, currency: 'EUR' }),
          );
        }
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            fiatPendingBalance: () => `"fiat_pending_balance" + :earnings`,
          })
          .where('id = :id', { id: proWallet.id })
          .setParameter('earnings', proEarnings)
          .execute();

        const existingConv = await manager.findOne(Conversation, {
          where: [
            { participantAId: userId, participantBId: proUserId },
            { participantAId: proUserId, participantBId: userId },
          ],
        });
        if (!existingConv) {
          await manager.save(
            Conversation,
            manager.create(Conversation, {
              orderId: order.id,
              participantAId: userId,
              participantBId: proUserId,
            }),
          );
        }

        const notif = await manager.save(
          Notification,
          manager.create(Notification, {
            userId: proUserId,
            type: NotificationType.ORDER_CREATED,
            title: '¡Nuevo pedido recibido!',
            message: `Han contratado "${gig.title}" (${orderNumber}).`,
            link: `/orders`,
          }),
        );
        if (this.realtimeService) {
          this.realtimeService.emitNotification(notif);
        }
      }

      await manager.save(
        LedgerTransaction,
        manager.create(LedgerTransaction, {
          walletId: clientWallet.id,
          type: TransactionType.ORDER_PAYMENT,
          amount: totalAmount,
          currency: 'EUR',
          status: TransactionStatus.COMPLETED,
          referenceId: order.id,
          metadata: { orderNumber, gigId: gig.id },
        }),
      );

      return order;
    });
  }

  async getMyOrders(userId: string, role?: 'client' | 'pro') {
    const pro = await this.proRepo.findOne({ where: { userId } });

    const qb = this.orderRepo
      .createQueryBuilder('ord')
      .leftJoinAndSelect('ord.gig', 'gig')
      .leftJoinAndSelect('ord.gigPackage', 'pkg')
      .leftJoinAndSelect('ord.serviceRequest', 'sr')
      .leftJoinAndSelect('ord.deliveries', 'deliveries')
      .leftJoinAndSelect('ord.dispute', 'dispute')
      .leftJoinAndSelect('ord.review', 'review')
      .leftJoinAndSelect('ord.client', 'client')
      .leftJoinAndSelect('client.profile', 'clientProfile')
      .leftJoinAndSelect('ord.professionalProfile', 'pro')
      .leftJoinAndSelect('pro.user', 'proUser')
      .leftJoinAndSelect('proUser.profile', 'proProfile');

    if (role === 'client') {
      qb.where('ord.clientId = :userId', { userId });
    } else if (role === 'pro') {
      if (!pro) return [];
      qb.where('ord.professionalProfileId = :proId', { proId: pro.id });
    } else if (pro) {
      qb.where('(ord.clientId = :userId OR ord.professionalProfileId = :proId)', {
        userId,
        proId: pro.id,
      });
    } else {
      qb.where('ord.clientId = :userId', { userId });
    }

    return qb.orderBy('ord.createdAt', 'DESC').getMany();
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: {
        gig: true,
        gigPackage: true,
        serviceRequest: true,
        milestones: true,
        deliveries: true,
        dispute: true,
        review: true,
        conversation: true,
        client: { profile: true },
        professionalProfile: { user: { profile: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const isClient = order.clientId === userId;
    const isPro = order.professionalProfile?.userId === userId;
    if (!isClient && !isPro) {
      throw new ForbiddenException('No tienes acceso a este pedido');
    }

    return order;
  }

  async submitRequirements(
    userId: string,
    orderId: string,
    dto: SubmitRequirementsDto,
  ) {
    const order = await this.getOrderById(userId, orderId);
    if (order.clientId !== userId) {
      throw new ForbiddenException(
        'Solo el cliente puede enviar los requerimientos del pedido',
      );
    }
    if (order.status !== OrderStatus.PENDING_REQUIREMENTS) {
      throw new BadRequestException(
        'Este pedido no está esperando requerimientos',
      );
    }

    order.requirementsAnswers = dto.requirementsAnswers;
    order.status = OrderStatus.IN_PROGRESS;
    return this.orderRepo.save(order);
  }

  async submitDelivery(
    userId: string,
    orderId: string,
    dto: SubmitDeliveryDto,
  ) {
    const order = await this.getOrderById(userId, orderId);
    if (order.professionalProfile?.userId !== userId) {
      throw new ForbiddenException(
        'Solo el profesional asignado puede entregar este pedido',
      );
    }
    if (
      order.status !== OrderStatus.IN_PROGRESS &&
      order.status !== OrderStatus.REVISION_REQUESTED
    ) {
      throw new BadRequestException(
        'El pedido no se encuentra en estado entregable',
      );
    }

    const existingCount = await this.deliveryRepo.count({ where: { orderId } });
    const delivery = await this.deliveryRepo.save(
      this.deliveryRepo.create({
        orderId,
        deliveryNumber: existingCount + 1,
        message: dto.message.trim(),
        attachmentUrls: dto.attachmentUrls ?? [],
        isAccepted: false,
      }),
    );

    const autoDays =
      this.configService.get<number>('business.autoCompleteDays') ?? 3;
    order.status = OrderStatus.DELIVERED;
    order.autoCompletedAt = new Date(
      Date.now() + autoDays * 24 * 60 * 60 * 1000,
    );
    await this.orderRepo.save(order);

    const notif = await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: order.clientId,
        type: NotificationType.ORDER_DELIVERED,
        title: '¡Tu pedido ha sido entregado!',
        message: `El profesional ha enviado la entrega #${delivery.deliveryNumber} del pedido ${order.orderNumber}.`,
        link: `/orders`,
      }),
    );
    if (this.realtimeService) {
      this.realtimeService.emitNotification(notif);
    }

    return delivery;
  }

  async requestRevision(
    userId: string,
    orderId: string,
    dto: RequestRevisionDto,
  ) {
    const order = await this.getOrderById(userId, orderId);
    if (order.clientId !== userId) {
      throw new ForbiddenException(
        'Solo el cliente puede solicitar una revisión',
      );
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Solo se pueden pedir revisiones sobre pedidos entregados',
      );
    }

    order.status = OrderStatus.REVISION_REQUESTED;
    order.autoCompletedAt = null;
    await this.orderRepo.save(order);

    const proUserId = order.professionalProfile?.userId;
    if (proUserId) {
      const notif = await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: proUserId,
          type: NotificationType.REVISION_REQUESTED,
          title: 'Solicitud de revisión',
          message: `El cliente solicita ajustes en ${order.orderNumber}: "${dto.revisionNotes.slice(0, 100)}"`,
          link: `/orders`,
        }),
      );
      if (this.realtimeService) {
        this.realtimeService.emitNotification(notif);
      }
    }

    return order;
  }

  async approveDelivery(userId: string, orderId: string) {
    const order = await this.getOrderById(userId, orderId);
    if (order.clientId !== userId) {
      throw new ForbiddenException(
        'Solo el cliente puede aprobar la entrega y liberar los fondos',
      );
    }
    if (order.escrowStatus !== EscrowStatus.HELD) {
      throw new ConflictException('Los fondos de este pedido ya fueron liberados');
    }

    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Order)
        .set({
          status: OrderStatus.COMPLETED,
          escrowStatus: EscrowStatus.RELEASED_TO_PRO,
        })
        .where('id = :id AND escrow_status = :held', {
          id: orderId,
          held: EscrowStatus.HELD,
        })
        .execute();

      if (!result.affected || result.affected === 0) {
        throw new ConflictException(
          'Los fondos de Escrow de este pedido ya fueron procesados',
        );
      }

      await manager.update(OrderDelivery, { orderId }, { isAccepted: true });
      await manager.increment(
        ProfessionalProfile,
        { id: order.professionalProfileId },
        'completedOrdersCount',
        1,
      );

      const proUserId = order.professionalProfile?.userId;
      if (proUserId) {
        let proWallet = await manager.findOne(Wallet, {
          where: { userId: proUserId },
        });
        if (!proWallet) {
          proWallet = await manager.save(
            Wallet,
            manager.create(Wallet, { userId: proUserId, currency: 'EUR' }),
          );
        }

        const proEarnings = Number(order.proEarnings);
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            fiatAvailableBalance: () => `"fiat_available_balance" + :earnings`,
            fiatPendingBalance: () =>
              `GREATEST(0, "fiat_pending_balance" - :earnings)`,
          })
          .where('id = :id', { id: proWallet.id })
          .setParameter('earnings', proEarnings)
          .execute();

        await manager.save(
          LedgerTransaction,
          manager.create(LedgerTransaction, {
            walletId: proWallet.id,
            type: TransactionType.ESCROW_RELEASE,
            amount: proEarnings,
            currency: 'EUR',
            status: TransactionStatus.COMPLETED,
            referenceId: order.id,
            metadata: { orderNumber: order.orderNumber },
          }),
        );

        const notif = await manager.save(
          Notification,
          manager.create(Notification, {
            userId: proUserId,
            type: NotificationType.ORDER_COMPLETED,
            title: '¡Entrega aprobada y pago liberado!',
            message: `Has recibido ${proEarnings.toFixed(2)} € en tu saldo disponible por ${order.orderNumber}.`,
            link: `/wallet`,
          }),
        );
        if (this.realtimeService) {
          this.realtimeService.emitNotification(notif);
        }
      }

      return manager.findOne(Order, { where: { id: orderId } });
    });
  }

  async openDispute(userId: string, orderId: string, dto: OpenDisputeDto) {
    const order = await this.getOrderById(userId, orderId);
    const existing = await this.disputeRepo.findOne({ where: { orderId } });
    if (existing) {
      throw new ConflictException('Este pedido ya tiene una disputa abierta');
    }

    const dispute = await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, orderId, { status: OrderStatus.DISPUTED });
      return manager.save(
        OrderDispute,
        manager.create(OrderDispute, {
          orderId,
          initiatorId: userId,
          reason: dto.reason.trim(),
          description: dto.description.trim(),
          evidenceUrls: dto.evidenceUrls ?? [],
          status: 'OPEN',
        }),
      );
    });

    const counterpartyId =
      order.clientId === userId
        ? order.professionalProfile?.userId
        : order.clientId;
    if (counterpartyId) {
      const notif = await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: counterpartyId,
          type: NotificationType.DISPUTE_OPENED,
          title: 'Disputa abierta en pedido',
          message: `Se ha abierto una disputa en ${order.orderNumber}: ${dto.reason}.`,
          link: `/orders`,
        }),
      );
      if (this.realtimeService) {
        this.realtimeService.emitNotification(notif);
      }
    }

    return dispute;
  }

  async cancelOrder(userId: string, orderId: string, dto: CancelOrderDto) {
    const order = await this.getOrderById(userId, orderId);
    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'No se puede cancelar un pedido ya completado o cancelado',
      );
    }
    if (order.escrowStatus !== EscrowStatus.HELD) {
      throw new ConflictException('El Escrow de este pedido ya no está retenido');
    }

    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Order)
        .set({
          status: OrderStatus.CANCELLED,
          escrowStatus: EscrowStatus.REFUNDED_TO_CLIENT,
          cancelledAt: new Date(),
          cancellationReason:
            dto.reason?.trim() || 'Cancelación acordada en plataforma',
        })
        .where('id = :id AND escrow_status = :held', {
          id: orderId,
          held: EscrowStatus.HELD,
        })
        .execute();

      if (!result.affected || result.affected === 0) {
        throw new ConflictException('El pedido ya fue procesado');
      }

      const refundAmount = Number(order.totalAmount);
      let clientWallet = await manager.findOne(Wallet, {
        where: { userId: order.clientId },
      });
      if (!clientWallet) {
        clientWallet = await manager.save(
          Wallet,
          manager.create(Wallet, { userId: order.clientId, currency: 'EUR' }),
        );
      }

      await manager
        .createQueryBuilder()
        .update(Wallet)
        .set({
          fiatAvailableBalance: () => `"fiat_available_balance" + :refund`,
        })
        .where('id = :id', { id: clientWallet.id })
        .setParameter('refund', refundAmount)
        .execute();

      await manager.save(
        LedgerTransaction,
        manager.create(LedgerTransaction, {
          walletId: clientWallet.id,
          type: TransactionType.ORDER_REFUND,
          amount: refundAmount,
          currency: 'EUR',
          status: TransactionStatus.COMPLETED,
          referenceId: order.id,
          metadata: { orderNumber: order.orderNumber, reason: dto.reason },
        }),
      );

      const proUserId = order.professionalProfile?.userId;
      if (proUserId) {
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            fiatPendingBalance: () =>
              `GREATEST(0, "fiat_pending_balance" - :earnings)`,
          })
          .where('user_id = :proUserId', { proUserId })
          .setParameter('earnings', Number(order.proEarnings))
          .execute();
      }

      return manager.findOne(Order, { where: { id: orderId } });
    });
  }
}
