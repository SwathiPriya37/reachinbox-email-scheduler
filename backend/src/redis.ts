import Redis from 'ioredis';
import { config } from './config';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(config.redis.url, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,   // required by BullMQ
      lazyConnect: false,
    });

    redisInstance.on('connect', () => {
      console.log('[Redis] Connected');
    });

    redisInstance.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
  }
  return redisInstance;
}

// Dedicated connection for BullMQ (it needs its own connection)
export function createRedisConnection(): Redis {
  return new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
