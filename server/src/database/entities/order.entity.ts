import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { EscrowStatus, OrderStatus, OrderType } from '../enums';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { Conversation } from './conversation.entity';
import { GigPackage } from './gig-package.entity';
import { Gig } from './gig.entity';
import { OrderDelivery } from './order-delivery.entity';
import { OrderDispute } from './order-dispute.entity';
import { OrderMilestone } from './order-milestone.entity';
import { ProfessionalProfile } from './professional-profile.entity';
import { QuoteProposal } from './quote-proposal.entity';
import { Review } from './review.entity';
import { ServiceRequest } from './service-request.entity';
import { User } from './user.entity';

@Entity('orders')
export class Order extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'order_number', type: 'varchar', length: 64, unique: true })
  orderNumber!: string;

  @Index()
  @Column({ name: 'client_id', type: 'varchar', length: 64 })
  clientId!: string;

  @Index()
  @Column({ name: 'professional_profile_id', type: 'varchar', length: 64 })
  professionalProfileId!: string;

  @Column({
    name: 'order_type',
    type: 'enum',
    enum: OrderType,
    enumName: 'order_type_enum',
  })
  orderType!: OrderType;

  @Column({ name: 'gig_id', type: 'varchar', length: 64, nullable: true })
  gigId!: string | null;

  @Column({ name: 'gig_package_id', type: 'varchar', length: 64, nullable: true })
  gigPackageId!: string | null;

  @Column({ name: 'quote_proposal_id', type: 'varchar', length: 64, nullable: true })
  quoteProposalId!: string | null;

  @Column({ name: 'service_request_id', type: 'varchar', length: 64, nullable: true })
  serviceRequestId!: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status_enum',
    default: OrderStatus.PENDING_REQUIREMENTS,
  })
  status!: OrderStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  subtotal!: number;

  @Column({
    name: 'platform_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  platformFee!: number;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount!: number;

  @Column({
    name: 'pro_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  proEarnings!: number;

  @Column({
    name: 'escrow_status',
    type: 'enum',
    enum: EscrowStatus,
    enumName: 'escrow_status_enum',
    default: EscrowStatus.HELD,
  })
  escrowStatus!: EscrowStatus;

  @Column({ name: 'requirements_answers', type: 'jsonb', nullable: true })
  requirementsAnswers!: Record<string, unknown> | null;

  @Column({ name: 'delivery_deadline', type: 'timestamptz' })
  deliveryDeadline!: Date;

  @Column({ name: 'auto_completed_at', type: 'timestamptz', nullable: true })
  autoCompletedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.clientOrders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_id' })
  client?: User;

  @ManyToOne(() => ProfessionalProfile, (pro) => pro.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'professional_profile_id' })
  professionalProfile?: ProfessionalProfile;

  @ManyToOne(() => Gig, (gig) => gig.orders, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'gig_id' })
  gig?: Gig | null;

  @ManyToOne(() => GigPackage, (pkg) => pkg.orders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'gig_package_id' })
  gigPackage?: GigPackage | null;

  @ManyToOne(() => QuoteProposal, (prop) => prop.orders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'quote_proposal_id' })
  quoteProposal?: QuoteProposal | null;

  @ManyToOne(() => ServiceRequest, (req) => req.orders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest?: ServiceRequest | null;

  @OneToMany(() => OrderMilestone, (milestone) => milestone.order, { cascade: true })
  milestones?: OrderMilestone[];

  @OneToMany(() => OrderDelivery, (delivery) => delivery.order, { cascade: true })
  deliveries?: OrderDelivery[];

  @OneToOne(() => OrderDispute, (dispute) => dispute.order)
  dispute?: OrderDispute | null;

  @OneToOne(() => Review, (review) => review.order)
  review?: Review | null;

  @OneToOne(() => Conversation, (conv) => conv.order)
  conversation?: Conversation | null;
}
