import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  Conversation,
  LeadUnlock,
  LedgerTransaction,
  Notification,
  Order,
  ProfessionalProfile,
  QuoteProposal,
  ServiceRequest,
  Wallet,
} from '../database/entities';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceRequest,
      Category,
      ProfessionalProfile,
      LeadUnlock,
      QuoteProposal,
      Notification,
      Order,
      Wallet,
      LedgerTransaction,
      Conversation,
    ]),
  ],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
