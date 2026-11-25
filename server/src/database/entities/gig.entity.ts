import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { GigStatus } from '../enums';
import { UuidVarcharEntity } from './base.entity';
import { Category } from './category.entity';
import { GigExtra } from './gig-extra.entity';
import { GigPackage } from './gig-package.entity';
import { Order } from './order.entity';
import { ProfessionalProfile } from './professional-profile.entity';
import { Review } from './review.entity';

@Entity('gigs')
export class Gig extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'professional_profile_id', type: 'varchar', length: 64 })
  professionalProfileId!: string;

  @Index()
  @Column({ name: 'category_id', type: 'varchar', length: 64 })
  categoryId!: string;

  @Column({ type: 'varchar', length: 240 })
  title!: string;

  @Index()
  @Column({ type: 'varchar', length: 260, unique: true })
  slug!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'search_tags', type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  searchTags!: string[];

  @Column({ name: 'cover_images', type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  coverImages!: string[];

  @Column({ name: 'video_url', type: 'text', nullable: true })
  videoUrl!: string | null;

  @Column({ name: 'pdf_documents', type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  pdfDocuments!: string[];

  @Column({ type: 'jsonb', nullable: true })
  faqs!: Record<string, unknown>[] | Record<string, unknown> | null;

  @Column({ type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  requirements!: string[];

  @Index()
  @Column({
    type: 'enum',
    enum: GigStatus,
    enumName: 'gig_status_enum',
    default: GigStatus.ACTIVE,
  })
  status!: GigStatus;

  @Column({ name: 'avg_rating', type: 'double precision', default: 0.0 })
  avgRating!: number;

  @Column({ name: 'total_reviews', type: 'integer', default: 0 })
  totalReviews!: number;

  @Column({ name: 'orders_count', type: 'integer', default: 0 })
  ordersCount!: number;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => ProfessionalProfile, (pro) => pro.gigs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professional_profile_id' })
  professionalProfile?: ProfessionalProfile;

  @ManyToOne(() => Category, (cat) => cat.gigs, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @OneToMany(() => GigPackage, (pkg) => pkg.gig, { cascade: true })
  packages?: GigPackage[];

  @OneToMany(() => GigExtra, (extra) => extra.gig, { cascade: true })
  extras?: GigExtra[];

  @OneToMany(() => Order, (order) => order.gig)
  orders?: Order[];

  @OneToMany(() => Review, (review) => review.gig)
  reviews?: Review[];
}
