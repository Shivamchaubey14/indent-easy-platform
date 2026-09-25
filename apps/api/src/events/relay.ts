import { Queue } from 'bullmq';
import pg from 'pg';
import type { Pool } from '../shared/database.js';
import type { Logger } from '../shared/logging.js';
import { CONSUMERS, subscribers, type Consumer } from './consumers.js';
import { envelopeFromRow, type OutboxRow } from './outbox.js';
import { consumerQueue, eventJobOptions, type QueueSettings } from './queues.js';

const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 1_000;

export interface RelayOptions {
  pool: Pool;
  /** Direct (non-pooled) connection string for LISTEN, which needs a dedicated session. */
  listenUrl: string;
  queues: QueueSettings;
  logger: Logger;
  consumers?: readonly Consumer[];
}

/**
 * Moves committed events from events.outbox to one BullMQ queue per subscribed consumer.
 * Woken by NOTIFY outbox_new (sent by a trigger on insert), with a 1 s poll as a fallback.
 * Rows are claimed with FOR UPDATE SKIP LOCKED, so several relays can run side by side.
 * A row is marked published only after every queue accepted it: delivery is at-least-once,
 * and consumer inboxes turn that into effectively-once.
 */
export class OutboxRelay {
  private readonly queues = new Map<string, Queue>();
  private listener: pg.Client | undefined;
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private draining: Promise<void> | undefined;
  private wakeRequested = false;
  lastRunAt: number | undefined;

  constructor(private readonly options: RelayOptions) {
    for (const consumer of options.consumers ?? CONSUMERS) {
      this.queues.set(
        consumer.name,
        new Queue(consumerQueue(consumer.name), {
          connection: options.queues.connection,
          prefix: options.queues.prefix,
        }),
      );
    }
  }

  async start(): Promise<void> {
    this.running = true;
    this.listener = new pg.Client({
      connectionString: this.options.listenUrl,
      application_name: 'indent-easy-relay',
    });
    this.listener.on('notification', () => this.wake());
    this.listener.on('error', (err) =>
      this.options.logger.warn({ err }, 'outbox listener connection error'),
    );
    await this.listener.connect();
    await this.listener.query('LISTEN outbox_new');
    this.timer = setInterval(() => this.wake(), POLL_INTERVAL_MS);
    this.wake();
  }

  /** Runs a relay pass now, or right after the current one if a pass is in progress. */
  wake(): void {
    if (!this.running) return;
    if (this.draining) {
      this.wakeRequested = true;
      return;
    }
    this.draining = this.drain()
      .catch((err: unknown) => this.options.logger.error({ err }, 'outbox relay pass failed'))
      .finally(() => {
        this.draining = undefined;
        if (this.wakeRequested) {
          this.wakeRequested = false;
          this.wake();
        }
      });
  }

  /** Publishes batches until the outbox is empty or a publish fails. */
  private async drain(): Promise<void> {
    while (this.running && (await this.relayOnce()) === BATCH_SIZE) {
      // a full batch means there may be more
    }
    this.lastRunAt = Date.now();
  }

  /** Publishes one batch. Returns how many rows were published. */
  async relayOnce(): Promise<number> {
    const client = await this.options.pool.connect();
    let published = 0;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<OutboxRow>(
        `SELECT id, organization_id, event_type, event_version, aggregate_type, aggregate_id,
                aggregate_version, payload, metadata, created_at
           FROM events.outbox
          WHERE published_at IS NULL
          ORDER BY created_at, id
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [BATCH_SIZE],
      );
      for (const row of rows) {
        try {
          const event = envelopeFromRow(row);
          for (const consumer of subscribers(row.event_type, this.options.consumers ?? CONSUMERS)) {
            // jobId = eventId: re-publishing the same event (after a crash) doesn't duplicate it.
            await this.queues
              .get(consumer.name)
              ?.add(row.event_type, event, { ...eventJobOptions, jobId: row.id });
          }
          await client.query(
            `UPDATE events.outbox
                SET published_at = now(), publish_attempts = publish_attempts + 1, last_error = NULL
              WHERE id = $1`,
            [row.id],
          );
          published++;
        } catch (err) {
          await client.query(
            'UPDATE events.outbox SET publish_attempts = publish_attempts + 1, last_error = $2 WHERE id = $1',
            [row.id, err instanceof Error ? err.message.slice(0, 2000) : String(err)],
          );
          this.options.logger.warn({ err, eventId: row.id }, 'could not publish event; will retry');
          break; // most likely Redis is unavailable: stop this batch, keep order
        }
      }
      await client.query('COMMIT');
      return published;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    clearInterval(this.timer);
    await this.draining;
    await this.listener?.end().catch(() => undefined);
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}

/** Outbox health for metrics and alerts: unpublished rows and the age of the oldest one. */
export async function outboxLag(
  pool: Pool,
): Promise<{ unpublished: number; oldestSeconds: number }> {
  const { rows } = await pool.query<{ unpublished: string; oldest: number | null }>(
    `SELECT count(*) AS unpublished,
            EXTRACT(EPOCH FROM now() - min(created_at))::float AS oldest
       FROM events.outbox WHERE published_at IS NULL`,
  );
  return { unpublished: Number(rows[0]?.unpublished ?? 0), oldestSeconds: rows[0]?.oldest ?? 0 };
}
