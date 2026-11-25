import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { NotificationType } from '../enums';
import { UuidVarcharEntity } from './base.entity';
import { User } from './user.entity';

@Entity('notifications')
@Index(['userId', 'isRead'])
export class Notification extends UuidVarcharEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type_enum',
  })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 240 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'text', nullable: true })
  link!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
