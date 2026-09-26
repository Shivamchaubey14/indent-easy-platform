export type OrderingDecision = 'process' | 'skip' | 'defer';

/**
 * Per-aggregate ordering for consumers that need it (SRS §22.2). Events of one aggregate must be
 * applied in version order with no gaps:
 *  - the next expected version (or version 1 for an aggregate never seen) → process
 *  - a version already applied → skip (a redelivery)
 *  - a later version while an earlier one is still missing → defer: retry later, by which time
 *    the missing one has usually been processed. If it never arrives, retries run out and the
 *    event lands in the dead-letter table for an administrator; it is never silently dropped.
 */
export function decideOrdering(version: number, lastApplied: number | undefined): OrderingDecision {
  const expected = (lastApplied ?? 0) + 1;
  if (version === expected) return 'process';
  if (version < expected) return 'skip';
  return 'defer';
}

export class OutOfOrderError extends Error {
  constructor(aggregate: string, version: number, lastApplied: number | undefined) {
    super(
      `${aggregate} version ${version} arrived before version ${(lastApplied ?? 0) + 1}; retrying later`,
    );
    this.name = 'OutOfOrderError';
  }
}
