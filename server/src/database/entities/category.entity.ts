import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { CategoryType } from '../enums';
import { UuidVarcharEntity } from './base.entity';
import { Gig } from './gig.entity';
import { ProfessionalProfile } from './professional-profile.entity';
import { ServiceRequest } from './service-request.entity';

@Entity('categories')
export class Category extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'parent_id', type: 'varchar', length: 64, nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Index()
  @Column({ type: 'varchar', length: 180, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  icon!: string | null;

  @Column({ name: 'banner_url', type: 'text', nullable: true })
  bannerUrl!: string | null;

  @Column({
    type: 'enum',
    enum: CategoryType,
    enumName: 'category_type_enum',
    default: CategoryType.HYBRID,
  })
  type!: CategoryType;

  @Column({ name: 'form_schema', type: 'jsonb', nullable: true })
  formSchema!: Record<string, unknown> | unknown[] | null;

  @Column({ name: 'base_lead_credit_cost', type: 'integer', default: 10 })
  baseLeadCreditCost!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children?: Category[];

  @ManyToMany(() => ProfessionalProfile, (pro) => pro.categories)
  professionals?: ProfessionalProfile[];

  @OneToMany(() => Gig, (gig) => gig.category)
  gigs?: Gig[];

  @OneToMany(() => ServiceRequest, (req) => req.category)
  serviceRequests?: ServiceRequest[];
}
