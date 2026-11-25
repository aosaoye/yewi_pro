import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { LeadStatus } from '../enums';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { Category } from './category.entity';
import { Conversation } from './conversation.entity';
import { LeadUnlock } from './lead-unlock.entity';
import { Order } from './order.entity';
import { QuoteProposal } from './quote-proposal.entity';
import { User } from './user.entity';

@Entity('service_requests')
@Index(['latitude', 'longitude'])
export class ServiceRequest extends UuidVarcharEntity {
  @Column({ name: 'client_id', type: 'varchar', length: 64 })
  clientId!: string;

  @Index()
  @Column({ name: 'category_id', type: 'varchar', length: 64 })
  categoryId!: string;

  @Column({ type: 'varchar', length: 240 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'questionnaire_answers', type: 'jsonb' })
  questionnaireAnswers!: Record<string, unknown>;

  @Column({
    name: 'budget_min',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  budgetMin!: number | null;

  @Column({
    name: 'budget_max',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  budgetMax!: number | null;

  @Column({ name: 'is_urgent', type: 'boolean', default: false })
  isUrgent!: boolean;

  @Column({ name: 'preferred_date', type: 'timestamptz', nullable: true })
  preferredDate!: Date | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20 })
  postalCode!: string;

  @Column({ type: 'varchar', length: 120 })
  city!: string;

  @Column({ type: 'varchar', length: 100, default: 'ES' })
  country!: string;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ name: 'is_remote', type: 'boolean', default: false })
  isRemote!: boolean;

  @Column({ name: 'credit_cost', type: 'integer', default: 10 })
  creditCost!: number;

  @Column({ name: 'max_unlocks', type: 'integer', default: 5 })
  maxUnlocks!: number;

  @Column({ name: 'unlocks_count', type: 'integer', default: 0 })
  unlocksCount!: number;

  @Index()
  @Column({
    type: 'enum',
    enum: LeadStatus,
    enumName: 'lead_status_enum',
    default: LeadStatus.OPEN,
  })
  status!: LeadStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.serviceRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client?: User;

  @ManyToOne(() => Category, (cat) => cat.serviceRequests, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @OneToMany(() => LeadUnlock, (unlock) => unlock.serviceRequest)
  unlocks?: LeadUnlock[];

  @OneToMany(() => QuoteProposal, (proposal) => proposal.serviceRequest)
  proposals?: QuoteProposal[];

  @OneToMany(() => Order, (order) => order.serviceRequest)
  orders?: Order[];

  @OneToMany(() => Conversation, (conv) => conv.serviceRequest)
  conversations?: Conversation[];
}
