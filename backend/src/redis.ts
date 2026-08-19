import Redis from 'ioredis';
import { config } from './config';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(config.redis.url, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,   // required by BullMQ
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts if offline
        return 1000;
      },
    });

    redisInstance.on('connect', () => {
      console.log('[Redis] Connected');
    });

    redisInstance.on('error', () => {
      // Quiet handler for dev mode when Redis is offline
    });
  }
  return redisInstance;
}

// Dedicated connection for BullMQ
export function createRedisConnection(): Redis {
  const r = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return 1000;
    },
  });
  r.on('error', () => {});
  return r;
}
