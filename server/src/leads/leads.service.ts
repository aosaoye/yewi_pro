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
import { DataSource, Not, Repository } from 'typeorm';
import { RealtimeService } from '../common/realtime/realtime.service';
import { AntiFraudUtils } from '../common/utils/anti-fraud.utils';
import { GeoUtils } from '../common/utils/geo.utils';
import {
  Category,
  Conversation,
  LeadUnlock,
  LedgerTransaction,
  Notification,
  Order,
  ProfessionalProfile,
  QuoteProposal,
  ServiceRequest,
  Wallet,
} from '../database/entities';
import {
  EscrowStatus,
  LeadStatus,
  NotificationType,
  OrderStatus,
  OrderType,
  ProposalStatus,
  SubscriptionStatus,
  TransactionStatus,
  TransactionType,
} from '../database/enums';
import { CreateQuoteProposalDto } from './dto/create-quote-proposal.dto';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { FilterLeadsDto } from './dto/filter-leads.dto';

@Injectable()
export class LeadsService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectRepository(ServiceRequest)
    private readonly requestRepo: Repository<ServiceRequest>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(ProfessionalProfile)
    private readonly proRepo: Repository<ProfessionalProfile>,
    @InjectRepository(LeadUnlock)
    private readonly unlockRepo: Repository<LeadUnlock>,
    @InjectRepository(QuoteProposal)
    private readonly proposalRepo: Repository<QuoteProposal>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
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
        'Pasarela Stripe no configurada en el servidor',
      );
    }
    return this.stripe;
  }

  private hasActivePro(pro?: ProfessionalProfile | null): boolean {
    if (!pro) return false;
    const subStatus = pro.user?.subscription?.status;
    return Boolean(
      pro.isPro ||
        pro.user?.isPro ||
        subStatus === SubscriptionStatus.ACTIVE ||
        subStatus === SubscriptionStatus.TRIALING,
    );
  }

  private sanitizeRequestForViewer(
    req: ServiceRequest,
    viewerUserId: string,
    isUnlockedByViewer: boolean,
  ) {
    const canSeePii = req.clientId === viewerUserId || isUnlockedByViewer;
    const clientProfile = req.client?.profile;
    return {
      ...req,
      address: canSeePii ? req.address : null,
      client: req.client
        ? {
            id: req.client.id,
            email: canSeePii ? req.client.email : undefined,
            profile: clientProfile
              ? {
                  firstName: clientProfile.firstName,
                  lastName: canSeePii ? clientProfile.lastName : '',
                  displayName: canSeePii
                    ? clientProfile.displayName || clientProfile.firstName
                    : clientProfile.firstName,
                  avatarUrl: clientProfile.avatarUrl,
                  city: clientProfile.city,
                  phoneNumber: canSeePii ? clientProfile.phoneNumber : undefined,
                }
              : null,
          }
        : undefined,
    };
  }

  async createRequest(userId: string, dto: CreateServiceRequestDto) {
    let category: Category | null = null;
    if (dto.categoryId) {
      category = await this.categoryRepo.findOne({
        where: { id: dto.categoryId },
      });
    } else if (dto.category) {
      category = await this.categoryRepo
        .createQueryBuilder('c')
        .where('c.slug = :val OR c.name ILIKE :valLike', {
          val: dto.category.trim().toLowerCase(),
          valLike: `%${dto.category.trim()}%`,
        })
        .getOne();
    }
    if (!category) {
      category = await this.categoryRepo.findOne({
        where: { isActive: true },
        order: { sortOrder: 'ASC' },
      });
    }
    if (!category) {
      throw new BadRequestException('No existe una categoría válida disponible');
    }

    const maxUnlocks =
      this.configService.get<number>('business.maxProsPerLead') ?? 5;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const saved = await this.requestRepo.save(
      this.requestRepo.create({
        clientId: userId,
        categoryId: category.id,
        title: dto.title.trim(),
        description: dto.description.trim(),
        questionnaireAnswers: dto.questionnaireAnswers ?? {},
        budgetMin: dto.budgetMin ?? dto.budgetEstimated ?? null,
        budgetMax: dto.budgetMax ?? dto.budgetEstimated ?? null,
        isUrgent: dto.isUrgent ?? false,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : null,
        postalCode: dto.postalCode || '28001',
        city: dto.city || 'Madrid',
        country: dto.country || 'ES',
        address: dto.address ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isRemote: dto.isRemote ?? false,
        creditCost: category.baseLeadCreditCost ?? 10,
        maxUnlocks,
        unlocksCount: 0,
        status: LeadStatus.OPEN,
        expiresAt,
      }),
    );

    // Notificar profesionales de la categoría o zona cercana
    const candidatePros = await this.proRepo
      .createQueryBuilder('pro')
      .leftJoin('pro.categories', 'cat')
      .where('pro.userId != :userId', { userId })
      .andWhere('(cat.id = :catId OR pro.city ILIKE :city)', {
        catId: category.id,
        city: `%${saved.city}%`,
      })
      .take(15)
      .getMany();

    if (candidatePros.length > 0) {
      for (const pro of candidatePros) {
        const notif = await this.notificationRepo.save(
          this.notificationRepo.create({
            userId: pro.userId,
            type: NotificationType.LEAD_MATCH,
            title: 'Nueva solicitud en tu zona',
            message: `${saved.title} (${saved.city})`,
            link: `/request-detail?id=${saved.id}`,
          }),
        );
        if (this.realtimeService) {
          this.realtimeService.emitNotification(notif);
        }
      }
    }

    return this.requestRepo.findOne({
      where: { id: saved.id },
      relations: { category: true },
    });
  }

  async getMyRequests(userId: string) {
    return this.requestRepo.find({
      where: { clientId: userId },
      relations: {
        category: true,
        unlocks: true,
        proposals: {
          professionalProfile: {
            user: { profile: true },
          },
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOpportunitiesForPro(userId: string, filter: FilterLeadsDto) {
    const pro = await this.proRepo.findOne({
      where: { userId },
      relations: { categories: true },
    });
    if (!pro) {
      throw new ForbiddenException(
        'Debes configurar tu perfil profesional para ver oportunidades',
      );
    }

    const qb = this.requestRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.category', 'category')
      .leftJoinAndSelect('sr.client', 'client')
      .leftJoinAndSelect('client.profile', 'profile')
      .leftJoinAndSelect('sr.unlocks', 'unlocks')
      .where('sr.status = :status', { status: LeadStatus.OPEN })
      .andWhere('sr.expiresAt > :now', { now: new Date() })
      .andWhere('sr.clientId != :userId', { userId });

    const catFilter = filter.categoryId || filter.category;
    if (catFilter && catFilter.trim()) {
      const cat = catFilter.trim();
      qb.andWhere(
        '(category.id = :cat OR category.slug = :cat OR category.name ILIKE :catLike)',
        { cat, catLike: `%${cat}%` },
      );
    }

    if (filter.city && filter.city.trim()) {
      qb.andWhere('sr.city ILIKE :city', { city: `%${filter.city.trim()}%` });
    }

    if (filter.isUrgent !== undefined) {
      qb.andWhere('sr.isUrgent = :isUrgent', {
        isUrgent: Boolean(filter.isUrgent),
      });
    }

    if (filter.search && filter.search.trim()) {
      const term = `%${filter.search.trim()}%`;
      qb.andWhere('(sr.title ILIKE :term OR sr.description ILIKE :term)', {
        term,
      });
    }

    const allRows = await qb.orderBy('sr.createdAt', 'DESC').getMany();

    const mapped = allRows
      .map((sr) => {
        const isUnlocked = Boolean(
          sr.unlocks?.some((u) => u.professionalProfileId === pro.id),
        );
        const distanceKm =
          pro.latitude != null &&
          pro.longitude != null &&
          sr.latitude != null &&
          sr.longitude != null
            ? Number(
                GeoUtils.calculateHaversineDistance(
                  pro.latitude,
                  pro.longitude,
                  sr.latitude,
                  sr.longitude,
                ).toFixed(2),
              )
            : null;

        return {
          ...this.sanitizeRequestForViewer(sr, userId, isUnlocked),
          isUnlocked,
          distanceKm,
        };
      })
      .filter((item) => {
        if (filter.onlyMatchingMyRadius && item.distanceKm !== null) {
          return item.distanceKm <= (pro.serviceRadiusKm || 50);
        }
        return true;
      });

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const total = mapped.length;
    const start = (page - 1) * limit;
    const data = mapped.slice(start, start + limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async unlockLead(userId: string, requestId: string) {
    const pro = await this.proRepo.findOne({
      where: { userId },
      relations: { user: { subscription: true } },
    });
    if (!pro) {
      throw new ForbiddenException('Perfil profesional no encontrado');
    }
    if (!this.hasActivePro(pro)) {
      throw new ForbiddenException(
        'Desbloquear solicitudes de clientes requiere suscripción activa a Yewi Pro (15,99 €/mes)',
      );
    }

    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: { client: { profile: true } },
    });
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    if (request.clientId === userId) {
      throw new BadRequestException(
        'No puedes desbloquear tu propia solicitud de servicio',
      );
    }
    if (request.status !== LeadStatus.OPEN) {
      throw new BadRequestException('Esta solicitud ya no está abierta');
    }

    const existingUnlock = await this.unlockRepo.findOne({
      where: { serviceRequestId: requestId, professionalProfileId: pro.id },
    });
    if (existingUnlock) {
      return {
        alreadyUnlocked: true,
        unlock: existingUnlock,
        request: this.sanitizeRequestForViewer(request, userId, true),
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const updateResult = await manager
        .createQueryBuilder()
        .update(ServiceRequest)
        .set({ unlocksCount: () => `"unlocks_count" + 1` })
        .where(
          'id = :id AND status = :status AND unlocks_count < max_unlocks',
          { id: requestId, status: LeadStatus.OPEN },
        )
        .execute();

      if (!updateResult.affected || updateResult.affected === 0) {
        throw new ConflictException(
          'Esta solicitud ha alcanzado el límite máximo de profesionales',
        );
      }

      const unlock = await manager.save(
        LeadUnlock,
        manager.create(LeadUnlock, {
          serviceRequestId: requestId,
          professionalProfileId: pro.id,
          creditsSpent: 0,
        }),
      );

      // Garantizar conversación lista entre cliente y profesional
      const existingConv = await manager.findOne(Conversation, {
        where: [
          {
            serviceRequestId: requestId,
            participantAId: request.clientId,
            participantBId: userId,
          },
          {
            serviceRequestId: requestId,
            participantAId: userId,
            participantBId: request.clientId,
          },
        ],
      });

      if (!existingConv) {
        await manager.save(
          Conversation,
          manager.create(Conversation, {
            serviceRequestId: requestId,
            participantAId: request.clientId,
            participantBId: userId,
          }),
        );
      }

      const notif = await manager.save(
        Notification,
        manager.create(Notification, {
          userId: request.clientId,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Un profesional está revisando tu solicitud',
          message: `${pro.businessName || 'Un profesional Yewi Pro'} se ha interesado en "${request.title}".`,
          link: `/request-detail?id=${request.id}`,
        }),
      );
      if (this.realtimeService) {
        this.realtimeService.emitNotification(notif);
      }

      return {
        alreadyUnlocked: false,
        unlock,
        request: this.sanitizeRequestForViewer(request, userId, true),
      };
    });
  }

  async sendQuoteProposal(
    userId: string,
    requestId: string,
    dto: CreateQuoteProposalDto,
  ) {
    const pro = await this.proRepo.findOne({
      where: { userId },
      relations: { user: { subscription: true } },
    });
    if (!pro) {
      throw new ForbiddenException('Perfil profesional no encontrado');
    }

    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    if (request.status !== LeadStatus.OPEN) {
      throw new BadRequestException(
        'No se pueden enviar presupuestos a una solicitud cerrada',
      );
    }

    const unlock = await this.unlockRepo.findOne({
      where: { serviceRequestId: requestId, professionalProfileId: pro.id },
    });
    if (!unlock && !this.hasActivePro(pro)) {
      throw new ForbiddenException(
        'Debes desbloquear la solicitud antes de enviar un presupuesto',
      );
    }

    const existingProposal = await this.proposalRepo.findOne({
      where: { serviceRequestId: requestId, professionalProfileId: pro.id },
    });
    if (existingProposal) {
      throw new ConflictException(
        'Ya has enviado un presupuesto para esta solicitud',
      );
    }

    const sanitizedMessage = AntiFraudUtils.sanitizeText(dto.message.trim());

    const proposal = await this.proposalRepo.save(
      this.proposalRepo.create({
        serviceRequestId: requestId,
        professionalProfileId: pro.id,
        price: dto.price,
        estimatedDays: dto.estimatedDays,
        message: sanitizedMessage,
        breakdown: dto.breakdown ?? null,
        status: ProposalStatus.PENDING,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );

    const notif = await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: request.clientId,
        type: NotificationType.QUOTE_RECEIVED,
        title: 'Nuevo presupuesto recibido',
        message: `${pro.businessName || 'Un profesional'} ha presupuestado ${dto.price} € para "${request.title}".`,
        link: `/request-detail?id=${request.id}`,
      }),
    );
    if (this.realtimeService) {
      this.realtimeService.emitNotification(notif);
    }

    return proposal;
  }

  async getMyProposals(userId: string) {
    const pro = await this.proRepo.findOne({ where: { userId } });
    if (!pro) {
      throw new ForbiddenException('Perfil profesional no encontrado');
    }

    return this.proposalRepo.find({
      where: { professionalProfileId: pro.id },
      relations: {
        serviceRequest: {
          category: true,
          client: { profile: true },
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async acceptProposal(userId: string, proposalId: string) {
    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId },
      relations: {
        serviceRequest: true,
        professionalProfile: true,
      },
    });
    if (!proposal || !proposal.serviceRequest) {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    if (proposal.serviceRequest.clientId !== userId) {
      throw new ForbiddenException(
        'Solo el cliente propietario puede aceptar este presupuesto',
      );
    }
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException(
        'Este presupuesto ya fue procesado o ya no está pendiente',
      );
    }

    const commissionRate =
      (this.configService.get<number>('business.platformCommission') ?? 15) /
      100;
    const subtotal = Number(proposal.price);
    const platformFee = Number((subtotal * commissionRate).toFixed(2));
    const totalAmount = subtotal;
    const proEarnings = Number((subtotal - platformFee).toFixed(2));
    const deliveryDeadline = new Date(
      Date.now() + proposal.estimatedDays * 24 * 60 * 60 * 1000,
    );
    const serviceRequestTitle = proposal.serviceRequest.title;

    return this.dataSource.transaction(async (manager) => {
      const clientWallet = await manager.findOne(Wallet, { where: { userId } });
      if (!clientWallet) {
        throw new BadRequestException(
          'No tienes una billetera activa con saldo suficiente',
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
          'Saldo disponible insuficiente en la billetera para formalizar el pedido en Escrow',
        );
      }

      const orderNumber = `YW-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
      const order = await manager.save(
        Order,
        manager.create(Order, {
          orderNumber,
          clientId: userId,
          professionalProfileId: proposal.professionalProfileId,
          orderType: OrderType.LEAD_CONTRACT,
          quoteProposalId: proposal.id,
          serviceRequestId: proposal.serviceRequestId,
          status: OrderStatus.IN_PROGRESS,
          subtotal,
          platformFee,
          totalAmount,
          proEarnings,
          escrowStatus: EscrowStatus.HELD,
          deliveryDeadline,
        }),
      );

      await manager.update(QuoteProposal, proposal.id, {
        status: ProposalStatus.ACCEPTED,
      });
      await manager.update(
        QuoteProposal,
        { serviceRequestId: proposal.serviceRequestId, id: Not(proposal.id) },
        { status: ProposalStatus.REJECTED },
      );
      await manager.update(ServiceRequest, proposal.serviceRequestId, {
        status: LeadStatus.FULFILLED,
      });

      const proUserId = proposal.professionalProfile?.userId;
      if (proUserId) {
        let proWallet = await manager.findOne(Wallet, {
          where: { userId: proUserId },
        });
        if (!proWallet) {
          proWallet = await manager.save(
            Wallet,
            manager.create(Wallet, {
              userId: proUserId,
              creditBalance: 0,
              fiatPendingBalance: 0,
              fiatAvailableBalance: 0,
              currency: 'EUR',
            }),
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
          metadata: { proposalId: proposal.id, orderNumber },
        }),
      );

      if (proUserId) {
        const existingConv = await manager.findOne(Conversation, {
          where: [
            { participantAId: userId, participantBId: proUserId },
            { participantAId: proUserId, participantBId: userId },
          ],
        });
        if (existingConv) {
          await manager.update(Conversation, existingConv.id, {
            orderId: order.id,
          });
        } else {
          await manager.save(
            Conversation,
            manager.create(Conversation, {
              orderId: order.id,
              serviceRequestId: proposal.serviceRequestId,
              participantAId: userId,
              participantBId: proUserId,
            }),
          );
        }

        const notif = await manager.save(
          Notification,
          manager.create(Notification, {
            userId: proUserId,
            type: NotificationType.QUOTE_ACCEPTED,
            title: '¡Presupuesto aceptado!',
            message: `El cliente ha aceptado tu presupuesto para "${serviceRequestTitle}" (Pedido ${orderNumber}).`,
            link: `/request-detail?id=${proposal.serviceRequestId}`,
          }),
        );
        if (this.realtimeService) {
          this.realtimeService.emitNotification(notif);
        }
      }

      return order;
    });
  }

  async createLeadCheckoutSession(userId: string, proposalId: string) {
    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId },
      relations: { serviceRequest: true },
    });
    if (!proposal || !proposal.serviceRequest) {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    if (proposal.serviceRequest.clientId !== userId) {
      throw new ForbiddenException(
        'Solo el cliente de la solicitud puede pagar este presupuesto',
      );
    }
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Este presupuesto ya no está pendiente');
    }

    const stripe = this.ensureStripe();
    const publicAppUrl =
      this.configService.get<string>('PUBLIC_APP_URL') || 'https://yewi.app';
    const amountCents = Math.round(Number(proposal.price) * 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Presupuesto Yewi: ${proposal.serviceRequest.title}`,
              description: `Pago protegido en Escrow (${proposal.estimatedDays} días estimados)`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        paymentType: 'LEAD_CONTRACT',
        proposalId: proposal.id,
        serviceRequestId: proposal.serviceRequestId,
      },
      success_url: `${publicAppUrl}/requests?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicAppUrl}/requests?checkout=cancel`,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async confirmLeadCheckoutSession(
    userId: string,
    sessionId: string,
    paymentIntentId?: string,
  ) {
    const existingOrder = await this.orderRepo
      .createQueryBuilder('ord')
      .leftJoin('ledger_transactions', 'tx', 'tx.reference_id = ord.id')
      .where(`tx.metadata->>'sessionId' = :sessionId`, { sessionId })
      .getOne();
    if (existingOrder) {
      return existingOrder;
    }

    const stripe = this.ensureStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      throw new BadRequestException(
        'La sesión de Checkout todavía no está pagada',
      );
    }

    const proposalId = session.metadata?.proposalId;
    if (!proposalId) {
      throw new BadRequestException(
        'Falta proposalId en los metadatos de Stripe Checkout',
      );
    }

    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId },
      relations: { serviceRequest: true, professionalProfile: true },
    });
    if (!proposal || !proposal.serviceRequest) {
      throw new NotFoundException('Presupuesto no encontrado');
    }

    const commissionRate =
      (this.configService.get<number>('business.platformCommission') ?? 15) /
      100;
    const subtotal = Number(proposal.price);
    const platformFee = Number((subtotal * commissionRate).toFixed(2));
    const totalAmount = subtotal;
    const proEarnings = Number((subtotal - platformFee).toFixed(2));
    const deliveryDeadline = new Date(
      Date.now() + proposal.estimatedDays * 24 * 60 * 60 * 1000,
    );

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
          professionalProfileId: proposal.professionalProfileId,
          orderType: OrderType.LEAD_CONTRACT,
          quoteProposalId: proposal.id,
          serviceRequestId: proposal.serviceRequestId,
          status: OrderStatus.IN_PROGRESS,
          subtotal,
          platformFee,
          totalAmount,
          proEarnings,
          escrowStatus: EscrowStatus.HELD,
          deliveryDeadline,
        }),
      );

      await manager.update(QuoteProposal, proposal.id, {
        status: ProposalStatus.ACCEPTED,
      });
      await manager.update(ServiceRequest, proposal.serviceRequestId, {
        status: LeadStatus.FULFILLED,
      });

      const proUserId = proposal.professionalProfile?.userId;
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
          metadata: { sessionId, proposalId: proposal.id, orderNumber },
        }),
      );

      return order;
    });
  }

  async acceptProposalFromIap(
    userId: string,
    params: {
      proposalId: string;
      transactionId: string;
      platform: string;
      productId: string;
    },
  ) {
    const existingOrder = await this.orderRepo
      .createQueryBuilder('ord')
      .leftJoin('ledger_transactions', 'tx', 'tx.reference_id = ord.id')
      .where(`tx.metadata->>'iapTransactionId' = :txId`, {
        txId: params.transactionId,
      })
      .getOne();
    if (existingOrder) {
      return existingOrder;
    }

    const proposal = await this.proposalRepo.findOne({
      where: { id: params.proposalId },
      relations: { serviceRequest: true, professionalProfile: true },
    });
    if (!proposal || !proposal.serviceRequest) {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    if (proposal.serviceRequest.clientId !== userId) {
      throw new ForbiddenException(
        'Solo el cliente propietario de la solicitud puede aceptar presupuestos',
      );
    }
    const serviceRequestTitle = proposal.serviceRequest.title;

    const commissionRate =
      (this.configService.get<number>('business.platformCommission') ?? 15) /
      100;
    const subtotal = Number(proposal.price);
    const platformFee = Number((subtotal * commissionRate).toFixed(2));
    const totalAmount = subtotal;
    const proEarnings = Number((subtotal - platformFee).toFixed(2));
    const deliveryDeadline = new Date(
      Date.now() + proposal.estimatedDays * 24 * 60 * 60 * 1000,
    );

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
          professionalProfileId: proposal.professionalProfileId,
          orderType: OrderType.LEAD_CONTRACT,
          quoteProposalId: proposal.id,
          serviceRequestId: proposal.serviceRequestId,
          status: OrderStatus.IN_PROGRESS,
          subtotal,
          platformFee,
          totalAmount,
          proEarnings,
          escrowStatus: EscrowStatus.HELD,
          deliveryDeadline,
        }),
      );

      await manager.update(QuoteProposal, proposal.id, {
        status: ProposalStatus.ACCEPTED,
      });
      await manager.update(ServiceRequest, proposal.serviceRequestId, {
        status: LeadStatus.FULFILLED,
      });

      const proUserId = proposal.professionalProfile?.userId;
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
        if (existingConv) {
          await manager.update(Conversation, existingConv.id, {
            orderId: order.id,
          });
        } else {
          await manager.save(
            Conversation,
            manager.create(Conversation, {
              orderId: order.id,
              serviceRequestId: proposal.serviceRequestId,
              participantAId: userId,
              participantBId: proUserId,
            }),
          );
        }

        const notif = await manager.save(
          Notification,
          manager.create(Notification, {
            userId: proUserId,
            type: NotificationType.QUOTE_ACCEPTED,
            title: '¡Presupuesto aceptado!',
            message: `El cliente ha aceptado tu presupuesto para "${serviceRequestTitle}" (Pedido ${orderNumber}).`,
            link: `/request-detail?id=${proposal.serviceRequestId}`,
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
            proposalId: proposal.id,
            orderNumber,
          },
        }),
      );

      return order;
    });
  }

  async getRequestById(userId: string, requestId: string) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: {
        category: true,
        client: { profile: true },
        unlocks: true,
        proposals: {
          professionalProfile: {
            user: { profile: true },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    const viewerPro = await this.proRepo.findOne({ where: { userId } });
    const isUnlocked = Boolean(
      viewerPro &&
        request.unlocks?.some(
          (u) => u.professionalProfileId === viewerPro.id,
        ),
    );

    return {
      ...this.sanitizeRequestForViewer(request, userId, isUnlocked),
      isUnlocked,
    };
  }

  async deleteServiceRequest(userId: string, requestId: string) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    if (request.clientId !== userId) {
      throw new ForbiddenException(
        'Solo el propietario puede eliminar esta solicitud',
      );
    }

    const activeOrders = await this.orderRepo.count({
      where: {
        serviceRequestId: requestId,
        status: Not(OrderStatus.CANCELLED),
      },
    });
    if (activeOrders > 0) {
      throw new BadRequestException(
        'No se puede eliminar una solicitud que ya tiene un pedido formalizado',
      );
    }

    await this.requestRepo.remove(request);
    return { success: true, message: 'Solicitud eliminada correctamente' };
  }
}
