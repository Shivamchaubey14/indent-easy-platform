import { describeError, type ErrorCode } from '@ie/domain-types';
import { GraphQLError } from 'graphql';
import { currentContext } from '../shared/context.js';
import { ApiError } from '../shared/errors.js';
import type { Logger } from '../shared/logging.js';

function withCode(
  message: string,
  code: ErrorCode,
  source: GraphQLError | undefined,
  details?: Record<string, unknown>,
): GraphQLError {
  const { category, retryable } = describeError(code);
  return new GraphQLError(message, {
    ...(source && {
      nodes: source.nodes,
      path: source.path,
      source: source.source,
      positions: source.positions,
    }),
    extensions: {
      code,
      category,
      requestId: currentContext()?.requestId,
      retryable,
      ...(details && { details }),
    },
  });
}

/**
 * graphql ships separate ESM and CommonJS builds, and tooling can load both, so `instanceof`
 * is unreliable across library boundaries. Recognise GraphQL errors by shape instead.
 */
function isGraphQLError(value: unknown): value is GraphQLError {
  return value instanceof Error && value.name === 'GraphQLError' && 'extensions' in value;
}

/**
 * Yoga's error mask. Expected ApiErrors keep their code and message; anything else is logged
 * and replaced by a generic INTERNAL_ERROR so internals never leak (SRS §26.4).
 */
export function createErrorMask(logger: Logger) {
  return (error: unknown, message: string): Error => {
    const graphqlError = isGraphQLError(error) ? error : undefined;
    const original = graphqlError?.originalError ?? error;
    if (original instanceof ApiError) {
      return withCode(original.message, original.code, graphqlError, original.details);
    }
    // GraphQL errors that already carry a code (parse/validation errors, deliberate throws) pass through.
    if (isGraphQLError(original) && original.extensions['code']) {
      return original === graphqlError
        ? original
        : new GraphQLError(original.message, {
            ...(graphqlError && { nodes: graphqlError.nodes, path: graphqlError.path }),
            extensions: original.extensions,
          });
    }
    // Errors raised while parsing or validating the document (depth, cost, unknown fields) have no
    // underlying exception and describe only the client's query, so they are safe to return.
    if (graphqlError && !graphqlError.originalError) {
      return new GraphQLError(graphqlError.message, {
        nodes: graphqlError.nodes,
        extensions: {
          ...graphqlError.extensions,
          code: 'VALIDATION_FAILED',
          requestId: currentContext()?.requestId,
        },
      });
    }
    logger.error({ err: original }, 'unexpected GraphQL error');
    return withCode(message, 'INTERNAL_ERROR', graphqlError);
  };
}

export const notImplemented = (operation: string) =>
  new GraphQLError(`${operation} is not available yet.`, {
    extensions: {
      code: 'NOT_IMPLEMENTED',
      requestId: currentContext()?.requestId,
      retryable: false,
    },
  });
