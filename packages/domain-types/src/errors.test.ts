import { ErrorCode } from '@ie/graphql';
import { describe, expect, it } from 'vitest';
import { ERROR_CATALOGUE, describeError } from './errors.js';

describe('error catalogue', () => {
  it('classifies exactly the codes in the GraphQL contract', () => {
    expect(Object.keys(ERROR_CATALOGUE).sort()).toEqual(Object.values(ErrorCode).sort());
  });

  it('follows the SRS error model placement and status', () => {
    expect(describeError('VALIDATION_FAILED')).toMatchObject({
      httpStatus: 400,
      placement: 'userErrors',
    });
    expect(describeError('AUTH_TOKEN_EXPIRED')).toMatchObject({
      httpStatus: 401,
      placement: 'errors',
    });
    expect(describeError('INVENTORY_INSUFFICIENT')).toMatchObject({
      httpStatus: 422,
      placement: 'userErrors',
    });
    expect(describeError('VERSION_CONFLICT')).toMatchObject({ httpStatus: 409, retryable: false });
    expect(describeError('RATE_LIMITED')).toMatchObject({ httpStatus: 429, retryable: true });
    expect(describeError('INTERNAL_ERROR')).toMatchObject({ httpStatus: 500, placement: 'errors' });
  });
});
