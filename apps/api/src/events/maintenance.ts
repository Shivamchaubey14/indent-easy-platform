import type { Pool } from '../shared/database.js';
import type { Logger } from '../shared/logging.js';
import { outboxLag } from './relay.js';

/** Scheduled housekeeping. The scheduler registers when each runs; the worker runs them. */
export interface MaintenanceJob {
  name: string;
  /** Cron pattern in Asia/Kolkata, or a fixed interval. */
  schedule: { pattern: string } | { every: number };
  run(pool: Pool, logger: Logger): Promise<Record<string, unknown>>;
}

/** Unpublished events older than this raise an alert: the relay is stuck or Redis is down. */
export const OUTBOX_LAG_ALERT_SECONDS = 300;

export const MAINTENANCE_JOBS: readonly MaintenanceJob[] = [
  {
    // SRS §22.2 retention: outbox rows are deleted 7 days after publishing.
    name: 'outbox-prune',
    schedule: { pattern: '30 2 * * *' },
    async run(pool) {
      const { rowCount } = await pool.query(
        `DELETE FROM events.outbox WHERE published_at < now() - interval '7 days'`,
      );
      return { deleted: rowCount ?? 0 };
    },
  },
  {
    // SRS §22.2 retention: consumer inbox rows are kept 30 days.
    name: 'inbox-prune',
    schedule: { pattern: '45 2 * * *' },
    async run(pool) {
      const { rowCount } = await pool.query(
        `DELETE FROM events.processed_event WHERE processed_at < now() - interval '30 days'`,
      );
      return { deleted: rowCount ?? 0 };
    },
  },
  {
    name: 'outbox-lag-check',
    schedule: { every: 60_000 },
    async run(pool, logger) {
      const lag = await outboxLag(pool);
      if (lag.oldestSeconds > OUTBOX_LAG_ALERT_SECONDS) {
        logger.error(
          { ...lag, alert: 'OutboxLagging' },
          `events have waited over ${OUTBOX_LAG_ALERT_SECONDS / 60} minutes to be published`,
        );
      }
      return lag;
    },
  },
];
