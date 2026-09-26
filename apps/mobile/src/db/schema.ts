import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/*
 * The on-device database (SRS §18.1, §36.2). Only the sync plumbing exists so far; cached
 * entities (indents, stock, tasks, ...) arrive with the features that use them.
 */

/** Where each queued change stands. Business rejections are terminal; STALLED needs a person. */
export const MUTATION_STATES = [
  'PENDING',
  'IN_FLIGHT',
  'SYNCED',
  'SYNC_FAILED',
  'STALLED',
] as const;

/** Changes made on the device, pushed to the API in creation order (§36.2 rules 1–3). */
export const mutationQueue = sqliteTable(
  'mutation_queue',
  {
    id: text('id').primaryKey(),
    /** GraphQL mutation name, e.g. `submitIndent`. */
    operation: text('operation').notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    /** The server replays the original result for a repeated key, so retries are safe. */
    idempotencyKey: text('idempotency_key').notNull().unique(),
    /** Another queued change that must succeed first (e.g. POD upload after the sale). */
    dependsOn: text('depends_on'),
    state: text('state', { enum: MUTATION_STATES }).notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: integer('next_attempt_at', { mode: 'timestamp_ms' }),
    lastError: text('last_error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('mutation_queue_state_created_idx').on(t.state, t.createdAt)],
);

/** How far each entity has been pulled from the server (§36.2 rule 4). */
export const syncCursor = sqliteTable('sync_cursor', {
  entity: text('entity').primaryKey(),
  cursor: text('cursor').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
