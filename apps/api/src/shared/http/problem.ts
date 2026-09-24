import { STATUS_CODES } from 'node:http';
import { describeError, type ErrorCode } from '@ie/domain-types';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { currentContext } from '../context.js';
import { ApiError } from '../errors.js';
import type { Logger } from '../logging.js';

interface ProblemOptions {
  detail?: string;
  details?: Record<string, unknown>;
  /** Overrides the catalogue status where HTTP has a more precise one (e.g. 413). */
  status?: number;
}

/** Sends an RFC 9457 problem+json response using the shared error catalogue (SRS §26.4). */
export function sendProblem(res: Response, code: ErrorCode, options: ProblemOptions = {}): void {
  const status = options.status ?? describeError(code).httpStatus;
  res
    .status(status)
    .type('application/problem+json')
    .json({
      type: `urn:indent-easy:problem:${code.toLowerCase().replaceAll('_', '-')}`,
      title: STATUS_CODES[status] ?? 'Error',
      status,
      code,
      ...(options.detail && { detail: options.detail }),
      requestId: currentContext()?.requestId ?? res.getHeader('X-Request-ID'),
      ...(options.details && { details: options.details }),
    });
}

export function notFound(): RequestHandler {
  return (req, res) =>
    sendProblem(res, 'NOT_FOUND', { detail: `No route for ${req.method} ${req.path}` });
}

interface BodyParserError {
  type?: string;
}

/** Last-resort handler: known errors keep their code; anything else becomes INTERNAL_ERROR. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof ApiError) {
      sendProblem(res, err.code, {
        detail: err.message,
        ...(err.details && { details: err.details }),
      });
      return;
    }
    const parserError = (err ?? {}) as BodyParserError;
    if (parserError.type === 'entity.too.large') {
      sendProblem(res, 'VALIDATION_FAILED', { status: 413, detail: 'Request body is too large.' });
      return;
    }
    if (parserError.type === 'entity.parse.failed') {
      sendProblem(res, 'VALIDATION_FAILED', { detail: 'Request body is not valid JSON.' });
      return;
    }
    // Never return stack traces, SQL or provider responses to clients.
    logger.error({ err }, 'unhandled error');
    sendProblem(res, 'INTERNAL_ERROR');
  };
}
