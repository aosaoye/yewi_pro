import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { RealtimeService } from '../common/realtime/realtime.service';
import {
  LedgerTransaction,
  Notification,
  Order,
  OrderDispute,
  ProfessionalProfile,
  User,
  Wallet,
} from '../database/entities';
import {
  EscrowStatus,
  KycStatus,
  NotificationType,
  OrderStatus,
  TransactionStatus,
  TransactionType,
} from '../database/enums';
import { ResolveDisputeDto, ReviewKycDto } from './dto/review-kyc.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ProfessionalProfile)
    private readonly proRepo: Repository<ProfessionalProfile>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderDispute)
    private readonly disputeRepo: Repository<OrderDispute>,
    @InjectRepository(LedgerTransaction)
    private readonly ledgerRepo: Repository<LedgerTransaction>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalProfessionals,
      totalOrders,
      completedOrders,
      openDisputes,
      pendingKycCount,
      pendingPayoutsCount,
    ] = await Promise.all([
      this.userRepo.count({ where: { isActive: true } }),
      this.proRepo.count(),
      this.orderRepo.count(),
      this.orderRepo.count({ where: { status: OrderStatus.COMPLETED } }),
      this.disputeRepo.count({ where: { status: 'OPEN' } }),
      this.proRepo.count({ where: { kycStatus: KycStatus.PENDING_REVIEW } }),
      this.ledgerRepo.count({
        where: {
          type: TransactionType.PAYOUT_WITHDRAWAL,
          status: TransactionStatus.PENDING,
        },
      }),
    ]);

    const gmvRow = await this.orderRepo
      .createQueryBuilder('ord')
      .select('COALESCE(SUM(ord.total_amount), 0)', 'gmv')
      .where('ord.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .getRawOne<{ gmv: string }>();

    const revenueRow = await this.orderRepo
      .createQueryBuilder('ord')
      .select('COALESCE(SUM(ord.platform_fee), 0)', 'revenue')
      .where('ord.status = :completed', { completed: OrderStatus.COMPLETED })
      .getRawOne<{ revenue: string }>();

    return {
      totalUsers,
      totalProfessionals,
      totalOrders,
      completedOrders,
      openDisputes,
      pendingKycCount,
      pendingPayoutsCount,
      gmv: Number(gmvRow?.gmv ?? 0),
      platformRevenue: Number(revenueRow?.revenue ?? 0),
    };
  }

  async getPendingKyc() {
    return this.proRepo.find({
      where: { kycStatus: KycStatus.PENDING_REVIEW },
      relations: { user: { profile: true } },
      order: { updatedAt: 'ASC' },
    });
  }

  async reviewKyc(proId: string, dto: ReviewKycDto) {
    const pro = await this.proRepo.findOne({ where: { id: proId } });
    if (!pro) {
      throw new NotFoundException('Perfil profesional no encontrado');
    }

    if (
      dto.status !== KycStatus.VERIFIED &&
      dto.status !== KycStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Estado KYC inválido (solo VERIFIED o REJECTED)',
      );
    }

    pro.kycStatus = dto.status;
    pro.kycRejectionReason =
      dto.status === KycStatus.REJECTED ? dto.rejectionReason ?? null : null;
    if (dto.badges && dto.badges.length > 0) {
      pro.badges = Array.from(new Set([...(pro.badges ?? []), ...dto.badges]));
    } else if (dto.status === KycStatus.VERIFIED) {
      pro.badges = Array.from(
        new Set([...(pro.badges ?? []), 'VERIFIED_PRO']),
      );
    }

    const updated = await this.proRepo.save(pro);
    const notif = await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: pro.userId,
        type: NotificationType.SYSTEM_ALERT,
        title:
          dto.status === KycStatus.VERIFIED
            ? '¡Verificación KYC aprobada!'
            : 'Verificación KYC rechazada',
        message:
          dto.status === KycStatus.VERIFIED
            ? 'Tu identidad profesional ha sido verificada con éxito.'
            : `Motivo: ${dto.rejectionReason || 'Revisa y vuelve a subir tu documento.'}`,
        link: '/profile',
      }),
    );
    if (this.realtimeService) {
      this.realtimeService.emitNotification(notif);
    }

    return updated;
  }

  async getDisputes() {
    return this.disputeRepo.find({
      where: { status: Not('RESOLVED') },
      relations: {
        order: {
          client: { profile: true },
          professionalProfile: { user: { profile: true } },
        },
      },
      order: { createdAt: 'ASC' },
    });
  }

  async resolveDispute(
    adminUserId: string,
    disputeId: string,
    dto: ResolveDisputeDto,
  ) {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      relations: { order: { professionalProfile: true } },
    });

    if (!dispute || !dispute.order) {
      throw new NotFoundException('Disputa no encontrada');
    }
    if (dispute.status === 'RESOLVED') {
      throw new BadRequestException('Esta disputa ya ha sido resuelta');
    }

    const order = dispute.order;
    const totalDistributed =
      Number(dto.refundAmountClient) + Number(dto.payoutAmountPro);
    if (totalDistributed > Number(order.totalAmount) + 0.01) {
      throw new BadRequestException(
        'La suma de reembolso y pago supera el importe total del pedido',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.refundAmountClient > 0) {
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
          .setParameter('refund', dto.refundAmountClient)
          .execute();
        await manager.save(
          LedgerTransaction,
          manager.create(LedgerTransaction, {
            walletId: clientWallet.id,
            type: TransactionType.ORDER_REFUND,
            amount: dto.refundAmountClient,
            currency: 'EUR',
            status: TransactionStatus.COMPLETED,
            referenceId: order.id,
            metadata: { disputeId, resolvedBy: adminUserId },
          }),
        );
      }

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
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            fiatAvailableBalance: () => `"fiat_available_balance" + :payout`,
            fiatPendingBalance: () =>
              `GREATEST(0, "fiat_pending_balance" - :pending)`,
          })
          .where('id = :id', { id: proWallet.id })
          .setParameter('payout', dto.payoutAmountPro)
          .setParameter('pending', Number(order.proEarnings))
          .execute();

        if (dto.payoutAmountPro > 0) {
          await manager.save(
            LedgerTransaction,
            manager.create(LedgerTransaction, {
              walletId: proWallet.id,
              type: TransactionType.ESCROW_RELEASE,
              amount: dto.payoutAmountPro,
              currency: 'EUR',
              status: TransactionStatus.COMPLETED,
              referenceId: order.id,
              metadata: { disputeId, resolvedBy: adminUserId },
            }),
          );
        }
      }

      const newEscrowStatus =
        dto.refundAmountClient > 0 && dto.payoutAmountPro > 0
          ? EscrowStatus.PARTIALLY_REFUNDED
          : dto.refundAmountClient > 0
            ? EscrowStatus.REFUNDED_TO_CLIENT
            : EscrowStatus.RELEASED_TO_PRO;

      await manager.update(Order, order.id, {
        status:
          dto.payoutAmountPro > 0 ? OrderStatus.COMPLETED : OrderStatus.CANCELLED,
        escrowStatus: newEscrowStatus,
      });

      dispute.status = 'RESOLVED';
      dispute.resolvedByAdminId = adminUserId;
      dispute.resolutionNotes = dto.resolutionNotes.trim();
      dispute.refundAmountClient = dto.refundAmountClient;
      dispute.payoutAmountPro = dto.payoutAmountPro;
      dispute.resolvedAt = new Date();
      return manager.save(OrderDispute, dispute);
    });
  }

  async getPendingPayouts() {
    return this.ledgerRepo.find({
      where: {
        type: TransactionType.PAYOUT_WITHDRAWAL,
        status: TransactionStatus.PENDING,
      },
      relations: { wallet: { user: { profile: true } } },
      order: { createdAt: 'ASC' },
    });
  }

  async processPayout(
    transactionId: string,
    action: 'APPROVE' | 'REJECT',
    notes?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const tx = await manager.findOne(LedgerTransaction, {
        where: { id: transactionId },
        relations: { wallet: true },
      });

      if (!tx || tx.type !== TransactionType.PAYOUT_WITHDRAWAL) {
        throw new NotFoundException('Solicitud de retiro no encontrada');
      }
      if (tx.status !== TransactionStatus.PENDING) {
        throw new BadRequestException('Esta solicitud de retiro ya fue procesada');
      }

      if (action === 'APPROVE') {
        tx.status = TransactionStatus.COMPLETED;
        tx.metadata = { ...tx.metadata, adminNotes: notes ?? null };
        return manager.save(LedgerTransaction, tx);
      }

      tx.status = TransactionStatus.FAILED;
      tx.metadata = { ...tx.metadata, adminNotes: notes ?? null };
      await manager.save(LedgerTransaction, tx);

      await manager
        .createQueryBuilder()
        .update(Wallet)
        .set({
          fiatAvailableBalance: () => `"fiat_available_balance" + :refund`,
        })
        .where('id = :walletId', { walletId: tx.walletId })
        .setParameter('refund', Number(tx.amount))
        .execute();

      return tx;
    });
  }
}
