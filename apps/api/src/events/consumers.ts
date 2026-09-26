import type { DomainEvent, EventType } from '@ie/events';
import type { PoolClient } from '../shared/database.js';
import type { Logger } from '../shared/logging.js';

export interface ConsumerContext {
  /** The consumer's transaction: its writes commit together with the inbox record. */
  client: PoolClient;
  logger: Logger;
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
  async handle(event, { logger }) {
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
  },
};

export const CONSUMERS: readonly Consumer[] = [eventLogConsumer];

export function subscribers(
  eventType: string,
  consumers: readonly Consumer[] = CONSUMERS,
): Consumer[] {
  return consumers.filter((c) => c.events === '*' || c.events.includes(eventType as EventType));
}
