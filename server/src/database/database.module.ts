import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  exports: [TypeOrmModule],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    if (!this.dataSource?.isInitialized) return;
    try {
      await this.dataSource.query(
        `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "replies" jsonb NOT NULL DEFAULT '[]'::jsonb`,
      );
      await this.dataSource.query(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "expo_push_token" text`,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo verificar la columna reviews.replies al iniciar: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
