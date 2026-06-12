import { Global, Module } from '@nestjs/common';
import { RedisClientProvider } from './redis.providers';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisClientProvider, RedisService],
  exports: [RedisService],
})
export class RedisModule {}
