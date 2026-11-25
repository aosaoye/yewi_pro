import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { UuidVarcharEntity } from './base.entity';
import { Gig } from './gig.entity';
import { Order } from './order.entity';
import { ProfessionalProfile } from './professional-profile.entity';
import { User } from './user.entity';

export interface ReviewReplyEntry {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  comment: string;
  createdAt: string;
}

@Entity('reviews')
export class Review extends UuidVarcharEntity {
  @Column({ name: 'order_id', type: 'varchar', length: 64, unique: true, nullable: true })
  orderId!: string | null;

  @Index()
  @Column({ name: 'professional_profile_id', type: 'varchar', length: 64, nullable: true })
  professionalProfileId!: string | null;

  @Index()
  @Column({ name: 'gig_id', type: 'varchar', length: 64, nullable: true })
  gigId!: string | null;

  @Column({ name: 'author_id', type: 'varchar', length: 64 })
  authorId!: string;

  @Index()
  @Column({ name: 'target_user_id', type: 'varchar', length: 64 })
  targetUserId!: string;

  @Column({ type: 'integer', default: 5 })
  rating!: number;

  @Column({ name: 'quality_rating', type: 'integer', default: 5 })
  qualityRating!: number;

  @Column({ name: 'communication_rating', type: 'integer', default: 5 })
  communicationRating!: number;

  @Column({ name: 'delivery_rating', type: 'integer', default: 5 })
  deliveryRating!: number;

  @Column({ type: 'text' })
  comment!: string;

  @Column({ name: 'seller_reply', type: 'text', nullable: true })
  sellerReply!: string | null;

  @Column({ name: 'seller_replied_at', type: 'timestamptz', nullable: true })
  sellerRepliedAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  replies!: ReviewReplyEntry[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => Order, (order) => order.review, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order?: Order | null;

  @ManyToOne(() => ProfessionalProfile, (pro) => pro.reviews, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'professional_profile_id' })
  professionalProfile?: ProfessionalProfile | null;

  @ManyToOne(() => Gig, (gig) => gig.reviews, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'gig_id' })
  gig?: Gig | null;

  @ManyToOne(() => User, (user) => user.reviewsWritten, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'author_id' })
  author?: User;

  @ManyToOne(() => User, (user) => user.reviewsReceived, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'target_user_id' })
  targetUser?: User;
}
