import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { KycStatus } from '../enums';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { Category } from './category.entity';
import { Gig } from './gig.entity';
import { LeadUnlock } from './lead-unlock.entity';
import { Order } from './order.entity';
import { PortfolioItem } from './portfolio-item.entity';
import { Promotion } from './promotion.entity';
import { QuoteProposal } from './quote-proposal.entity';
import { Review } from './review.entity';
import { User } from './user.entity';

@Entity('professional_profiles')
@Index(['latitude', 'longitude'])
export class ProfessionalProfile extends UuidVarcharEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 64, unique: true })
  userId!: string;

  @Column({ name: 'business_name', type: 'varchar', length: 180, nullable: true })
  businessName!: string | null;

  @Column({ name: 'tax_id', type: 'varchar', length: 40, nullable: true })
  taxId!: string | null;

  @Column({ type: 'text' })
  bio!: string;

  @Index()
  @Column({ name: 'is_pro', type: 'boolean', default: false })
  isPro!: boolean;

  @Column({
    name: 'hourly_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  hourlyRate!: number | null;

  @Column({ name: 'service_radius_km', type: 'integer', default: 50 })
  serviceRadiusKm!: number;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  region!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  province!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Index()
  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    enumName: 'kyc_status_enum',
    default: KycStatus.UNVERIFIED,
  })
  kycStatus!: KycStatus;

  @Column({ name: 'kyc_document_url', type: 'text', nullable: true })
  kycDocumentUrl!: string | null;

  @Column({ name: 'kyc_rejection_reason', type: 'text', nullable: true })
  kycRejectionReason!: string | null;

  @Column({ type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  badges!: string[];

  @Column({ name: 'avg_rating', type: 'double precision', default: 0.0 })
  avgRating!: number;

  @Column({ name: 'total_reviews', type: 'integer', default: 0 })
  totalReviews!: number;

  @Column({ name: 'completed_orders_count', type: 'integer', default: 0 })
  completedOrdersCount!: number;

  @Column({ name: 'response_time_hours', type: 'integer', default: 24 })
  responseTimeHours!: number;

  @Column({ name: 'response_rate_percent', type: 'integer', default: 100 })
  responseRatePercent!: number;

  @Column({ type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  skills!: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.professionalProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToMany(() => Category, (category) => category.professionals)
  @JoinTable({
    name: 'professional_categories',
    joinColumn: { name: 'professional_profile_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories?: Category[];

  @OneToMany(() => PortfolioItem, (item) => item.professionalProfile)
  portfolioItems?: PortfolioItem[];

  @OneToMany(() => Gig, (gig) => gig.professionalProfile)
  gigs?: Gig[];

  @OneToMany(() => LeadUnlock, (unlock) => unlock.professionalProfile)
  leadUnlocks?: LeadUnlock[];

  @OneToMany(() => QuoteProposal, (proposal) => proposal.professionalProfile)
  quoteProposals?: QuoteProposal[];

  @OneToMany(() => Order, (order) => order.professionalProfile)
  orders?: Order[];

  @OneToMany(() => Review, (review) => review.professionalProfile)
  reviews?: Review[];

  @OneToMany(() => Promotion, (promotion) => promotion.professionalProfile)
  promotions?: Promotion[];
}
