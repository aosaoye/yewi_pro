import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { ProfessionalProfile } from './professional-profile.entity';

@Entity('promotions')
export class Promotion extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'professional_profile_id', type: 'varchar', length: 64 })
  professionalProfileId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'discount_percent', type: 'integer', nullable: true })
  discountPercent!: number | null;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  discountAmount!: number | null;

  @Column({ name: 'promo_code', type: 'varchar', length: 60, nullable: true })
  promoCode!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  badge!: string | null;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => ProfessionalProfile, (pro) => pro.promotions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'professional_profile_id' })
  professionalProfile?: ProfessionalProfile;
}
