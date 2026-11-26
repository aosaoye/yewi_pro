import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './redis.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Global()
@Module({
  providers: [RedisCacheService, RedisThrottlerStorage],
  exports: [RedisCacheService, RedisThrottlerStorage],
})
export class CacheModule {}
