import { businessDate } from '@ie/domain-types';
import { z } from 'zod';

/*
 * Messages are i18n keys (resolved to EN/HI by the client), never display text.
 */

/** GraphQL `ID`: opaque, non-empty. */
export const id = z.string().trim().min(1, 'validation.required').max(128);

/** GraphQL `UUID`: client-generated idempotency / correlation key (v4 or v7). */
export const uuid = z.uuid({ message: 'validation.uuid' });

/** Trimmed free text; blank becomes undefined so optional fields stay optional. */
export function text(max: number) {
  return z
    .string()
    .trim()
    .max(max, 'validation.tooLong')
    .transform((v) => (v === '' ? undefined : v));
}

/**
 * GraphQL `Decimal` (a string such as "12.500") with a maximum number of fraction digits.
 * Strings are kept as strings: arithmetic happens server-side with exact decimals.
 */
export function decimal(opts: { scale: number; min?: 'positive' | 'nonNegative' }) {
  const pattern = new RegExp(`^-?\\d{1,15}(\\.\\d{1,${opts.scale}})?$`);
  // abort: a malformed number should report one error, not also "must be positive".
  let schema = z.string().trim().regex(pattern, { message: 'validation.decimal', abort: true });
  if (opts.min === 'positive') {
    schema = schema.refine((v) => Number(v) > 0, 'validation.mustBePositive');
  } else if (opts.min === 'nonNegative') {
    schema = schema.refine((v) => Number(v) >= 0, 'validation.mustNotBeNegative');
  }
  return schema;
}

/** Quantity in a UOM: > 0, at most 3 decimals (SRS IND-002). */
export const quantity = decimal({ scale: 3, min: 'positive' });

/** INR amount: ≥ 0, at most 2 decimals. */
export const money = decimal({ scale: 2, min: 'nonNegative' });

/** GraphQL `Date`: calendar date YYYY-MM-DD. */
export const isoDate = z.iso.date({ message: 'validation.date' });

/** A calendar date that is today or later in the business time zone. */
export function dateNotBefore(today: () => string = businessDate) {
  return isoDate.refine((v) => v >= today(), 'validation.dateInPast');
}

/** Relay pagination arguments: first ≤ 100, default 20 (SRS §26.1). */
export const pageArgs = z.object({
  first: z.number().int().min(1).max(100).default(20),
  after: z.string().optional(),
});
