import { describeError, type ErrorCode } from '@ie/domain-types';

/** An expected failure with a stable code from the error catalogue. Safe to show to clients. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get definition() {
    return describeError(this.code);
  }
}
