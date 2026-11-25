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
import { ProposalStatus } from '../enums';
import { decimalTransformer } from '../transformers';
import { UuidVarcharEntity } from './base.entity';
import { Order } from './order.entity';
import { ProfessionalProfile } from './professional-profile.entity';
import { ServiceRequest } from './service-request.entity';

@Entity('quote_proposals')
export class QuoteProposal extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'service_request_id', type: 'varchar', length: 64 })
  serviceRequestId!: string;

  @Index()
  @Column({ name: 'professional_profile_id', type: 'varchar', length: 64 })
  professionalProfileId!: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price!: number;

  @Column({ name: 'estimated_days', type: 'integer' })
  estimatedDays!: number;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  breakdown!: Record<string, unknown> | unknown[] | null;

  @Column({
    type: 'enum',
    enum: ProposalStatus,
    enumName: 'proposal_status_enum',
    default: ProposalStatus.PENDING,
  })
  status!: ProposalStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => ServiceRequest, (req) => req.proposals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest?: ServiceRequest;

  @ManyToOne(() => ProfessionalProfile, (pro) => pro.quoteProposals, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'professional_profile_id' })
  professionalProfile?: ProfessionalProfile;

  @OneToMany(() => Order, (order) => order.quoteProposal)
  orders?: Order[];
}
