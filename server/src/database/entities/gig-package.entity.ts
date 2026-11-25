import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PackageTier } from '../enums';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { Gig } from './gig.entity';
import { Order } from './order.entity';

@Entity('gig_packages')
@Unique(['gigId', 'tier'])
export class GigPackage extends UuidVarcharEntity {
  @Column({ name: 'gig_id', type: 'varchar', length: 64 })
  gigId!: string;

  @Column({
    type: 'enum',
    enum: PackageTier,
    enumName: 'package_tier_enum',
  })
  tier!: PackageTier;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price!: number;

  @Column({ name: 'delivery_days', type: 'integer' })
  deliveryDays!: number;

  @Column({ type: 'integer', default: 1 })
  revisions!: number;

  @Column({ type: 'jsonb', nullable: true })
  features!: string[] | Record<string, unknown> | null;

  @Column({ name: 'is_popular', type: 'boolean', default: false })
  isPopular!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Gig, (gig) => gig.packages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gig_id' })
  gig?: Gig;

  @OneToMany(() => Order, (order) => order.gigPackage)
  orders?: Order[];
}
