import type { DomainEvent } from '@ie/events';
import type { Pool } from '../shared/database.js';
import type { Logger } from '../shared/logging.js';
import type { Consumer } from './consumers.js';
import { OutOfOrderError, decideOrdering } from './ordering.js';

export type ProcessResult = 'processed' | 'duplicate' | 'skipped';

/**
 * Applies one event to one consumer, effectively once. In a single transaction it:
 *  1. claims the event in the consumer's inbox (events.processed_event); if already there, stops
 *  2. for ordered consumers, checks the aggregate version (skip / defer / process)
 *  3. runs the handler with the same transaction
 *  4. advances the consumer's position for the aggregate
 * Any error rolls everything back, so the next attempt starts clean.
 */
export async function processEvent(
  pool: Pool,
  consumer: Consumer,
  event: DomainEvent,
  logger: Logger,
): Promise<ProcessResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query(
      `INSERT INTO events.processed_event (consumer, event_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [consumer.name, event.eventId],
    );
    if (claimed.rowCount === 0) {
      await client.query('ROLLBACK');
      return 'duplicate';
    }

    if (consumer.ordered) {
      const { rows } = await client.query<{ last_version: number }>(
        `SELECT last_version FROM events.consumer_position
          WHERE consumer = $1 AND aggregate_type = $2 AND aggregate_id = $3
          FOR UPDATE`,
        [consumer.name, event.aggregateType, event.aggregateId],
      );
      const last = rows[0]?.last_version;
      const decision = decideOrdering(event.aggregateVersion, last);
      if (decision === 'defer') {
        throw new OutOfOrderError(
          `${event.aggregateType}/${event.aggregateId}`,
          event.aggregateVersion,
          last,
        );
      }
      if (decision === 'skip') {
        await client.query('COMMIT'); // keep the inbox record: this event is settled
        return 'skipped';
      }
    }

    await consumer.handle(event, { client, logger: logger.child({ consumer: consumer.name }) });

    if (consumer.ordered) {
      await client.query(
        `INSERT INTO events.consumer_position (consumer, aggregate_type, aggregate_id, last_version)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (consumer, aggregate_type, aggregate_id) DO UPDATE SET last_version = EXCLUDED.last_version`,
        [consumer.name, event.aggregateType, event.aggregateId, event.aggregateVersion],
      );
    }
    await client.query('COMMIT');
    return 'processed';
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Records an event whose retries are exhausted, for an administrator to inspect and replay. */
export async function recordDeadLetter(
  pool: Pool,
  consumer: string,
  event: DomainEvent,
  error: string,
  attempts: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO events.dead_letter (consumer, event_id, event_type, payload, error, attempts)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (consumer, event_id)
       DO UPDATE SET error = EXCLUDED.error, attempts = EXCLUDED.attempts, failed_at = now(), replayed_at = NULL`,
    [consumer, event.eventId, event.eventType, event, error.slice(0, 4000), attempts],
  );
}
