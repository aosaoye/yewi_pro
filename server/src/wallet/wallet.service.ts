import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { DataSource, Repository } from 'typeorm';
import { LedgerTransaction, Wallet } from '../database/entities';
import { TransactionStatus, TransactionType } from '../database/enums';
import {
  BuyCreditsDto,
  ConfirmCreditPaymentDto,
  CreateCreditPaymentIntentDto,
  CreditPack,
  RequestPayoutDto,
  TopupWalletDto,
} from './dto/buy-credits.dto';

export interface CreditPackageInfo {
  id: CreditPack;
  name: string;
  credits: number;
  priceEur: number;
  popular: boolean;
}

const CREDIT_PACKAGES: Record<CreditPack, CreditPackageInfo> = {
  [CreditPack.STARTER]: {
    id: CreditPack.STARTER,
    name: 'Pack Inicial',
    credits: 20,
    priceEur: 19,
    popular: false,
  },
  [CreditPack.PROFESSIONAL]: {
    id: CreditPack.PROFESSIONAL,
    name: 'Pack Profesional',
    credits: 50,
    priceEur: 45,
    popular: true,
  },
  [CreditPack.BUSINESS]: {
    id: CreditPack.BUSINESS,
    name: 'Pack Business',
    credits: 100,
    priceEur: 80,
    popular: false,
  },
  [CreditPack.ENTERPRISE]: {
    id: CreditPack.ENTERPRISE,
    name: 'Pack Enterprise',
    credits: 250,
    priceEur: 180,
    popular: false,
  },
};

@Injectable()
export class WalletService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(LedgerTransaction)
    private readonly ledgerRepo: Repository<LedgerTransaction>,
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

  getCreditPackages() {
    return Object.values(CREDIT_PACKAGES);
  }

  async getMyWallet(userId: string) {
    let wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      wallet = await this.walletRepo.save(
        this.walletRepo.create({
          userId,
          creditBalance: 0,
          fiatPendingBalance: 0,
          fiatAvailableBalance: 0,
          currency: 'EUR',
        }),
      );
    }

    const transactions = await this.ledgerRepo.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: 30,
    });

    return {
      ...wallet,
      transactions,
    };
  }

  async createCreditPaymentIntent(
    userId: string,
    dto: CreateCreditPaymentIntentDto,
  ) {
    const pkg = CREDIT_PACKAGES[dto.pack];
    if (!pkg) {
      throw new BadRequestException('Paquete de créditos inválido');
    }

    const stripe = this.ensureStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pkg.priceEur * 100),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId,
        paymentType: 'CREDIT_PURCHASE',
        pack: pkg.id,
        credits: String(pkg.credits),
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: pkg.priceEur,
      currency: 'EUR',
      credits: pkg.credits,
    };
  }

  async confirmCreditPayment(userId: string, dto: ConfirmCreditPaymentDto) {
    const stripe = this.ensureStripe();
    const pi = await stripe.paymentIntents.retrieve(dto.paymentIntentId);

    if (!pi) {
      throw new NotFoundException('PaymentIntent no encontrado en Stripe');
    }
    if (pi.metadata?.userId && pi.metadata.userId !== userId) {
      throw new ForbiddenException(
        'Este PaymentIntent no pertenece al usuario autenticado',
      );
    }
    if (pi.status !== 'succeeded') {
      throw new BadRequestException(
        `El pago no está completado (estado actual: ${pi.status})`,
      );
    }

    const packKey = pi.metadata?.pack as CreditPack | undefined;
    const pkg = packKey ? CREDIT_PACKAGES[packKey] : undefined;
    const credits =
      Number(pi.metadata?.credits || 0) || pkg?.credits || 0;
    const amountEur = Number((pi.amount_received || pi.amount) / 100);

    if (credits <= 0) {
      throw new BadRequestException(
        'No se pudo determinar la cantidad de créditos del pago',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(LedgerTransaction, {
        where: { stripePaymentIntentId: pi.id },
      });
      if (existing) {
        const wallet = await manager.findOne(Wallet, { where: { userId } });
        return {
          alreadyProcessed: true,
          wallet,
          transaction: existing,
        };
      }

      let wallet = await manager.findOne(Wallet, { where: { userId } });
      if (!wallet) {
        wallet = await manager.save(
          Wallet,
          manager.create(Wallet, {
            userId,
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
          creditBalance: () => `"credit_balance" + :credits`,
        })
        .where('id = :id', { id: wallet.id })
        .setParameter('credits', credits)
        .execute();

      const tx = await manager.save(
        LedgerTransaction,
        manager.create(LedgerTransaction, {
          walletId: wallet.id,
          type: TransactionType.CREDIT_PURCHASE,
          amount: amountEur,
          creditAmount: credits,
          currency: 'EUR',
          status: TransactionStatus.COMPLETED,
          stripePaymentIntentId: pi.id,
          metadata: { pack: packKey ?? 'CUSTOM', credits },
        }),
      );

      const updatedWallet = await manager.findOne(Wallet, {
        where: { id: wallet.id },
      });

      return {
        success: true,
        wallet: updatedWallet,
        transaction: tx,
      };
    });
  }

  async buyCredits(userId: string, dto: BuyCreditsDto) {
    return this.createCreditPaymentIntent(userId, { pack: dto.pack });
  }

  async createTopupCheckoutSession(userId: string, dto: TopupWalletDto) {
    if (dto.amount < 5) {
      throw new BadRequestException('El importe mínimo de recarga es de 5 €');
    }

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
              name: 'Recarga de Billetera Yewi',
              description: `Recarga de saldo disponible en Yewi (${dto.amount.toFixed(2)} EUR)`,
            },
            unit_amount: Math.round(dto.amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        paymentType: 'WALLET_TOPUP',
        amount: String(dto.amount),
      },
      success_url: `${publicAppUrl}/wallet?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicAppUrl}/wallet?topup=cancel`,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async creditFiatDeposit(params: {
    userId: string;
    amount: number;
    sessionId?: string;
    paymentIntentId?: string;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException('El importe de recarga debe ser positivo');
    }

    return this.dataSource.transaction(async (manager) => {
      if (params.paymentIntentId) {
        const existingByPi = await manager.findOne(LedgerTransaction, {
          where: { stripePaymentIntentId: params.paymentIntentId },
        });
        if (existingByPi) {
          return {
            success: true,
            alreadyProcessed: true,
            transactionId: existingByPi.id,
          };
        }
      }

      if (params.sessionId) {
        const existingBySession = await manager
          .createQueryBuilder(LedgerTransaction, 'tx')
          .where(`tx.metadata->>'sessionId' = :sessionId`, {
            sessionId: params.sessionId,
          })
          .getOne();
        if (existingBySession) {
          return {
            success: true,
            alreadyProcessed: true,
            transactionId: existingBySession.id,
          };
        }
      }

      let wallet = await manager.findOne(Wallet, {
        where: { userId: params.userId },
      });
      if (!wallet) {
        wallet = await manager.save(
          Wallet,
          manager.create(Wallet, {
            userId: params.userId,
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
          fiatAvailableBalance: () => `"fiat_available_balance" + :amount`,
        })
        .where('id = :id', { id: wallet.id })
        .setParameter('amount', params.amount)
        .execute();

      const tx = await manager.save(
        LedgerTransaction,
        manager.create(LedgerTransaction, {
          walletId: wallet.id,
          type: TransactionType.DEPOSIT,
          amount: params.amount,
          currency: 'EUR',
          status: TransactionStatus.COMPLETED,
          stripePaymentIntentId: params.paymentIntentId ?? null,
          referenceId: params.sessionId ?? params.paymentIntentId ?? null,
          metadata: {
            sessionId: params.sessionId ?? null,
            paymentType: 'WALLET_TOPUP',
          },
        }),
      );

      const updatedWallet = await manager.findOne(Wallet, {
        where: { id: wallet.id },
      });

      return {
        success: true,
        transactionId: tx.id,
        wallet: updatedWallet,
      };
    });
  }

  async requestPayout(userId: string, dto: RequestPayoutDto) {
    if (dto.amount < 20) {
      throw new BadRequestException(
        'El importe mínimo de retiro es de 20,00 €',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, { where: { userId } });
      if (!wallet) {
        throw new NotFoundException('Billetera no encontrada');
      }

      const updateResult = await manager
        .createQueryBuilder()
        .update(Wallet)
        .set({
          fiatAvailableBalance: () => `"fiat_available_balance" - :amount`,
        })
        .where('id = :id AND fiat_available_balance >= :amount', {
          id: wallet.id,
          amount: dto.amount,
        })
        .execute();

      if (!updateResult.affected || updateResult.affected === 0) {
        throw new BadRequestException(
          'Saldo disponible insuficiente para realizar este retiro',
        );
      }

      const tx = await manager.save(
        LedgerTransaction,
        manager.create(LedgerTransaction, {
          walletId: wallet.id,
          type: TransactionType.PAYOUT_WITHDRAWAL,
          amount: dto.amount,
          currency: 'EUR',
          status: TransactionStatus.PENDING,
          metadata: {
            destinationAccount: dto.destinationAccount.trim(),
          },
        }),
      );

      return {
        success: true,
        message: 'Solicitud de retiro registrada y en revisión financiera',
        transaction: tx,
      };
    });
  }
}
