import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { LedgerTransaction } from './ledger-transaction.entity';
import { User } from './user.entity';

@Entity('wallets')
export class Wallet extends UuidVarcharEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 64, unique: true })
  userId!: string;

  @Column({ name: 'credit_balance', type: 'integer', default: 0 })
  creditBalance!: number;

  @Column({
    name: 'fiat_pending_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
    transformer: decimalTransformer,
  })
  fiatPendingBalance!: number;

  @Column({
    name: 'fiat_available_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
    transformer: decimalTransformer,
  })
  fiatAvailableBalance!: number;

  @Column({ type: 'varchar', length: 16, default: 'EUR' })
  currency!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.wallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @OneToMany(() => LedgerTransaction, (tx) => tx.wallet)
  transactions?: LedgerTransaction[];
}
