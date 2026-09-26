/*
 * Event pipeline against real PostgreSQL and Redis, as the application role.
 * Run with `pnpm test:integration` (local: `pnpm infra:up && pnpm db:reset` first).
 */
import { randomUUID } from 'node:crypto';
import type { DomainEvent } from '@ie/events';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LeaderLock } from '../scheduler/leader.js';
import { withOrgContext } from '../shared/database.js';
import { eventLogConsumer, type Consumer } from './consumers.js';
import { appendEvent } from './outbox.js';
import { OutOfOrderError } from './ordering.js';
import { processEvent, recordDeadLetter } from './process.js';
import { consumerQueue, queueSettings } from './queues.js';
import { OutboxRelay } from './relay.js';

try {
  process.loadEnvFile('../../.env');
} catch {
  // CI provides the variables directly.
}
const databaseUrl = process.env['DATABASE_URL'];
const redisUrl = process.env['REDIS_URL'];
if (!databaseUrl || !redisUrl) throw new Error('DATABASE_URL and REDIS_URL are required');

const ORG = '0192a000-0000-7000-8000-000000000001';
const run = randomUUID().slice(0, 8); // isolates this run's queues, consumers and rows
const logger = pino({ level: 'silent' });
const queues = queueSettings(redisUrl, `ie-test-${run}`);
let pool: pg.Pool;
let redis: Redis;

const ordered: Consumer = {
  name: `test-ordered-${run}`,
  events: ['IndentCreated', 'IndentSubmitted'],
  ordered: true,
  concurrency: 1,
  handle: async () => undefined,
};

function indentCreated(aggregateId: string, version: number) {
  return withOrgContext(pool, ORG, (client) =>
    appendEvent(client, {
      eventType: 'IndentCreated',
      organizationId: ORG,
      aggregateType: `TestIndent-${run}`,
      aggregateId,
      aggregateVersion: version,
      actor: { type: 'SYSTEM' },
      payload: { locationId: '0192a000-0000-7000-8000-0000000000b1', lineCount: 1 },
    }),
  );
}

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
  redis = new Redis(redisUrl);
});

afterAll(async () => {
  await pool.query(`DELETE FROM events.outbox WHERE aggregate_type = $1`, [`TestIndent-${run}`]);
  await pool.query(`DELETE FROM events.processed_event WHERE consumer LIKE $1`, [`test-%-${run}`]);
  await pool.query(`DELETE FROM events.consumer_position WHERE consumer LIKE $1`, [
    `test-%-${run}`,
  ]);
  await pool.query(`DELETE FROM events.dead_letter WHERE consumer LIKE $1`, [`test-%-${run}`]);
  const keys = await redis.keys(`ie-test-${run}:*`);
  if (keys.length) await redis.del(...keys);
  await redis.quit();
  await pool.end();
});

describe('outbox relay', () => {
  it('publishes each committed event once per subscribed consumer', async () => {
    const consumer: Consumer = { ...eventLogConsumer, name: `test-relay-${run}` };
    const relay = new OutboxRelay({
      pool,
      listenUrl: databaseUrl,
      queues,
      logger,
      consumers: [consumer],
    });
    const event = await indentCreated(randomUUID(), 1);

    let published = 0;
    for (let i = 0; i < 5 && published === 0; i++) published += await relay.relayOnce();
    expect(published).toBeGreaterThanOrEqual(1);

    const row = await pool.query<{ published_at: Date | null }>(
      'SELECT published_at FROM events.outbox WHERE id = $1',
      [event.eventId],
    );
    expect(row.rows[0]?.published_at).toBeInstanceOf(Date);

    const queue = new Queue(consumerQueue(consumer.name), {
      connection: queues.connection,
      prefix: queues.prefix,
    });
    const job = await queue.getJob(event.eventId);
    expect(job?.data).toMatchObject({
      eventId: event.eventId,
      eventType: 'IndentCreated',
      aggregateVersion: 1,
    });
    expect(await relay.relayOnce()).toBe(0); // nothing left to publish
    await queue.close();
    await relay.stop();
  });
});

describe('consumer processing', () => {
  const envelope = (aggregateId: string, version: number): DomainEvent => ({
    eventId: randomUUID(),
    eventType: 'IndentCreated',
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    organizationId: ORG,
    aggregateType: `TestIndent-${run}`,
    aggregateId,
    aggregateVersion: version,
    actor: { type: 'SYSTEM' },
    correlationId: 'test',
    payload: { locationId: '0192a000-0000-7000-8000-0000000000b1', lineCount: 1 },
  });

  it('processes an event once even if it is delivered twice', async () => {
    const consumer: Consumer = { ...eventLogConsumer, name: `test-dedupe-${run}` };
    const event = envelope(randomUUID(), 1);
    expect(await processEvent(pool, consumer, event, logger)).toBe('processed');
    expect(await processEvent(pool, consumer, event, logger)).toBe('duplicate');
  });

  it('applies an aggregate strictly in version order', async () => {
    const aggregate = randomUUID();
    const [v1, v2, v3] = [1, 2, 3].map((v) => envelope(aggregate, v)) as [
      DomainEvent,
      DomainEvent,
      DomainEvent,
    ];

    await expect(processEvent(pool, ordered, v2, logger)).rejects.toBeInstanceOf(OutOfOrderError);
    expect(await processEvent(pool, ordered, v1, logger)).toBe('processed');
    await expect(processEvent(pool, ordered, v3, logger)).rejects.toBeInstanceOf(OutOfOrderError);
    expect(await processEvent(pool, ordered, v2, logger)).toBe('processed'); // the deferred one, retried
    expect(await processEvent(pool, ordered, v3, logger)).toBe('processed');
    // A different event carrying an already-applied version is skipped, not re-applied.
    expect(await processEvent(pool, ordered, envelope(aggregate, 2), logger)).toBe('skipped');
  });

  it('rolls back the inbox claim when the handler fails, so a retry can succeed', async () => {
    let fail = true;
    const flaky: Consumer = {
      ...eventLogConsumer,
      name: `test-flaky-${run}`,
      handle: async () => {
        if (fail) throw new Error('temporary failure');
      },
    };
    const event = envelope(randomUUID(), 1);
    await expect(processEvent(pool, flaky, event, logger)).rejects.toThrow('temporary failure');
    fail = false;
    expect(await processEvent(pool, flaky, event, logger)).toBe('processed');
  });

  it('dead-letters an event after its last attempt', async () => {
    const name = `test-dead-${run}`;
    const queue = new Queue(consumerQueue(name), {
      connection: queues.connection,
      prefix: queues.prefix,
    });
    const event = envelope(randomUUID(), 1);
    const failed = new Promise<void>((resolve) => {
      const worker = new Worker(
        consumerQueue(name),
        async () => {
          throw new Error('always fails');
        },
        {
          connection: queues.connection,
          prefix: queues.prefix,
          settings: { backoffStrategy: () => 10 },
        },
      );
      worker.on('failed', (job, err) => {
        if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
        void (async () => {
          await recordDeadLetter(
            pool,
            name,
            job.data as DomainEvent,
            err.message,
            job.attemptsMade,
          );
          await worker.close();
          resolve();
        })();
      });
    });
    await queue.add('IndentCreated', event, {
      jobId: event.eventId,
      attempts: 2,
      backoff: { type: 'custom' },
    });
    await failed;
    const { rows } = await pool.query(
      'SELECT error, attempts FROM events.dead_letter WHERE consumer = $1 AND event_id = $2',
      [name, event.eventId],
    );
    expect(rows[0]).toEqual({ error: 'always fails', attempts: 2 });
    await queue.close();
  });
});

describe('scheduler leader election (real Redis)', () => {
  it('elects one leader and fails over when it stops', async () => {
    const key = `ie-test-${run}:leader`;
    const a = new LeaderLock(redis, logger, key, 5_000);
    const b = new LeaderLock(redis, logger, key, 5_000);
    await a.tick();
    await b.tick();
    expect([a.isLeader, b.isLeader]).toEqual([true, false]);
    await a.stop();
    await b.tick();
    expect(b.isLeader).toBe(true);
    await b.stop();
  });
});
