import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { UuidVarcharEntity } from './base.entity';
import { Message } from './message.entity';
import { Order } from './order.entity';
import { ServiceRequest } from './service-request.entity';

@Entity('conversations')
@Index(['participantAId', 'participantBId'])
export class Conversation extends UuidVarcharEntity {
  @Column({ name: 'order_id', type: 'varchar', length: 64, unique: true, nullable: true })
  orderId!: string | null;

  @Index()
  @Column({ name: 'service_request_id', type: 'varchar', length: 64, nullable: true })
  serviceRequestId!: string | null;

  @Column({ name: 'participant_a_id', type: 'varchar', length: 64 })
  participantAId!: string;

  @Column({ name: 'participant_b_id', type: 'varchar', length: 64 })
  participantBId!: string;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => Order, (order) => order.conversation, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'order_id' })
  order?: Order | null;

  @ManyToOne(() => ServiceRequest, (req) => req.conversations, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest?: ServiceRequest | null;

  @OneToMany(() => Message, (message) => message.conversation)
  messages?: Message[];
}
