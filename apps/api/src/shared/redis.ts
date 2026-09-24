import { Redis } from 'ioredis';
import type { Logger } from './logging.js';

export type { Redis };

/**
 * General-purpose client (cache, rate limits, locks). Commands fail fast while disconnected
 * instead of queueing, so readiness reflects reality. BullMQ gets its own connections.
 */
export function createRedis(url: string, logger: Logger): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectionName: 'indent-easy-api',
  });
  let healthy = true;
  redis.on('error', (err) => {
    if (healthy) logger.warn({ err }, 'redis connection error');
    healthy = false;
  });
  redis.on('ready', () => {
    if (!healthy) logger.info('redis connection restored');
    healthy = true;
  });
  return redis;
}
