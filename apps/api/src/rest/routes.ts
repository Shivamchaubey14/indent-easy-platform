import type { RequestHandler } from 'express';

/**
 * Every REST operation this build serves, keyed by its OpenAPI operationId. The app registers
 * routes from this table, the docs' status page is generated from it, and a test checks it
 * against docs/api/openapi.yaml, so code, contract and documentation cannot drift apart.
 * Paths use OpenAPI syntax ({id}); they are converted for Express when registered.
 */
export const REST_ROUTES = [
  { operationId: 'liveness', method: 'get', path: '/health/live' },
  { operationId: 'readiness', method: 'get', path: '/health/ready' },
  { operationId: 'startup', method: 'get', path: '/health/startup' },
  { operationId: 'version', method: 'get', path: '/api/v1/version' },
  // Served by the separate metrics listener, not the main app.
  { operationId: 'metrics', method: 'get', path: '/metrics', listener: 'metrics' },
] as const;

export type RestRoute = (typeof REST_ROUTES)[number];

/** Operations the main Express app must provide a handler for. */
export type AppOperationId = Exclude<RestRoute, { listener: 'metrics' }>['operationId'];

export type RestHandlers = Record<AppOperationId, RequestHandler>;

/** `/files/{documentId}` → `/files/:documentId` */
export function toExpressPath(path: string): string {
  return path.replace(/\{(\w+)\}/g, ':$1');
}
