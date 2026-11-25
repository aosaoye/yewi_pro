import { resolve } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { CacheModule } from './common/cache/cache.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RealtimeModule } from './common/realtime/realtime.module';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { ALL_ENTITIES } from './database/entities';
import { MIGRATIONS } from './database/migrations';
import { GigsModule } from './gigs/gigs.module';
import { HealthController } from './health.controller';
import { LeadsModule } from './leads/leads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { PromotionsModule } from './promotions/promotions.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StatusesModule } from './statuses/statuses.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), 'server', '.env'),
        resolve(__dirname, '..', '.env'),
        resolve(__dirname, '..', '..', '.env'),
      ],
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl =
          configService.get<string>('database.url') ||
          configService.get<string>('DATABASE_URL') ||
          '';
        const useSsl =
          configService.get<boolean>('DATABASE_SSL') === true ||
          /sslmode=require|\.render\.com|supabase\.co|neon\.tech/i.test(
            databaseUrl,
          );

        return {
          type: 'postgres',
          url: databaseUrl,
          entities: ALL_ENTITIES,
          migrations: MIGRATIONS,
          synchronize: false,
          migrationsRun:
            configService.get<boolean>('DATABASE_RUN_MIGRATIONS') === true,
          logging: configService.get<string>('nodeEnv') === 'development',
          ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: (configService.get<number>('throttle.ttl') ?? 60) * 1000,
          limit: configService.get<number>('throttle.limit') ?? 100,
        },
      ],
    }),
    TerminusModule,
    CacheModule,
    RealtimeModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProfessionalsModule,
    GigsModule,
    LeadsModule,
    OrdersModule,
    WalletModule,
    PaymentsModule,
    ChatModule,
    NotificationsModule,
    ReviewsModule,
    PromotionsModule,
    StatusesModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
