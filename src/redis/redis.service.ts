import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const BLACKLIST_PREFIX = 'auth:revoked:';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('redis.host') ?? 'localhost',
      port: config.get<number>('redis.port') ?? 6379,
      password: config.get<string>('redis.password'),
    });
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.client.setex(key, seconds, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.setex(`${BLACKLIST_PREFIX}${jti}`, ttlSeconds, '1');
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    return this.exists(`${BLACKLIST_PREFIX}${jti}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
