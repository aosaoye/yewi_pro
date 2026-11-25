import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidVarcharEntity } from './base.entity';
import { Status } from './status.entity';
import { User } from './user.entity';

@Entity('status_comments')
export class StatusComment extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'status_id', type: 'varchar', length: 64 })
  statusId!: string;

  @Index()
  @Column({ name: 'author_id', type: 'varchar', length: 64 })
  authorId!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Status, (status) => status.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'status_id' })
  status?: Status;

  @ManyToOne(() => User, (user) => user.statusComments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: User;
}
