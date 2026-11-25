import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { UuidVarcharEntity } from './base.entity';
import { ProfessionalProfile } from './professional-profile.entity';
import { ServiceRequest } from './service-request.entity';

@Entity('lead_unlocks')
@Unique(['serviceRequestId', 'professionalProfileId'])
export class LeadUnlock extends UuidVarcharEntity {
  @Column({ name: 'service_request_id', type: 'varchar', length: 64 })
  serviceRequestId!: string;

  @Column({ name: 'professional_profile_id', type: 'varchar', length: 64 })
  professionalProfileId!: string;

  @Column({ name: 'credits_spent', type: 'integer' })
  creditsSpent!: number;

  @CreateDateColumn({ name: 'unlocked_at', type: 'timestamptz' })
  unlockedAt!: Date;

  @ManyToOne(() => ServiceRequest, (req) => req.unlocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest?: ServiceRequest;

  @ManyToOne(() => ProfessionalProfile, (pro) => pro.leadUnlocks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'professional_profile_id' })
  professionalProfile?: ProfessionalProfile;
}
