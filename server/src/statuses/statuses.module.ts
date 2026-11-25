import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Notification,
  Status,
  StatusComment,
  StatusReaction,
  User,
} from '../database/entities';
import { StatusesController } from './statuses.controller';
import { StatusesService } from './statuses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Status,
      User,
      StatusComment,
      StatusReaction,
      Notification,
    ]),
  ],
  controllers: [StatusesController],
  providers: [StatusesService],
  exports: [StatusesService],
})
export class StatusesModule {}
