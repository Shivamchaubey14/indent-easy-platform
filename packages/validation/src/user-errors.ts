import type { ErrorCode, UserError } from '@ie/graphql';
import type { z } from 'zod';

/**
 * Converts a Zod failure into GraphQL `UserError`s. Field paths are prefixed with the argument
 * name ("input") so they match the shape in the contract, e.g. ["input","lines","2","quantity"].
 */
export function toUserErrors(error: z.ZodError, argument = 'input'): UserError[] {
  return error.issues.map((issue) => {
    const params =
      'params' in issue ? (issue.params as Record<string, unknown> | undefined) : undefined;
    const { errorCode, ...details } = params ?? {};
    return {
      code: (typeof errorCode === 'string' ? errorCode : 'VALIDATION_FAILED') as ErrorCode,
      message: issue.message,
      field: [argument, ...issue.path.map(String)],
      details: Object.keys(details).length > 0 ? details : null,
    };
  });
}
