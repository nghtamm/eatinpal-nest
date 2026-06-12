import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './constants/redis.constants';

export const RedisClientProvider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    new Redis({
      host: configService.getOrThrow<string>('cfg.redis.HOST'),
      port: Number(configService.getOrThrow<string>('cfg.redis.PORT')),
      password: configService.getOrThrow<string>('cfg.redis.PASSWORD'),
    }),
};
