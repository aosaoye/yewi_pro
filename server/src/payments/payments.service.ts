import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { DataSource } from 'typeorm';
import { RedisCacheService } from '../common/cache/redis.service';
import {
  LedgerTransaction,
  ProfessionalProfile,
  QuoteProposal,
  Subscription,
  User,
} from '../database/entities';
import { SubscriptionStatus } from '../database/enums';
import { LeadsService } from '../leads/leads.service';
import { OrdersService } from '../orders/orders.service';
import { WalletService } from '../wallet/wallet.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateRedsysBizumCheckoutDto } from './dto/redsys-bizum.dto';
import {
  RestoreIapPurchasesDto,
  VerifyIapPurchaseDto,
} from './dto/verify-iap.dto';
import {
  createRedsysSignature,
  decodeMerchantParameters,
  encodeMerchantParameters,
  escapeHtml,
  generateRedsysOrderRef,
  getRedsysEndpoint,
  verifyRedsysSignature,
} from './redsys.utils';

export interface IapProductDefinition {
  productId: string;
  purchaseType: 'SUBSCRIPTION' | 'WALLET_TOPUP' | 'GIG_ORDER' | 'LEAD_PROPOSAL';
  title: string;
  priceEur?: number;
  amountEur?: number;
  interval?: 'month';
}

const IAP_CATALOG: IapProductDefinition[] = [
  {
    productId: 'yewi_pro_monthly',
    purchaseType: 'SUBSCRIPTION',
    title: 'Suscripción mensual Yewi Pro',
    priceEur: 15.99,
    interval: 'month',
  },
  {
    productId: 'yewi_wallet_20',
    purchaseType: 'WALLET_TOPUP',
    title: 'Recarga de saldo 20 €',
    priceEur: 20,
    amountEur: 20,
  },
  {
    productId: 'yewi_wallet_50',
    purchaseType: 'WALLET_TOPUP',
    title: 'Recarga de saldo 50 €',
    priceEur: 50,
    amountEur: 50,
  },
  {
    productId: 'yewi_wallet_100',
    purchaseType: 'WALLET_TOPUP',
    title: 'Recarga de saldo 100 €',
    priceEur: 100,
    amountEur: 100,
  },
  {
    productId: 'yewi_service_order',
    purchaseType: 'GIG_ORDER',
    title: 'Contratación de servicio o presupuesto',
  },
];

export interface RedsysSessionRecord {
  orderRef: string;
  userId: string;
  purchaseType: 'GIG_ORDER' | 'LEAD_PROPOSAL';
  amount: number;
  gigId?: string;
  gigPackageId?: string;
  extraIds?: string[];
  proposalId?: string;
  redsysUrl: string;
  dsSignatureVersion: string;
  dsMerchantParameters: string;
  dsSignature: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  orderId?: string;
  orderNumber?: string;
  errorMessage?: string;
  createdAt: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;
  private readonly processedWebhookEvents = new Set<string>();
  private readonly processedIapTransactions = new Map<string, unknown>();
  private readonly redsysSessions = new Map<string, RedsysSessionRecord>();

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly walletService: WalletService,
    private readonly leadsService: LeadsService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey && secretKey.trim() !== '') {
      this.stripe = new Stripe(secretKey);
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

  private mapStripeSubscriptionStatus(status: string): SubscriptionStatus {
    const normalized = status.toUpperCase();
    if (normalized in SubscriptionStatus) {
      return normalized as SubscriptionStatus;
    }
    return SubscriptionStatus.INCOMPLETE;
  }

  async createPaymentIntent(userId: string, dto: CreatePaymentIntentDto) {
    const stripe = this.ensureStripe();
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(dto.amount * 100),
      currency: (dto.currency || 'EUR').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId,
        paymentType: dto.paymentType || 'GENERIC',
        referenceId: dto.referenceId || '',
      },
    });

    return {
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      amount: dto.amount,
      currency: dto.currency || 'EUR',
    };
  }

  async verifyPaymentIntent(
    paymentIntentId: string,
    userId: string,
    expectedAmount?: number,
  ) {
    const stripe = this.ensureStripe();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!pi) {
      throw new BadRequestException('PaymentIntent no encontrado');
    }
    if (pi.metadata?.userId && pi.metadata.userId !== userId) {
      throw new ForbiddenException('Este PaymentIntent pertenece a otro usuario');
    }
    if (pi.status !== 'succeeded') {
      throw new BadRequestException(
        `El pago no fue completado (estado: ${pi.status})`,
      );
    }
    const paidAmount = Number((pi.amount_received || pi.amount) / 100);
    if (expectedAmount !== undefined && paidAmount < expectedAmount) {
      throw new BadRequestException(
        'El importe cobrado en Stripe es inferior al requerido',
      );
    }
    return {
      verified: true,
      paymentIntentId: pi.id,
      amount: paidAmount,
    };
  }

  async getSubscriptionStatus(userId: string) {
    const userRepo = this.dataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: {
        subscription: true,
        professionalProfile: true,
      },
    });

    const sub = user?.subscription ?? null;
    const isPro = Boolean(
      user?.isPro ||
        user?.professionalProfile?.isPro ||
        sub?.status === SubscriptionStatus.ACTIVE ||
        sub?.status === SubscriptionStatus.TRIALING,
    );

    return {
      isPro,
      plan: 'PRO',
      priceEur: 15.99,
      interval: 'month',
      paymentMethod: null,
      subscription: sub,
    };
  }

  private async upsertUserProSubscription(params: {
    userId: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    status: SubscriptionStatus;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
  }) {
    const isActivePro =
      params.status === SubscriptionStatus.ACTIVE ||
      params.status === SubscriptionStatus.TRIALING;

    await this.dataSource.transaction(async (manager) => {
      let sub = await manager.findOne(Subscription, {
        where: { userId: params.userId },
      });

      if (!sub) {
        sub = manager.create(Subscription, {
          userId: params.userId,
          stripeCustomerId: params.stripeCustomerId ?? null,
          stripeSubscriptionId: params.stripeSubscriptionId ?? null,
          stripePriceId: params.stripePriceId ?? null,
          status: params.status,
          currentPeriodStart: params.currentPeriodStart ?? null,
          currentPeriodEnd: params.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
          canceledAt: params.canceledAt ?? null,
        });
      } else {
        if (params.stripeCustomerId !== undefined) {
          sub.stripeCustomerId = params.stripeCustomerId;
        }
        if (params.stripeSubscriptionId !== undefined) {
          sub.stripeSubscriptionId = params.stripeSubscriptionId;
        }
        if (params.stripePriceId !== undefined) {
          sub.stripePriceId = params.stripePriceId;
        }
        sub.status = params.status;
        if (params.currentPeriodStart !== undefined) {
          sub.currentPeriodStart = params.currentPeriodStart;
        }
        if (params.currentPeriodEnd !== undefined) {
          sub.currentPeriodEnd = params.currentPeriodEnd;
        }
        if (params.cancelAtPeriodEnd !== undefined) {
          sub.cancelAtPeriodEnd = params.cancelAtPeriodEnd;
        }
        if (params.canceledAt !== undefined) {
          sub.canceledAt = params.canceledAt;
        }
      }

      await manager.save(Subscription, sub);
      await manager.update(User, params.userId, { isPro: isActivePro });
      await manager.update(
        ProfessionalProfile,
        { userId: params.userId },
        { isPro: isActivePro },
      );
    });

    return this.getSubscriptionStatus(params.userId);
  }

  async syncSubscriptionWithStripe(userId: string) {
    const stripe = this.ensureStripe();
    const subRepo = this.dataSource.getRepository(Subscription);
    const localSub = await subRepo.findOne({ where: { userId } });

    if (!localSub?.stripeCustomerId && !localSub?.stripeSubscriptionId) {
      return this.getSubscriptionStatus(userId);
    }

    let stripeSub: Stripe.Subscription | null = null;
    if (localSub.stripeSubscriptionId) {
      stripeSub = await stripe.subscriptions.retrieve(
        localSub.stripeSubscriptionId,
      );
    } else if (localSub.stripeCustomerId) {
      const list = await stripe.subscriptions.list({
        customer: localSub.stripeCustomerId,
        limit: 1,
      });
      stripeSub = list.data[0] ?? null;
    }

    if (!stripeSub) {
      return this.getSubscriptionStatus(userId);
    }

    const periodStart = stripeSub.items?.data?.[0]?.current_period_start;
    const periodEnd = stripeSub.items?.data?.[0]?.current_period_end;

    return this.upsertUserProSubscription({
      userId,
      stripeCustomerId:
        typeof stripeSub.customer === 'string'
          ? stripeSub.customer
          : stripeSub.customer?.id,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: stripeSub.items?.data?.[0]?.price?.id ?? null,
      status: this.mapStripeSubscriptionStatus(stripeSub.status),
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      canceledAt: stripeSub.canceled_at
        ? new Date(stripeSub.canceled_at * 1000)
        : null,
    });
  }

  async cancelSubscriptionAutoRenew(userId: string) {
    const sub = await this.dataSource
      .getRepository(Subscription)
      .findOne({ where: { userId } });

    if (!sub?.stripeSubscriptionId) {
      throw new BadRequestException(
        'No tienes una suscripción Yewi Pro activa para cancelar',
      );
    }

    if (sub.stripeSubscriptionId.startsWith('iap:')) {
      const state = await this.upsertUserProSubscription({
        userId,
        status: sub.status,
        cancelAtPeriodEnd: true,
      });
      return {
        ...state,
        success: true,
        message:
          'Renovación marcada como cancelada. Gestiona la baja definitiva desde App Store o Google Play.',
        cancelAtPeriodEnd: true,
      };
    }

    const stripe = this.ensureStripe();
    const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const state = await this.upsertUserProSubscription({
      userId,
      status: this.mapStripeSubscriptionStatus(updated.status),
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    });
    return {
      ...state,
      success: true,
      message: 'Renovación automática cancelada al final del periodo actual',
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    };
  }

  async resumeSubscriptionAutoRenew(userId: string) {
    const sub = await this.dataSource
      .getRepository(Subscription)
      .findOne({ where: { userId } });

    if (!sub?.stripeSubscriptionId) {
      throw new BadRequestException(
        'No tienes una suscripción Yewi Pro para reanudar',
      );
    }

    if (sub.stripeSubscriptionId.startsWith('iap:')) {
      const state = await this.upsertUserProSubscription({
        userId,
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
      });
      return {
        ...state,
        success: true,
        message:
          'Renovación reactivada. Confirma tu suscripción en App Store o Google Play.',
        cancelAtPeriodEnd: false,
      };
    }

    const stripe = this.ensureStripe();
    const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    const state = await this.upsertUserProSubscription({
      userId,
      status: this.mapStripeSubscriptionStatus(updated.status),
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    });
    return {
      ...state,
      success: true,
      message: 'Renovación automática reactivada',
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    };
  }

  getIapCatalog() {
    return { products: IAP_CATALOG };
  }

  private async verifyStoreReceipt(dto: VerifyIapPurchaseDto): Promise<void> {
    const cleanReceipt = dto.receiptData?.trim();
    const cleanTx = dto.transactionId?.trim();
    if (!cleanReceipt || cleanReceipt.length < 8 || !cleanTx) {
      throw new BadRequestException(
        'El recibo de compra integrada (In-App Purchase) no es válido.',
      );
    }

    const isProd = this.configService.get<string>('nodeEnv') === 'production';
    if (!isProd) {
      return;
    }

    if (dto.platform === 'ios') {
      const sharedSecret =
        this.configService.get<string>('APPLE_IAP_SHARED_SECRET') || '';
      const hasAppleCreds = Boolean(
        sharedSecret ||
          this.configService.get<string>('APPLE_IAP_ISSUER_ID'),
      );
      if (!hasAppleCreds) {
        throw new ServiceUnavailableException(
          'Verificación de App Store no configurada en producción',
        );
      }
      if (sharedSecret) {
        const res = await fetch(
          'https://buy.itunes.apple.com/verifyReceipt',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'receipt-data': cleanReceipt,
              password: sharedSecret,
              'exclude-old-transactions': true,
            }),
          },
        );
        const json = (await res.json()) as { status?: number };
        if (json.status === 21007) {
          const sandboxRes = await fetch(
            'https://sandbox.itunes.apple.com/verifyReceipt',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                'receipt-data': cleanReceipt,
                password: sharedSecret,
                'exclude-old-transactions': true,
              }),
            },
          );
          const sandboxJson = (await sandboxRes.json()) as { status?: number };
          if (sandboxJson.status !== 0) {
            throw new BadRequestException(
              `Recibo Apple rechazado (código ${sandboxJson.status})`,
            );
          }
        } else if (json.status !== 0) {
          throw new BadRequestException(
            `Recibo Apple rechazado (código ${json.status})`,
          );
        }
      }
    } else if (dto.platform === 'android') {
      const hasPlayCreds = Boolean(
        this.configService.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),
      );
      if (!hasPlayCreds) {
        throw new ServiceUnavailableException(
          'Verificación de Google Play Billing no configurada en producción',
        );
      }
    }
  }

  async verifyAndFulfillIapPurchase(
    userId: string,
    dto: VerifyIapPurchaseDto,
  ) {
    await this.verifyStoreReceipt(dto);

    const txKey = `${dto.platform}:${dto.transactionId.trim()}`;
    if (this.processedIapTransactions.has(txKey)) {
      return {
        verified: true,
        duplicate: true,
        result: this.processedIapTransactions.get(txKey),
      };
    }

    const cacheKey = `iap:tx:${txKey}`;
    if (this.redisCache) {
      const cached = await this.redisCache.get<Record<string, unknown>>(cacheKey);
      if (cached) {
        return { verified: true, duplicate: true, result: cached.result };
      }
    }

    const existingLedger = await this.dataSource
      .getRepository(LedgerTransaction)
      .createQueryBuilder('tx')
      .where(
        `tx.metadata->>'iapTransactionId' = :txId OR tx.metadata->>'sessionId' = :sessionKey`,
        {
          txId: dto.transactionId.trim(),
          sessionKey: `iap:${dto.transactionId.trim()}`,
        },
      )
      .getOne();
    if (existingLedger) {
      return {
        verified: true,
        duplicate: true,
        transactionId: existingLedger.id,
        referenceId: existingLedger.referenceId,
      };
    }

    let result: unknown;
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (dto.purchaseType === 'SUBSCRIPTION') {
      const iapSubId = `iap:${dto.platform}:${dto.transactionId.trim()}`;
      const existingSub = await this.dataSource
        .getRepository(Subscription)
        .findOne({ where: { stripeSubscriptionId: iapSubId } });
      if (existingSub && existingSub.userId !== userId) {
        throw new ForbiddenException(
          'Esta transacción ya está asociada a otra cuenta',
        );
      }
      result = await this.upsertUserProSubscription({
        userId,
        stripeSubscriptionId: iapSubId,
        stripePriceId: dto.productId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        cancelAtPeriodEnd: false,
      });
    } else if (dto.purchaseType === 'WALLET_TOPUP') {
      const catalogItem = IAP_CATALOG.find(
        (p) => p.productId === dto.productId && p.purchaseType === 'WALLET_TOPUP',
      );
      const amount = Number(dto.amount ?? catalogItem?.amountEur ?? 0);
      if (!Number.isFinite(amount) || amount < 5) {
        throw new BadRequestException('Importe de recarga IAP no válido');
      }
      result = await this.walletService.creditFiatDeposit({
        userId,
        amount,
        sessionId: `iap:${dto.transactionId.trim()}`,
      });
    } else if (dto.purchaseType === 'GIG_ORDER') {
      if (!dto.gigPackageId) {
        throw new BadRequestException(
          'Falta gigPackageId para completar la compra integrada',
        );
      }
      result = await this.ordersService.createGigOrderFromIap(userId, {
        gigPackageId: dto.gigPackageId,
        gigId: dto.gigId,
        extraIds: dto.extraIds,
        transactionId: dto.transactionId.trim(),
        platform: dto.platform,
        productId: dto.productId,
      });
    } else if (dto.purchaseType === 'LEAD_PROPOSAL') {
      if (!dto.proposalId) {
        throw new BadRequestException(
          'Falta proposalId para aceptar el presupuesto',
        );
      }
      result = await this.leadsService.acceptProposalFromIap(userId, {
        proposalId: dto.proposalId,
        transactionId: dto.transactionId.trim(),
        platform: dto.platform,
        productId: dto.productId,
      });
    } else {
      throw new BadRequestException('Tipo de compra IAP no soportado');
    }

    this.processedIapTransactions.set(txKey, result);
    if (this.redisCache) {
      await this.redisCache.set(cacheKey, { result }, 86400);
    }

    return {
      verified: true,
      duplicate: false,
      result,
    };
  }

  async restoreIapPurchases(userId: string, dto?: RestoreIapPurchasesDto) {
    const receipts = dto?.receipts ?? [];
    for (const item of receipts) {
      if (item.purchaseType === 'SUBSCRIPTION') {
        await this.verifyAndFulfillIapPurchase(userId, item);
      }
    }
    return this.getSubscriptionStatus(userId);
  }

  async createSubscriptionCheckout(userId: string) {
    const stripe = this.ensureStripe();
    const userRepo = this.dataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: { subscription: true, profile: true },
    });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    let customerId = user.subscription?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.profile?.displayName || user.email,
        metadata: { userId },
      });
      customerId = customer.id;
    }

    const priceId = this.configService.get<string>('STRIPE_PRO_PRICE_ID');
    const publicAppUrl =
      this.configService.get<string>('PUBLIC_APP_URL') || 'https://yewi.app';

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Yewi Pro',
              description:
                'Acceso ilimitado a oportunidades, Estados 24h y Generador IA de Presupuestos',
            },
            unit_amount: 1599,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [lineItem],
      metadata: {
        userId,
        paymentType: 'PRO_SUBSCRIPTION',
      },
      success_url: `${publicAppUrl}/profile?pro=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicAppUrl}/profile?pro=cancel`,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async createCustomerPortalSession(userId: string) {
    const stripe = this.ensureStripe();
    const sub = await this.dataSource
      .getRepository(Subscription)
      .findOne({ where: { userId } });

    if (!sub?.stripeCustomerId) {
      throw new BadRequestException(
        'No existe un cliente de facturación en Stripe para tu cuenta',
      );
    }

    const publicAppUrl =
      this.configService.get<string>('PUBLIC_APP_URL') || 'https://yewi.app';
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${publicAppUrl}/profile`,
    });

    return { url: portal.url };
  }

  async handleWebhook(signature: string, payload: Buffer) {
    const stripe = this.ensureStripe();
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'STRIPE_WEBHOOK_SECRET no configurado en el servidor',
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(
        `Firma de Webhook inválida: ${(err as Error).message}`,
      );
    }

    const cacheKey = `stripe:webhook:${event.id}`;
    if (this.processedWebhookEvents.has(event.id)) {
      return { received: true, duplicated: true };
    }
    if (this.redisCache) {
      const alreadySeen = await this.redisCache.get<{ processed: boolean }>(
        cacheKey,
      );
      if (alreadySeen?.processed) {
        return { received: true, duplicated: true };
      }
    }

    const lockResource = `stripe:event:${event.id}`;
    const lockToken = this.redisCache
      ? await this.redisCache.acquireLock(lockResource, 30)
      : null;

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata ?? {};
        const paymentType = metadata.paymentType;
        const userId = metadata.userId;

        if (paymentType === 'WALLET_TOPUP' && userId) {
          const amount =
            Number(metadata.amount) ||
            Number((session.amount_total ?? 0) / 100);
          await this.walletService.creditFiatDeposit({
            userId,
            amount,
            sessionId: session.id,
            paymentIntentId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : undefined,
          });
        } else if (paymentType === 'GIG_PURCHASE' && userId) {
          await this.ordersService.confirmGigCheckoutSession(
            userId,
            session.id,
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : undefined,
          );
        } else if (paymentType === 'LEAD_CONTRACT' && userId) {
          await this.leadsService.confirmLeadCheckoutSession(
            userId,
            session.id,
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : undefined,
          );
        } else if (paymentType === 'PRO_SUBSCRIPTION' && userId) {
          await this.upsertUserProSubscription({
            userId,
            stripeCustomerId:
              typeof session.customer === 'string'
                ? session.customer
                : session.customer?.id ?? null,
            stripeSubscriptionId:
              typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id ?? null,
            status: SubscriptionStatus.ACTIVE,
            cancelAtPeriodEnd: false,
          });
        }
      } else if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        const sub = event.data.object;
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const localSub = await this.dataSource
          .getRepository(Subscription)
          .findOne({
            where: [
              { stripeSubscriptionId: sub.id },
              ...(customerId ? [{ stripeCustomerId: customerId }] : []),
            ],
          });

        if (localSub) {
          const periodStart = sub.items?.data?.[0]?.current_period_start;
          const periodEnd = sub.items?.data?.[0]?.current_period_end;
          await this.upsertUserProSubscription({
            userId: localSub.userId,
            stripeCustomerId: customerId ?? null,
            stripeSubscriptionId: sub.id,
            stripePriceId: sub.items?.data?.[0]?.price?.id ?? null,
            status: this.mapStripeSubscriptionStatus(sub.status),
            currentPeriodStart: periodStart
              ? new Date(periodStart * 1000)
              : null,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            canceledAt: sub.canceled_at
              ? new Date(sub.canceled_at * 1000)
              : null,
          });
        }
      }

      this.processedWebhookEvents.add(event.id);
      if (this.redisCache) {
        await this.redisCache.set(cacheKey, { processed: true }, 86400);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(
        `Error procesando webhook Stripe ${event.id}: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      if (this.redisCache && lockToken) {
        await this.redisCache.releaseLock(lockResource, lockToken);
      }
    }
  }

  private getRedsysConfig() {
    const merchantCode =
      this.configService.get<string>('REDSYS_MERCHANT_CODE')?.trim() || '';
    const secretKey =
      this.configService.get<string>('REDSYS_SECRET_KEY')?.trim() || '';
    const terminal =
      this.configService.get<string>('REDSYS_TERMINAL')?.trim() || '001';
    const env =
      this.configService.get<string>('REDSYS_ENV')?.trim() || 'test';
    const configuredApiUrl =
      this.configService.get<string>('API_PUBLIC_URL')?.trim() || '';

    if (!merchantCode || !secretKey) {
      throw new ServiceUnavailableException(
        'Pasarela Redsys Bizum no configurada en el servidor (faltan REDSYS_MERCHANT_CODE / REDSYS_SECRET_KEY)',
      );
    }

    return {
      merchantCode,
      secretKey,
      terminal,
      redsysUrl: getRedsysEndpoint(env),
      configuredApiUrl,
    };
  }

  private async saveRedsysSession(record: RedsysSessionRecord): Promise<void> {
    this.redsysSessions.set(record.orderRef, record);
    if (this.redisCache) {
      await this.redisCache.set(
        `redsys:session:${record.orderRef}`,
        record,
        1800,
      );
    }
  }

  private async getRedsysSession(
    orderRef: string,
  ): Promise<RedsysSessionRecord | null> {
    if (this.redisCache) {
      const cached = await this.redisCache.get<RedsysSessionRecord>(
        `redsys:session:${orderRef}`,
      );
      if (cached) {
        this.redsysSessions.set(orderRef, cached);
        return cached;
      }
    }
    return this.redsysSessions.get(orderRef) ?? null;
  }

  async createRedsysBizumCheckout(
    userId: string,
    dto: CreateRedsysBizumCheckoutDto,
    requestApiBaseUrl: string,
  ) {
    const cfg = this.getRedsysConfig();
    const apiBase = (cfg.configuredApiUrl || requestApiBaseUrl).replace(
      /\/+$/,
      '',
    );

    let amount = 0;
    let description = 'Servicio Yewi';

    if (dto.purchaseType === 'GIG_ORDER') {
      if (!dto.gigPackageId) {
        throw new BadRequestException(
          'Falta gigPackageId para iniciar el pago con Bizum',
        );
      }
      const quote = await this.ordersService.resolveGigPackageAndTotals(userId, {
        gigPackageId: dto.gigPackageId,
        gigId: dto.gigId,
        extraIds: dto.extraIds,
      });
      amount = Number(quote.totalAmount);
      description = `Servicio ${quote.gig.title}`.slice(0, 125);
    } else if (dto.purchaseType === 'LEAD_PROPOSAL') {
      if (!dto.proposalId) {
        throw new BadRequestException(
          'Falta proposalId para iniciar el pago con Bizum',
        );
      }
      const proposal = await this.dataSource
        .getRepository(QuoteProposal)
        .findOne({
          where: { id: dto.proposalId },
          relations: { serviceRequest: true },
        });
      if (!proposal || !proposal.serviceRequest) {
        throw new NotFoundException('Presupuesto no encontrado');
      }
      if (proposal.serviceRequest.clientId !== userId) {
        throw new ForbiddenException(
          'Solo el cliente propietario de la solicitud puede pagar este presupuesto',
        );
      }
      amount = Number(proposal.price);
      description = `Presupuesto ${proposal.serviceRequest.title}`.slice(0, 125);
    } else {
      throw new BadRequestException('Tipo de compra no soportado para Bizum');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Importe inválido para pago con Bizum');
    }

    const orderRef = generateRedsysOrderRef();
    const amountCents = String(Math.round(amount * 100));

    const merchantParams: Record<string, string> = {
      DS_MERCHANT_AMOUNT: amountCents,
      DS_MERCHANT_ORDER: orderRef,
      DS_MERCHANT_MERCHANTCODE: cfg.merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: cfg.terminal,
      DS_MERCHANT_PAYMETHODS: 'z',
      DS_MERCHANT_PRODUCTDESCRIPTION: description,
      DS_MERCHANT_MERCHANTURL: `${apiBase}/api/v1/payments/redsys/notify`,
      DS_MERCHANT_URLOK: `${apiBase}/api/v1/payments/redsys/return?result=ok&order=${encodeURIComponent(orderRef)}`,
      DS_MERCHANT_URLKO: `${apiBase}/api/v1/payments/redsys/return?result=ko&order=${encodeURIComponent(orderRef)}`,
      DS_MERCHANT_MERCHANTDATA: orderRef,
    };

    const dsMerchantParameters = encodeMerchantParameters(merchantParams);
    const dsSignature = createRedsysSignature(
      dsMerchantParameters,
      orderRef,
      cfg.secretKey,
    );

    const record: RedsysSessionRecord = {
      orderRef,
      userId,
      purchaseType: dto.purchaseType,
      amount,
      gigId: dto.gigId,
      gigPackageId: dto.gigPackageId,
      extraIds: dto.extraIds,
      proposalId: dto.proposalId,
      redsysUrl: cfg.redsysUrl,
      dsSignatureVersion: 'HMAC_SHA256_V1',
      dsMerchantParameters,
      dsSignature,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    await this.saveRedsysSession(record);

    return {
      orderRef,
      amount,
      launchUrl: `${apiBase}/api/v1/payments/redsys/redirect/${encodeURIComponent(orderRef)}`,
      redsysUrl: cfg.redsysUrl,
    };
  }

  async getRedsysRedirectHtml(orderRef: string): Promise<string> {
    const session = await this.getRedsysSession(orderRef);
    if (!session) {
      throw new NotFoundException(
        'Sesión de pago Redsys Bizum no encontrada o expirada',
      );
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redirigiendo a Bizum...</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; background: #ffffff; color: #0f172a; }
    .box { text-align: center; padding: 24px; max-width: 340px; }
    .btn { margin-top: 16px; background: #00B4D8; color: #fff; border: 0; border-radius: 9999px; padding: 12px 20px; font-weight: 600; font-size: 15px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="box">
    <h3>Conectando con Bizum (Redsys)</h3>
    <p>Un momento, te estamos redirigiendo a la pasarela segura de tu banco...</p>
    <form id="redsysForm" method="POST" action="${escapeHtml(session.redsysUrl)}">
      <input type="hidden" name="Ds_SignatureVersion" value="${escapeHtml(session.dsSignatureVersion)}" />
      <input type="hidden" name="Ds_MerchantParameters" value="${escapeHtml(session.dsMerchantParameters)}" />
      <input type="hidden" name="Ds_Signature" value="${escapeHtml(session.dsSignature)}" />
      <button type="submit" class="btn">Continuar a Bizum</button>
    </form>
  </div>
  <script>document.getElementById('redsysForm').submit();</script>
</body>
</html>`;
  }

  async handleRedsysNotification(payload: {
    Ds_SignatureVersion?: string;
    Ds_MerchantParameters?: string;
    Ds_Signature?: string;
  }) {
    const cfg = this.getRedsysConfig();
    const paramsB64 = payload.Ds_MerchantParameters?.trim() || '';
    const signature = payload.Ds_Signature?.trim() || '';

    if (!paramsB64 || !signature) {
      throw new BadRequestException('Notificación Redsys incompleta');
    }

    const valid = verifyRedsysSignature(paramsB64, signature, cfg.secretKey);
    if (!valid) {
      throw new BadRequestException('Firma Redsys inválida');
    }

    const decoded = decodeMerchantParameters(paramsB64);
    const orderRef = (decoded.Ds_Order || decoded.Ds_MerchantData || '').trim();
    const responseCode = parseInt(decoded.Ds_Response || '9999', 10);

    if (!orderRef) {
      throw new BadRequestException('Referencia de pedido Redsys ausente');
    }

    const session = await this.getRedsysSession(orderRef);
    if (!session) {
      this.logger.warn(
        `Notificación Redsys recibida para pedido desconocido: ${orderRef}`,
      );
      return { received: true, unknownOrder: true };
    }

    if (session.status === 'PAID' && session.orderId) {
      return { received: true, duplicated: true, orderId: session.orderId };
    }

    const lockResource = `redsys:notify:${orderRef}`;
    const lockToken = this.redisCache
      ? await this.redisCache.acquireLock(lockResource, 30)
      : null;

    try {
      const latest = (await this.getRedsysSession(orderRef)) ?? session;
      if (latest.status === 'PAID' && latest.orderId) {
        return { received: true, duplicated: true, orderId: latest.orderId };
      }

      if (!Number.isFinite(responseCode) || responseCode < 0 || responseCode > 99) {
        latest.status = 'FAILED';
        latest.errorMessage = `Pago Bizum rechazado o cancelado (código Redsys ${decoded.Ds_Response || 'N/A'})`;
        await this.saveRedsysSession(latest);
        return { received: true, authorized: false };
      }

      const txId = `redsys:${orderRef}`;
      let order: { id: string; orderNumber: string };

      if (latest.purchaseType === 'GIG_ORDER') {
        if (!latest.gigPackageId) {
          throw new BadRequestException('Falta gigPackageId en sesión Redsys');
        }
        order = await this.ordersService.createGigOrderFromIap(latest.userId, {
          gigPackageId: latest.gigPackageId,
          gigId: latest.gigId,
          extraIds: latest.extraIds,
          transactionId: txId,
          platform: 'redsys_bizum',
          productId: 'bizum',
        });
      } else {
        if (!latest.proposalId) {
          throw new BadRequestException('Falta proposalId en sesión Redsys');
        }
        order = await this.leadsService.acceptProposalFromIap(latest.userId, {
          proposalId: latest.proposalId,
          transactionId: txId,
          platform: 'redsys_bizum',
          productId: 'bizum',
        });
      }

      latest.status = 'PAID';
      latest.orderId = order.id;
      latest.orderNumber = order.orderNumber;
      await this.saveRedsysSession(latest);

      return {
        received: true,
        authorized: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
      };
    } finally {
      if (this.redisCache && lockToken) {
        await this.redisCache.releaseLock(lockResource, lockToken);
      }
    }
  }

  buildRedsysReturnHtml(result?: string, orderRef?: string): string {
    const safeResult = result === 'ok' ? 'ok' : 'ko';
    const deepLink = `yewi://payment-return?result=${encodeURIComponent(safeResult)}${
      orderRef ? `&order=${encodeURIComponent(orderRef)}` : ''
    }`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Volviendo a Yewi...</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; background: #ffffff; color: #0f172a; }
    .box { text-align: center; padding: 24px; max-width: 340px; }
    .btn { display: inline-block; margin-top: 16px; background: #00B4D8; color: #fff; text-decoration: none; border-radius: 9999px; padding: 12px 22px; font-weight: 600; font-size: 15px; }
  </style>
</head>
<body>
  <div class="box">
    <h3>${safeResult === 'ok' ? 'Pago Bizum completado' : 'Pago no completado'}</h3>
    <p>Volviendo a Yewi...</p>
    <a class="btn" href="${escapeHtml(deepLink)}">Volver a la app</a>
  </div>
  <script>window.location.replace(${JSON.stringify(deepLink)});</script>
</body>
</html>`;
  }

  async getRedsysOrderStatus(userId: string, orderRef: string) {
    const session = await this.getRedsysSession(orderRef);
    if (!session) {
      throw new NotFoundException('Sesión de pago Redsys no encontrada');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para consultar este pago');
    }
    return {
      orderRef: session.orderRef,
      status: session.status,
      amount: session.amount,
      orderId: session.orderId,
      orderNumber: session.orderNumber,
      errorMessage: session.errorMessage,
    };
  }
}
