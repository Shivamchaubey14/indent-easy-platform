import type { ErrorCode } from '@ie/graphql';

export type { ErrorCode };

/** Error categories from the API error model (SRS §26.4). */
export type ErrorCategory =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'BUSINESS_RULE'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'EXTERNAL'
  | 'INTERNAL';

/**
 * Where a GraphQL error is reported: expected outcomes go in the mutation payload's
 * `userErrors` (HTTP 200); exceptional ones go in the top-level `errors` array.
 */
export type ErrorPlacement = 'userErrors' | 'errors';

export interface CategoryPolicy {
  /** Status used by REST (RFC 9457 problem+json). */
  httpStatus: number;
  placement: ErrorPlacement;
}

export const CATEGORY_POLICY: Readonly<Record<ErrorCategory, CategoryPolicy>> = {
  VALIDATION: { httpStatus: 400, placement: 'userErrors' },
  AUTHENTICATION: { httpStatus: 401, placement: 'errors' },
  AUTHORIZATION: { httpStatus: 403, placement: 'errors' },
  NOT_FOUND: { httpStatus: 404, placement: 'errors' },
  BUSINESS_RULE: { httpStatus: 422, placement: 'userErrors' },
  CONFLICT: { httpStatus: 409, placement: 'userErrors' },
  RATE_LIMIT: { httpStatus: 429, placement: 'errors' },
  EXTERNAL: { httpStatus: 503, placement: 'errors' },
  INTERNAL: { httpStatus: 500, placement: 'errors' },
};

export interface ErrorDefinition {
  category: ErrorCategory;
  /** True when the same request may succeed if simply retried later. */
  retryable: boolean;
}

const rule = (category: ErrorCategory, retryable = false): ErrorDefinition => ({
  category,
  retryable,
});

/**
 * Every ErrorCode in the GraphQL contract, classified. Typed as a total Record so that a
 * code added to the schema without a classification here fails the build.
 */
export const ERROR_CATALOGUE: Readonly<Record<ErrorCode, ErrorDefinition>> = {
  VALIDATION_FAILED: rule('VALIDATION'),
  NOT_FOUND: rule('NOT_FOUND'),
  FORBIDDEN: rule('AUTHORIZATION'),
  CONFLICT: rule('CONFLICT', true),
  INVALID_STATE_TRANSITION: rule('CONFLICT'),
  VERSION_CONFLICT: rule('CONFLICT'),
  IDEMPOTENCY_KEY_REUSED: rule('CONFLICT'),
  RATE_LIMITED: rule('RATE_LIMIT', true),

  AUTH_INVALID_CREDENTIALS: rule('AUTHENTICATION'),
  AUTH_ACCOUNT_LOCKED: rule('AUTHENTICATION'),
  AUTH_ACCOUNT_DISABLED: rule('AUTHENTICATION'),
  AUTH_TOKEN_EXPIRED: rule('AUTHENTICATION'),
  AUTH_MFA_REQUIRED: rule('AUTHENTICATION'),

  INDENT_ALREADY_SUBMITTED: rule('CONFLICT'),
  INDENT_DUPLICATE_LINE: rule('VALIDATION'),
  APPROVER_NOT_RESOLVED: rule('BUSINESS_RULE'),
  WORKFLOW_NOT_CONFIGURED: rule('BUSINESS_RULE'),
  APPROVAL_ALREADY_ACTED: rule('CONFLICT'),
  APPROVAL_NOT_ASSIGNED: rule('AUTHORIZATION'),
  TRANSFER_SOURCE_INVALID: rule('BUSINESS_RULE'),

  PO_QUANTITY_EXCEEDS_APPROVED: rule('BUSINESS_RULE'),
  PO_DUPLICATE_EXTERNAL_NUMBER: rule('CONFLICT'),
  PO_NOT_OPEN: rule('BUSINESS_RULE'),
  SAP_PO_PRODUCT_MISMATCH: rule('BUSINESS_RULE'),

  GRN_OVER_TOLERANCE: rule('BUSINESS_RULE'),
  GRN_DOCUMENT_REQUIRED: rule('VALIDATION'),
  GRN_DUPLICATE_CHALLAN: rule('CONFLICT'),
  GRN_REVERSAL_EXCEEDS_STOCK: rule('BUSINESS_RULE'),

  INVENTORY_INSUFFICIENT: rule('BUSINESS_RULE'),
  STN_NOT_DISPATCHED: rule('BUSINESS_RULE'),
  STN_RECEIPT_EXCEEDS_DISPATCH: rule('BUSINESS_RULE'),
  PRODUCT_NOT_FOUND: rule('VALIDATION'),
  PRODUCT_INACTIVE: rule('VALIDATION'),

  CYCLE_NOT_ACTIVE: rule('BUSINESS_RULE'),
  CYCLE_CLOSED: rule('BUSINESS_RULE'),
  CYCLE_OVERLAP: rule('CONFLICT'),
  CYCLE_OUT_OF_MONTH: rule('VALIDATION'),
  CYCLE_NOT_OPEN: rule('BUSINESS_RULE'),
  MONTH_LOCKED: rule('BUSINESS_RULE'),
  STATEMENT_FINALIZED: rule('BUSINESS_RULE'),
  FILE_CYCLE_MISMATCH: rule('VALIDATION'),
  COLUMN_NOT_OPEN: rule('BUSINESS_RULE'),

  POD_VERIFICATION_FAILED: rule('BUSINESS_RULE'),
  POD_ALREADY_UPLOADED: rule('CONFLICT'),
  RECONCILIATION_COLUMNS_MISSING: rule('VALIDATION'),
  RECONCILIATION_DUPLICATE_FILE: rule('CONFLICT'),
  INVOICE_DUPLICATE: rule('CONFLICT'),

  DOCUMENT_TOO_LARGE: rule('VALIDATION'),
  DOCUMENT_TYPE_NOT_ALLOWED: rule('VALIDATION'),
  DOCUMENT_NOT_AVAILABLE: rule('BUSINESS_RULE'),

  EXTERNAL_SERVICE_UNAVAILABLE: rule('EXTERNAL', true),
  INTERNAL_ERROR: rule('INTERNAL', true),
};

export function describeError(code: ErrorCode): ErrorDefinition & CategoryPolicy {
  const definition = ERROR_CATALOGUE[code];
  return { ...definition, ...CATEGORY_POLICY[definition.category] };
}
