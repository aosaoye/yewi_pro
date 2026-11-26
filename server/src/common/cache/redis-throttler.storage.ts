import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisCacheService } from './redis.service';

interface MemoryRecord {
  hits: number;
  expiresAt: number;
  blockedUntil: number;
}

/**
 * Storage de Throttler respaldado por Redis con degradación elegante a memoria
 * local si Redis no está disponible, evitando que una caída de caché tumbe la API.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallback = new Map<string, MemoryRecord>();

  constructor(private readonly redisCache: RedisCacheService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const client = this.redisCache.getClient();
    const redisKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:block:${throttlerName}:${key}`;
    const ttlMs = Math.max(1000, ttl);
    const blockMs = Math.max(0, blockDuration);

    if (client && client.status === 'ready') {
      try {
        const blockTtl = await client.pttl(blockKey);
        if (blockTtl > 0) {
          return {
            totalHits: limit + 1,
            timeToExpire: Math.ceil(blockTtl / 1000),
            isBlocked: true,
            timeToBlockExpire: Math.ceil(blockTtl / 1000),
          };
        }

        const totalHits = await client.incr(redisKey);
        if (totalHits === 1) {
          await client.pexpire(redisKey, ttlMs);
        }
        const remainingMs = Math.max(0, await client.pttl(redisKey));

        if (totalHits > limit && blockMs > 0) {
          await client.set(blockKey, '1', 'PX', blockMs);
          return {
            totalHits,
            timeToExpire: Math.ceil(remainingMs / 1000),
            isBlocked: true,
            timeToBlockExpire: Math.ceil(blockMs / 1000),
          };
        }

        return {
          totalHits,
          timeToExpire: Math.ceil(remainingMs / 1000),
          isBlocked: false,
          timeToBlockExpire: 0,
        };
      } catch (err) {
        this.logger.warn(
          `Redis throttler degradado a memoria: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return this.incrementMemory(redisKey, ttlMs, limit, blockMs);
  }

  private incrementMemory(
    key: string,
    ttlMs: number,
    limit: number,
    blockMs: number,
  ) {
    const now = Date.now();
    const existing = this.fallback.get(key);

    if (existing && existing.blockedUntil > now) {
      const rem = Math.ceil((existing.blockedUntil - now) / 1000);
      return {
        totalHits: existing.hits,
        timeToExpire: rem,
        isBlocked: true,
        timeToBlockExpire: rem,
      };
    }

    if (!existing || existing.expiresAt <= now) {
      const record: MemoryRecord = {
        hits: 1,
        expiresAt: now + ttlMs,
        blockedUntil: 0,
      };
      this.fallback.set(key, record);
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttlMs / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    existing.hits += 1;
    const remainingSec = Math.max(0, Math.ceil((existing.expiresAt - now) / 1000));
    if (existing.hits > limit && blockMs > 0) {
      existing.blockedUntil = now + blockMs;
      return {
        totalHits: existing.hits,
        timeToExpire: remainingSec,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockMs / 1000),
      };
    }

    return {
      totalHits: existing.hits,
      timeToExpire: remainingSec,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
