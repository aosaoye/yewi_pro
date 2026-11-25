import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  LedgerTransaction,
  Notification,
  Order,
  OrderDispute,
  ProfessionalProfile,
  User,
  Wallet,
} from '../database/entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ProfessionalProfile,
      Order,
      OrderDispute,
      LedgerTransaction,
      Notification,
      Wallet,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
