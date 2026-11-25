import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { RedisCacheService } from './common/cache/redis.service';
import { Public } from './common/decorators/public.decorator';
import { RawResponse } from './common/decorators/raw-response.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redis: RedisCacheService,
  ) {}

  @Public()
  @SkipThrottle()
  @RawResponse()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de base de datos, memoria y caché' })
  async check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
      async () => {
        try {
          const client = this.redis.getClient();
          const pong = client ? await client.ping() : null;
          return {
            redis: {
              status: pong === 'PONG' ? 'up' : 'down',
            },
          };
        } catch {
          return { redis: { status: 'down' } };
        }
      },
    ]);
  }
}
