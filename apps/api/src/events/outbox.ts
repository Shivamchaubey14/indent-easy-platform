import { uuidv7 } from '@ie/domain-types';
import { validateEvent, type DomainEvent, type EventPayloadMap, type EventType } from '@ie/events';
import type { PoolClient } from '../shared/database.js';
import { currentContext } from '../shared/context.js';

export interface Actor {
  type: 'USER' | 'SYSTEM' | 'INTEGRATION';
  id?: string | null;
  onBehalfOfId?: string | null;
}

export type Channel = 'WEB' | 'MOBILE' | 'MOBILE_OFFLINE' | 'API' | 'SYSTEM' | 'IMPORT';

export interface NewEvent<T extends EventType> {
  eventType: T;
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  payload: EventPayloadMap[T];
  actor: Actor;
  channel?: Channel;
  causationId?: string | null;
}

export class InvalidEventError extends Error {
  constructor(readonly problems: string[]) {
    super(`Event does not match its contract: ${problems.join('; ')}`);
    this.name = 'InvalidEventError';
  }
}

/**
 * Records a domain event in events.outbox. Call it with the client of the business transaction,
 * so the event exists if and only if the change commits (SRS §22). The relay publishes it later.
 * The event is validated against the published contract before it is written.
 */
export async function appendEvent<T extends EventType>(
  client: PoolClient,
  input: NewEvent<T>,
): Promise<DomainEvent<T>> {
  const context = currentContext();
  const event = {
    eventId: uuidv7(),
    eventType: input.eventType,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    organizationId: input.organizationId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion,
    actor: input.actor,
    correlationId: context?.correlationId ?? context?.requestId ?? uuidv7(),
    causationId: input.causationId ?? null,
    requestId: context?.requestId ?? null,
    traceId: null,
    channel: input.channel ?? 'API',
    payload: input.payload,
  };
  const check = validateEvent(event);
  if (!check.valid) throw new InvalidEventError(check.errors);

  const {
    payload,
    eventId,
    eventType,
    eventVersion,
    occurredAt,
    organizationId,
    aggregateType,
    aggregateId,
    aggregateVersion,
    ...metadata
  } = event;
  await client.query(
    `INSERT INTO events.outbox
       (id, organization_id, event_type, event_version, aggregate_type, aggregate_id,
        aggregate_version, payload, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      eventId,
      organizationId,
      eventType,
      eventVersion,
      aggregateType,
      aggregateId,
      aggregateVersion,
      payload,
      metadata,
      occurredAt,
    ],
  );
  return check.event as DomainEvent<T>;
}

export interface OutboxRow {
  id: string;
  organization_id: string;
  event_type: string;
  event_version: number;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number;
  payload: unknown;
  metadata: Record<string, unknown>;
  created_at: Date;
}

/** Rebuilds the full event envelope from an outbox row. */
export function envelopeFromRow(row: OutboxRow): DomainEvent {
  return {
    ...row.metadata,
    eventId: row.id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    occurredAt: row.created_at.toISOString(),
    organizationId: row.organization_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    aggregateVersion: row.aggregate_version,
    payload: row.payload,
  } as DomainEvent;
}
