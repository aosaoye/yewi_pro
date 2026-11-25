import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { UuidVarcharEntity } from './base.entity';
import { Order } from './order.entity';

@Entity('order_deliveries')
export class OrderDelivery extends UuidVarcharEntity {
  @Column({ name: 'order_id', type: 'varchar', length: 64 })
  orderId!: string;

  @Column({ name: 'delivery_number', type: 'integer', default: 1 })
  deliveryNumber!: number;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'attachment_urls', type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  attachmentUrls!: string[];

  @Column({ name: 'is_accepted', type: 'boolean', default: false })
  isAccepted!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Order, (order) => order.deliveries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;
}
