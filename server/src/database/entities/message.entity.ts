import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { MessageType } from '../enums';
import { UuidVarcharEntity } from './base.entity';
import { Conversation } from './conversation.entity';
import { User } from './user.entity';

@Entity('messages')
export class Message extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'conversation_id', type: 'varchar', length: 64 })
  conversationId!: string;

  @Index()
  @Column({ name: 'sender_id', type: 'varchar', length: 64 })
  senderId!: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    enumName: 'message_type_enum',
    default: MessageType.TEXT,
  })
  type!: MessageType;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  attachments!: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Conversation, (conv) => conv.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @ManyToOne(() => User, (user) => user.sentMessages, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sender_id' })
  sender?: User;
}
