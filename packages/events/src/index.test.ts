import { describe, expect, it } from 'vitest';
import contract from '../schema/event-contracts.schema.json' with { type: 'json' };
import { EVENT_TYPES, validateEvent, type DomainEvent } from './index.js';

const indentCreated: DomainEvent<'IndentCreated'> = {
  eventId: '01926f6e-8a1c-7c3e-9d2a-3f4b5c6d7e8f',
  eventType: 'IndentCreated',
  eventVersion: 1,
  occurredAt: '2026-09-24T05:30:00Z',
  organizationId: '00000000-0000-0000-0000-0000000000a1',
  aggregateType: 'Indent',
  aggregateId: '01926f6e-8a1c-7c3e-9d2a-000000000001',
  aggregateVersion: 1,
  actor: { type: 'USER', id: '01926f6e-8a1c-7c3e-9d2a-000000000002' },
  correlationId: 'req-01926f6e8a1c',
  payload: {
    locationId: '00000000-0000-0000-0000-0000000000b1',
    lineCount: 3,
    estimatedTotal: { amount: '1250.50', currency: 'INR' },
  },
};

describe('event contracts', () => {
  it('generates a type for every event in the contract', () => {
    expect([...EVENT_TYPES].sort()).toEqual(
      [...contract.$defs.Envelope.properties.eventType.enum].sort(),
    );
  });

  it('accepts a valid event', () => {
    expect(validateEvent(indentCreated)).toEqual({ valid: true, event: indentCreated });
  });

  it('validates the payload against the schema for its event type', () => {
    const result = validateEvent({ ...indentCreated, payload: { locationId: 'not-a-uuid' } });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "/payload must have required property 'lineCount'",
          '/payload/locationId must match format "uuid"',
        ]),
      );
    }
  });

  it('rejects unknown event types', () => {
    expect(validateEvent({ ...indentCreated, eventType: 'WhatsAppMessageSent' }).valid).toBe(false);
  });
});
