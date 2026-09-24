/*
 * Monthly range-partitioned tables. drizzle-kit does not introspect partitioned tables, so these
 * are written by hand and deliberately kept out of drizzle.config.ts `schema`: drizzle-kit must
 * never try to create or alter them. Their DDL (partitions, append-only triggers) lives in SQL
 * migrations. Code reads and writes the parent table; PostgreSQL routes rows to the partition.
 */
import { sql } from 'drizzle-orm';
import {
  inet,
  integer,
  jsonb,
  numeric,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea } from './column-types.js';
import { audit, inventory, notify } from './schema.js';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

/** The stock ledger. Append-only: corrections are new reversing rows (SRS §24.12). */
export const stockTransactionInInventory = inventory.table(
  'stock_transaction',
  {
    id: uuid().defaultRandom().notNull(),
    organizationId: uuid('organization_id').notNull(),
    occurredAt: ts('occurred_at').notNull(),
    postedAt: ts('posted_at').defaultNow().notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    productId: uuid('product_id').notNull(),
    batchKey: uuid('batch_key')
      .default(sql`'00000000-0000-0000-0000-000000000000'::uuid`)
      .notNull(),
    movementType: text('movement_type').notNull(),
    direction: smallint().notNull(),
    quantity: numeric({ precision: 18, scale: 3 }).notNull(),
    qtyBefore: numeric('qty_before', { precision: 18, scale: 3 }).notNull(),
    qtyAfter: numeric('qty_after', { precision: 18, scale: 3 }).notNull(),
    unitCost: numeric('unit_cost', { precision: 18, scale: 4 }),
    value: numeric({ precision: 18, scale: 2 }),
    sourceType: text('source_type').notNull(),
    sourceId: uuid('source_id').notNull(),
    sourceLineId: uuid('source_line_id'),
    sourceNumber: text('source_number'),
    counterpartyWarehouseId: uuid('counterparty_warehouse_id'),
    reasonCode: text('reason_code'),
    remarks: text(),
    performedBy: uuid('performed_by').notNull(),
    channel: text().default('WEB').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    reversalOfId: uuid('reversal_of_id'),
  },
  (t) => [primaryKey({ columns: [t.id, t.occurredAt] })],
);

export const notificationDeliveryInNotify = notify.table(
  'notification_delivery',
  {
    id: uuid().defaultRandom().notNull(),
    organizationId: uuid('organization_id').notNull(),
    createdAt: ts('created_at').defaultNow().notNull(),
    notificationId: uuid('notification_id'),
    eventId: uuid('event_id'),
    subjectType: text('subject_type'),
    subjectId: uuid('subject_id'),
    channel: text().notNull(),
    recipientMasked: text('recipient_masked').notNull(),
    recipientHash: bytea('recipient_hash').notNull(),
    recipientRef: text('recipient_ref'),
    templateCode: text('template_code').notNull(),
    templateVersion: integer('template_version'),
    variables: jsonb(),
    status: text().default('QUEUED').notNull(),
    attempts: integer().default(0).notNull(),
    nextAttemptAt: ts('next_attempt_at'),
    provider: text(),
    providerMessageId: text('provider_message_id'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    sentAt: ts('sent_at'),
    deliveredAt: ts('delivered_at'),
    readAt: ts('read_at'),
    dedupeKey: text('dedupe_key').notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.createdAt] })],
);

/** Append-only, hash-chained business audit trail (SRS §33). */
export const auditLogInAudit = audit.table(
  'audit_log',
  {
    id: uuid().defaultRandom().notNull(),
    occurredAt: ts('occurred_at').defaultNow().notNull(),
    organizationId: uuid('organization_id').notNull(),
    actorId: uuid('actor_id'),
    actorType: text('actor_type').notNull(),
    onBehalfOfId: uuid('on_behalf_of_id'),
    action: text().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    entityNumber: text('entity_number'),
    before: jsonb(),
    after: jsonb(),
    diff: jsonb(),
    requestId: text('request_id'),
    correlationId: text('correlation_id'),
    traceId: text('trace_id'),
    ip: inet(),
    userAgent: text('user_agent'),
    channel: text(),
    prevHash: bytea('prev_hash'),
    hash: bytea(),
  },
  (t) => [primaryKey({ columns: [t.id, t.occurredAt] })],
);

export const securityEventInAudit = audit.table(
  'security_event',
  {
    id: uuid().defaultRandom().notNull(),
    occurredAt: ts('occurred_at').defaultNow().notNull(),
    organizationId: uuid('organization_id'),
    type: text().notNull(),
    userId: uuid('user_id'),
    emailHash: bytea('email_hash'),
    ip: inet(),
    userAgent: text('user_agent'),
    outcome: text().notNull(),
    details: jsonb(),
    requestId: text('request_id'),
  },
  (t) => [primaryKey({ columns: [t.id, t.occurredAt] })],
);
