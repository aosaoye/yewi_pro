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
import { StatusMediaType } from '../enums';
import { UuidVarcharEntity } from './base.entity';
import { StatusComment } from './status-comment.entity';
import { StatusReaction } from './status-reaction.entity';
import { User } from './user.entity';

@Entity('statuses')
export class Status extends UuidVarcharEntity {
  @Index()
  @Column({ name: 'author_id', type: 'varchar', length: 64 })
  authorId!: string;

  @Column({ name: 'media_url', type: 'text', nullable: true })
  mediaUrl!: string | null;

  @Column({
    name: 'media_type',
    type: 'enum',
    enum: StatusMediaType,
    enumName: 'status_media_type_enum',
    default: StatusMediaType.IMAGE,
  })
  mediaType!: StatusMediaType;

  @Column({ type: 'text', nullable: true })
  caption!: string | null;

  @Column({ name: 'background_color', type: 'varchar', length: 32, nullable: true })
  backgroundColor!: string | null;

  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount!: number;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.statuses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: User;

  @OneToMany(() => StatusComment, (comment) => comment.status)
  comments?: StatusComment[];

  @OneToMany(() => StatusReaction, (reaction) => reaction.status)
  reactions?: StatusReaction[];
}
