import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../enums';
import { UuidVarcharEntity } from './base.entity';
import { Message } from './message.entity';
import { Notification } from './notification.entity';
import { Order } from './order.entity';
import { ProfessionalProfile } from './professional-profile.entity';
import { Profile } from './profile.entity';
import { Review } from './review.entity';
import { ServiceRequest } from './service-request.entity';
import { StatusComment } from './status-comment.entity';
import { StatusReaction } from './status-reaction.entity';
import { Status } from './status.entity';
import { Subscription } from './subscription.entity';
import { Wallet } from './wallet.entity';

@Entity('users')
export class User extends UuidVarcharEntity {
  @Index()
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role_enum',
    array: true,
    default: () => `ARRAY['CLIENT']::user_role_enum[]`,
  })
  roles!: UserRole[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_email_verified', type: 'boolean', default: false })
  isEmailVerified!: boolean;

  @Column({ name: 'is_pro', type: 'boolean', default: false })
  isPro!: boolean;

  @Column({ name: 'email_verification_token', type: 'text', nullable: true })
  emailVerificationToken!: string | null;

  @Column({ name: 'password_reset_token', type: 'text', nullable: true })
  passwordResetToken!: string | null;

  @Column({ name: 'password_reset_expires', type: 'timestamptz', nullable: true })
  passwordResetExpires!: Date | null;

  @Column({ name: 'refresh_token_hash', type: 'text', nullable: true })
  refreshTokenHash!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToOne(() => Profile, (profile) => profile.user)
  profile?: Profile | null;

  @OneToOne(() => ProfessionalProfile, (pro) => pro.user)
  professionalProfile?: ProfessionalProfile | null;

  @OneToOne(() => Subscription, (sub) => sub.user)
  subscription?: Subscription | null;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet?: Wallet | null;

  @OneToMany(() => ServiceRequest, (req) => req.client)
  serviceRequests?: ServiceRequest[];

  @OneToMany(() => Order, (order) => order.client)
  clientOrders?: Order[];

  @OneToMany(() => Review, (review) => review.author)
  reviewsWritten?: Review[];

  @OneToMany(() => Review, (review) => review.targetUser)
  reviewsReceived?: Review[];

  @OneToMany(() => Message, (msg) => msg.sender)
  sentMessages?: Message[];

  @OneToMany(() => Notification, (notif) => notif.user)
  notifications?: Notification[];

  @OneToMany(() => Status, (status) => status.author)
  statuses?: Status[];

  @OneToMany(() => StatusComment, (comment) => comment.author)
  statusComments?: StatusComment[];

  @OneToMany(() => StatusReaction, (reaction) => reaction.user)
  statusReactions?: StatusReaction[];
}
