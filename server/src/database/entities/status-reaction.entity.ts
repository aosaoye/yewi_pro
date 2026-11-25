import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { UuidVarcharEntity } from './base.entity';
import { Status } from './status.entity';
import { User } from './user.entity';

@Entity('status_reactions')
@Unique(['statusId', 'userId'])
export class StatusReaction extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'status_id', type: 'varchar', length: 64 })
  statusId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ name: 'reaction_type', type: 'varchar', length: 32, default: 'LIKE' })
  reactionType!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Status, (status) => status.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'status_id' })
  status?: Status;

  @ManyToOne(() => User, (user) => user.statusReactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
