import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { runWithContext, type Locale } from '../context.js';

// Accepted incoming IDs: UUIDs or similar opaque tokens, at most 64 characters (SRS §26.1).
const SAFE_ID = /^[A-Za-z0-9._:-]{1,64}$/;

function safeHeader(value: string | undefined): string | undefined {
  return value && SAFE_ID.test(value) ? value : undefined;
}

/**
 * Establishes the request context: X-Request-ID (accepted or generated, and echoed back),
 * X-Correlation-ID (defaults to the request ID), client identity and locale.
 */
export function requestContext(): RequestHandler {
  return (req, res, next) => {
    const requestId = safeHeader(req.get('x-request-id')) ?? randomUUID();
    res.setHeader('X-Request-ID', requestId);
    const preferred = req.acceptsLanguages('en-IN', 'en', 'hi-IN', 'hi');
    const locale: Locale = preferred && preferred.startsWith('hi') ? 'hi' : 'en';
    runWithContext(
      {
        requestId,
        correlationId: safeHeader(req.get('x-correlation-id')) ?? requestId,
        clientName: safeHeader(req.get('x-client-name')),
        clientVersion: safeHeader(req.get('x-client-version')),
        locale,
      },
      next,
    );
  };
}
