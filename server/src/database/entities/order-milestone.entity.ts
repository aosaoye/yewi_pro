import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { MilestoneStatus } from '../enums';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { Order } from './order.entity';

@Entity('order_milestones')
export class OrderMilestone extends UuidVarcharEntity {
  @Column({ name: 'order_id', type: 'varchar', length: 64 })
  orderId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount!: number;

  @Column({ name: 'delivery_days', type: 'integer' })
  deliveryDays!: number;

  @Column({
    type: 'enum',
    enum: MilestoneStatus,
    enumName: 'milestone_status_enum',
    default: MilestoneStatus.PENDING,
  })
  status!: MilestoneStatus;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Order, (order) => order.milestones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;
}
