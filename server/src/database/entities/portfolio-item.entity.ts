import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { UuidVarcharEntity } from './base.entity';
import { ProfessionalProfile } from './professional-profile.entity';

@Entity('portfolio_items')
export class PortfolioItem extends UuidVarcharEntity {
  @Column({ name: 'professional_profile_id', type: 'varchar', length: 64 })
  professionalProfileId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'image_urls', type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  imageUrls!: string[];

  @Column({ name: 'project_url', type: 'text', nullable: true })
  projectUrl!: string | null;

  @Column({ type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  tags!: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => ProfessionalProfile, (pro) => pro.portfolioItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'professional_profile_id' })
  professionalProfile?: ProfessionalProfile;
}
