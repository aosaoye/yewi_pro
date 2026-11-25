import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { Order } from './order.entity';

@Entity('order_disputes')
export class OrderDispute extends UuidVarcharEntity {
  @Column({ name: 'order_id', type: 'varchar', length: 64, unique: true })
  orderId!: string;

  @Column({ name: 'initiator_id', type: 'varchar', length: 64 })
  initiatorId!: string;

  @Column({ type: 'varchar', length: 240 })
  reason!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'evidence_urls', type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  evidenceUrls!: string[];

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes!: string | null;

  @Column({ name: 'resolved_by_admin_id', type: 'varchar', length: 64, nullable: true })
  resolvedByAdminId!: string | null;

  @Column({
    name: 'refund_amount_client',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
    transformer: decimalTransformer,
  })
  refundAmountClient!: number;

  @Column({
    name: 'payout_amount_pro',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
    transformer: decimalTransformer,
  })
  payoutAmountPro!: number;

  @Column({ type: 'varchar', length: 40, default: 'OPEN' })
  status!: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => Order, (order) => order.dispute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;
}
