import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  Gig,
  PortfolioItem,
  ProfessionalProfile,
  Review,
  User,
} from '../database/entities';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from './professionals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProfessionalProfile,
      User,
      Category,
      PortfolioItem,
      Gig,
      Review,
    ]),
  ],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
})
export class ProfessionalsModule {}
