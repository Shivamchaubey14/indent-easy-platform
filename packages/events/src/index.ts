import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import contract from '../schema/event-contracts.schema.json' with { type: 'json' };
import type { DomainEvent } from './generated/events.js';

export * from './generated/events.js';

// ajv-formats ships CommonJS; under NodeNext its default export arrives wrapped.
const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(contract);

export type EventValidationResult =
  { valid: true; event: DomainEvent } | { valid: false; errors: string[] };

function describe(error: ErrorObject): string {
  return `${error.instancePath || '(event)'} ${error.message ?? 'is invalid'}`;
}

/** Validates an event envelope and its payload against the published contract. */
export function validateEvent(candidate: unknown): EventValidationResult {
  if (validate(candidate)) return { valid: true, event: candidate as DomainEvent };
  const errors = (validate.errors ?? []).filter((e) => e.keyword !== 'if').map(describe);
  return { valid: false, errors: [...new Set(errors)] };
}
