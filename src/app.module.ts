import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration from './config/configuration';
import { HealthController } from './health/health.controller';
import { AdminModule } from './modules/admin/admin.module';
import { AdsModule } from './modules/ads/ads.module';
import { AnimeModule } from './modules/anime/anime.module';
import { AuthModule } from './modules/auth/auth.module';
import { JikanModule } from './modules/jikan/jikan.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UploadModule } from './modules/upload/upload.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { WebsocketModule } from './websocket/websocket.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    AnimeModule,
    JikanModule,
    ProvidersModule,
    ReportsModule,
    UploadModule,
    ModerationModule,
    AdsModule,
    AdminModule,
    WebsocketModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
