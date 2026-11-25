import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionStatus } from '../enums';
import { UuidVarcharEntity } from './base.entity';
import { User } from './user.entity';

@Entity('subscriptions')
export class Subscription extends UuidVarcharEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 64, unique: true })
  userId!: string;

  @Index()
  @Column({ name: 'stripe_customer_id', type: 'varchar', length: 120, nullable: true })
  stripeCustomerId!: string | null;

  @Column({
    name: 'stripe_subscription_id',
    type: 'varchar',
    length: 120,
    nullable: true,
    unique: true,
  })
  stripeSubscriptionId!: string | null;

  @Column({ name: 'stripe_price_id', type: 'varchar', length: 120, nullable: true })
  stripePriceId!: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    enumName: 'subscription_status_enum',
    default: SubscriptionStatus.INCOMPLETE,
  })
  status!: SubscriptionStatus;

  @Column({ name: 'current_period_start', type: 'timestamptz', nullable: true })
  currentPeriodStart!: Date | null;

  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
