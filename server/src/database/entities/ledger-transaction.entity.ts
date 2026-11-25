import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { TransactionStatus, TransactionType } from '../enums';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { Wallet } from './wallet.entity';

@Entity('ledger_transactions')
export class LedgerTransaction extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'wallet_id', type: 'varchar', length: 64 })
  walletId!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: TransactionType,
    enumName: 'transaction_type_enum',
  })
  type!: TransactionType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
    transformer: decimalTransformer,
  })
  amount!: number;

  @Column({ name: 'credit_amount', type: 'integer', nullable: true, default: 0 })
  creditAmount!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'EUR' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    enumName: 'transaction_status_enum',
    default: TransactionStatus.COMPLETED,
  })
  status!: TransactionStatus;

  @Column({ name: 'stripe_payment_intent_id', type: 'varchar', length: 160, nullable: true })
  stripePaymentIntentId!: string | null;

  @Column({ name: 'stripe_transfer_id', type: 'varchar', length: 160, nullable: true })
  stripeTransferId!: string | null;

  @Index()
  @Column({ name: 'reference_id', type: 'varchar', length: 160, nullable: true })
  referenceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet?: Wallet;
}
