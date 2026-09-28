import type { DomainEvent, EventType } from '@ie/events';
import type { PoolClient } from '../shared/database.js';
import type { Logger } from '../shared/logging.js';

/** Module services the worker hands to consumers (absent in processes that don't run them). */
export interface WorkerServices {
  documents?: { checkUpload(client: PoolClient, documentId: string): Promise<void> };
}

export interface ConsumerContext {
  /** The consumer's transaction: its writes commit together with the inbox record. */
  client: PoolClient;
  logger: Logger;
  services: WorkerServices;
}

export interface Consumer {
  /** Stable name: used for the queue, the inbox and the dead-letter table. Never rename. */
  name: string;
  /** Event types delivered to this consumer, or '*' for all. */
  events: readonly EventType[] | '*';
  /** Apply events of one aggregate strictly in version order (see ordering.ts). */
  ordered: boolean;
  /** Jobs processed at the same time by one worker. Ordered consumers usually use 1. */
  concurrency: number;
  handle(event: DomainEvent, context: ConsumerContext): Promise<void>;
}

/**
 * Structured log of every business event with its correlation fields. Gives operators a
 * searchable event trail from day one; later consumers (notifications, search, reporting,
 * integrations) are added to CONSUMERS alongside it.
 */
export const eventLogConsumer: Consumer = {
  name: 'event-log',
  events: '*',
  ordered: false,
  concurrency: 4,
  handle(event, { logger }) {
    logger.info(
      {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        aggregateVersion: event.aggregateVersion,
        organizationId: event.organizationId,
        correlationId: event.correlationId,
        requestId: event.requestId,
      },
      'domain event',
    );
    return Promise.resolve();
  },
};

/** Sets the event's organisation on the consumer's transaction, so row-level security applies. */
async function enterOrganization(client: PoolClient, organizationId: string): Promise<void> {
  await client.query("SELECT set_config('app.org_id', $1, true)", [organizationId]);
}

/**
 * Checks each uploaded file (SRS §35.2): checksum, file signature and malware scan, then marks it
 * AVAILABLE or moves it to quarantine.
 */
export const documentCheckConsumer: Consumer = {
  name: 'document-check',
  events: ['DocumentUploaded'],
  ordered: false,
  concurrency: 2,
  async handle(event, { client, services }) {
    if (event.eventType !== 'DocumentUploaded') return;
    if (!services.documents) throw new Error('document-check needs the documents service');
    await enterOrganization(client, event.organizationId);
    await services.documents.checkUpload(client, event.payload.documentId);
  },
};

export const CONSUMERS: readonly Consumer[] = [eventLogConsumer, documentCheckConsumer];

export function subscribers(
  eventType: string,
  consumers: readonly Consumer[] = CONSUMERS,
): Consumer[] {
  return consumers.filter((c) => c.events === '*' || c.events.includes(eventType as EventType));
}
