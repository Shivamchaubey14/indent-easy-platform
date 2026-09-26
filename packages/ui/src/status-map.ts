/*
 * One place that decides how every workflow status looks (SRS §40.4): its tone picks the colour and
 * icon; the words come from the app's translations. Status codes mean the same thing across
 * entities (APPROVED is good news on an indent and on a PO), so the map is keyed by code alone.
 *
 * A test checks that every status the database allows is listed here.
 */
export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const STATUSES_BY_TONE = {
  /** Not started, finished without an outcome, or no longer relevant. */
  neutral: [
    'DRAFT',
    'INACTIVE',
    'CLOSED',
    'CANCELLED',
    'SUPERSEDED',
    'RETIRED',
    'EXPIRED',
    'REVOKED',
    'DISCARDED',
    'SKIPPED',
    'NOT_REQUIRED',
    'READ',
    'VIEWED',
  ],
  /** Moving along: someone or something is working on it. */
  info: [
    'PENDING',
    'PENDING_APPROVAL',
    'PENDING_PLANNING',
    'PENDING_INSPECTION',
    'PENDING_UPLOAD',
    'PENDING_SCAN',
    'PARTIALLY_APPROVED',
    'IN_FULFILMENT',
    'IN_PROGRESS',
    'IN_TRANSIT',
    'RUNNING',
    'OPEN',
    'RFQ',
    'ORDERED',
    'PO_CREATED',
    'APPROVED_FOR_TRANSFER',
    'STN_ISSUED',
    'ISSUED',
    'SENT',
    'SENDING',
    'QUEUED',
    'SCHEDULED',
    'PLANNED',
    'SUBMITTED',
    'INVITED',
    'REASSIGNED',
    'UPLOADED',
    'VALIDATING',
    'PREVIEW_READY',
    'PROCESSING',
    'GENERATING',
    'RECONCILING',
    'PARTIAL',
    'PARTIALLY_DISPATCHED',
    'PARTIALLY_RECEIVED',
    'PARTIALLY_PAID',
    'DISPATCHED',
  ],
  /** Needs someone's attention, but nothing has failed. */
  warning: [
    'RETURNED',
    'ESCALATED',
    'ON_HOLD',
    'PENDING_EXCESS_APPROVAL',
    'DISCREPANCY_OPEN',
    'EXCEPTION',
    'PROCESSED_WITH_EXCEPTIONS',
    'CLOSED_SHORT',
    'SHORT_CLOSED',
    'LOCKED',
    'UNPAID',
    'RETRY_SCHEDULED',
    'MISSING_GRN',
    'MISSING_PO',
    'NOT_REGISTERED',
    'PRICE_MISMATCH',
    'QTY_MISMATCH',
    'UNDER_RECORDED',
    'OVER_RECORDED',
  ],
  /** Done, and done well. */
  success: [
    'ACTIVE',
    'APPROVED',
    'COMPLETED',
    'FULFILLED',
    'RECEIVED',
    'POSTED',
    'VERIFIED',
    'ADJUSTED',
    'AVAILABLE',
    'CLEAN',
    'DELIVERED',
    'RECONCILED',
    'RESOLVED',
    'PROCESSED',
    'PUBLISHED',
    'FINALIZED',
    'READY',
    'PAID',
    'MATCHED',
    'PERFECT_MATCH',
    'ACKNOWLEDGED',
  ],
  /** Refused, failed or unsafe. */
  danger: [
    'REJECTED',
    'REVERSED',
    'FAILED',
    'VALIDATION_FAILED',
    'ERROR',
    'QUARANTINED',
    'INFECTED',
    'BLOCKED',
    'DISABLED',
    'DELETED',
    'NOT_RECORDED',
  ],
} as const satisfies Record<Tone, readonly string[]>;

export type StatusCode = (typeof STATUSES_BY_TONE)[Tone][number];

/** Every status code grouped by tone (read-only; used by the consistency test). */
export const statusesByTone: Readonly<Record<Tone, readonly StatusCode[]>> = STATUSES_BY_TONE;

const TONE_BY_STATUS = new Map<string, Tone>(
  (Object.entries(STATUSES_BY_TONE) as [Tone, readonly StatusCode[]][]).flatMap(([tone, codes]) =>
    codes.map((code) => [code, tone] as const),
  ),
);

/** The tone for a status code. Unknown codes are shown as neutral rather than guessed. */
export function toneOf(status: string): Tone {
  return TONE_BY_STATUS.get(status) ?? 'neutral';
}
