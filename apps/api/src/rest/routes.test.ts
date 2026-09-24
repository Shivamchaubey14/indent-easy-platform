import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REST_ROUTES } from './routes.js';

interface OpenApi {
  paths: Record<string, Record<string, { operationId?: string }>>;
}

const openapi = parse(
  readFileSync(new URL('../../../../docs/api/openapi.yaml', import.meta.url), 'utf8'),
) as OpenApi;

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const contract = Object.entries(openapi.paths).flatMap(([path, operations]) =>
  Object.entries(operations)
    .filter(([method]) => METHODS.includes(method))
    .map(([method, op]) => ({ method, path, operationId: op.operationId })),
);

describe('REST routes vs OpenAPI contract', () => {
  it('every served route is documented with the same method, path and operationId', () => {
    for (const route of REST_ROUTES) {
      expect(contract).toContainEqual({
        method: route.method,
        path: route.path,
        operationId: route.operationId,
      });
    }
  });

  it('every documented operation has a unique operationId', () => {
    const ids = contract.map((op) => op.operationId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no route is registered twice', () => {
    const keys = REST_ROUTES.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
