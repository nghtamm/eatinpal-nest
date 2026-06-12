import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis/built/Redis';
import { REDIS_CLIENT } from './constants/redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async setEX(key: string, value: string, ttl: number): Promise<void> {
    await this.redisClient.set(key, value, 'EX', ttl);
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async incrEX(key: string, ttl: number): Promise<number> {
    const [value] = await this.redisClient.increx(key, 'BYINT', 1, 'EX', ttl, 'ENX');
    return Number(value);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisClient.quit();
  }
}
