import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { Gig } from './gig.entity';

@Entity('gig_extras')
export class GigExtra extends UuidVarcharEntity {
  @Column({ name: 'gig_id', type: 'varchar', length: 64 })
  gigId!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price!: number;

  @Column({ name: 'additional_delivery_days', type: 'integer', default: 0 })
  additionalDeliveryDays!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Gig, (gig) => gig.extras, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gig_id' })
  gig?: Gig;
}
