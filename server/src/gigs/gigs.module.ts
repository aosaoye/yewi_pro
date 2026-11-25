import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  Gig,
  GigExtra,
  GigPackage,
  ProfessionalProfile,
} from '../database/entities';
import { GigsController } from './gigs.controller';
import { GigsService } from './gigs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Gig,
      GigPackage,
      GigExtra,
      ProfessionalProfile,
      Category,
    ]),
  ],
  controllers: [GigsController],
  providers: [GigsService],
  exports: [GigsService],
})
export class GigsModule {}
