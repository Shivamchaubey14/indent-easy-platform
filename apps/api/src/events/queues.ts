import type { ConnectionOptions, JobsOptions } from 'bullmq';

/** Retry delays after each failed attempt (SRS §22.2): 5 s, 30 s, 2 min, 10 min, 30 min. */
export const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/**
 * Delay before the next attempt, with ±20% jitter so a burst of failures doesn't retry in
 * lockstep. `attemptsMade` counts attempts so far (1 after the first failure).
 */
export function retryDelay(attemptsMade: number, random: () => number = Math.random): number {
  const base =
    RETRY_DELAYS_MS[Math.min(attemptsMade, RETRY_DELAYS_MS.length) - 1] ?? RETRY_DELAYS_MS[0];
  return Math.round(base * (0.8 + 0.4 * random()));
}

export const eventJobOptions: JobsOptions = {
  attempts: MAX_ATTEMPTS,
  backoff: { type: 'custom' },
  removeOnComplete: { age: 24 * 3600, count: 10_000 },
  // Failed jobs are also recorded in events.dead_letter; the queue copy is for inspection.
  removeOnFail: { age: 14 * 24 * 3600 },
};

/** BullMQ queue names may not contain ':'. */
export const consumerQueue = (consumer: string) => `events.${consumer}`;
export const deadLetterQueue = (consumer: string) => `events.${consumer}.dlq`;
export const MAINTENANCE_QUEUE = 'maintenance';

export interface QueueSettings {
  connection: ConnectionOptions;
  /** Redis key prefix; tests use a unique one so runs don't collide. */
  prefix: string;
}

export function queueSettings(redisUrl: string, prefix = 'ie'): QueueSettings {
  // BullMQ requires maxRetriesPerRequest: null for blocking commands used by workers.
  return { connection: { url: redisUrl, maxRetriesPerRequest: null }, prefix };
}
