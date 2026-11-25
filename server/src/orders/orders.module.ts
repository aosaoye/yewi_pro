import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Conversation,
  Gig,
  GigExtra,
  GigPackage,
  LedgerTransaction,
  Notification,
  Order,
  OrderDelivery,
  OrderDispute,
  OrderMilestone,
  ProfessionalProfile,
  Wallet,
} from '../database/entities';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderMilestone,
      OrderDelivery,
      OrderDispute,
      Gig,
      GigPackage,
      GigExtra,
      ProfessionalProfile,
      Wallet,
      LedgerTransaction,
      Conversation,
      Notification,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
