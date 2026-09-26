import { loadConfig } from '@ie/config';
import { loadTypeDefs } from '@ie/graphql/schema';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { RequestHandler } from 'express';
import { createApp } from './app.js';
import type { AuthOperationId } from './modules/identity/index.js';
import { createGraphQLServer } from './graphql/server.js';
import { Health } from './shared/health.js';
import { createMetrics } from './shared/metrics.js';
import { buildInfo } from './shared/version.js';

const config = loadConfig({
  PUBLIC_BASE_URL: 'http://localhost:5173',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgres://ie:pw@localhost:5432/indent_easy',
  REDIS_URL: 'redis://localhost:6380',
  S3_BUCKET_DOCUMENTS: 'ie-documents',
  S3_BUCKET_EXPORTS: 'ie-exports',
  S3_BUCKET_IMPORTS: 'ie-imports',
  S3_BUCKET_QUARANTINE: 'ie-quarantine',
  SMTP_HOST: 'localhost',
  MAIL_FROM: 'no-reply@indent-easy.local',
});
const logger = pino({ level: process.env['TEST_LOG'] ?? 'silent' });
const typeDefs = loadTypeDefs();

// Sign-in itself is covered by the integration tests against PostgreSQL and Redis.
const notUsed: RequestHandler = (_req, res) => {
  res.status(501).end();
};
const anonymousIdentity = {
  authenticate: ((_req, _res, next) => next()) as RequestHandler,
  handlers: Object.fromEntries(
    (
      [
        'login',
        'refreshToken',
        'getCsrfToken',
        'logout',
        'logoutAll',
        'forgotPassword',
        'resetPassword',
        'changePassword',
        'getJwks',
      ] as const
    ).map((id) => [id, notUsed]),
  ) as Record<AuthOperationId, RequestHandler>,
};

function build(options: { databaseUp?: boolean; organizationId?: string } = {}) {
  const { databaseUp = true, organizationId = 'org-1' } = options;
  const health = new Health(
    {
      database: () =>
        databaseUp ? Promise.resolve() : Promise.reject(new Error('connection refused')),
      redis: () => Promise.resolve('PONG'),
    },
    logger,
  );
  const graphql = createGraphQLServer({
    config,
    logger,
    typeDefs,
    organizationId: () => Promise.resolve(organizationId),
    services: {
      featureFlags: {
        list: (orgId) =>
          Promise.resolve(
            orgId === 'org-1'
              ? [{ key: 'hindi_ui', enabled: true, rules: null, description: 'Hindi UI' }]
              : [],
          ),
      },
    },
  });
  return {
    health,
    app: createApp({
      config,
      logger,
      metrics: createMetrics(),
      health,
      graphql,
      buildInfo: buildInfo(typeDefs),
      identity: anonymousIdentity,
    }),
  };
}

const gql = (app: ReturnType<typeof build>['app'], query: string) =>
  request(app).post('/graphql').set('Content-Type', 'application/json').send({ query });

describe('health probes', () => {
  it('live always answers ok', async () => {
    const res = await request(build().app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('startup fails until the server has started', async () => {
    const { app, health } = build();
    expect((await request(app).get('/health/startup')).status).toBe(503);
    health.markStarted();
    expect((await request(app).get('/health/startup')).status).toBe(200);
  });

  it('ready reports each dependency and fails when one is down', async () => {
    const up = await request(build().app).get('/health/ready');
    expect(up.status).toBe(200);
    expect(up.body.checks).toMatchObject({ database: { status: 'ok' }, redis: { status: 'ok' } });

    const down = await request(build({ databaseUp: false }).app).get('/health/ready');
    expect(down.status).toBe(503);
    expect(down.body).toMatchObject({ status: 'fail', checks: { database: { status: 'fail' } } });
    expect(JSON.stringify(down.body)).not.toContain('connection refused');
  });

  it('ready fails while draining', async () => {
    const { app, health } = build();
    health.startDraining();
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.checks.draining).toEqual({ status: 'fail', latencyMs: 0 });
  });
});

describe('request context', () => {
  it('echoes a valid X-Request-ID and generates one otherwise', async () => {
    const { app } = build();
    const given = await request(app).get('/health/live').set('X-Request-ID', 'req-01926f6e8a1c');
    expect(given.headers['x-request-id']).toBe('req-01926f6e8a1c');

    const hostile = await request(app)
      .get('/health/live')
      .set('X-Request-ID', 'not a valid id; has spaces');
    expect(hostile.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('REST', () => {
  it('serves build information', async () => {
    const res = await request(build().app).get('/api/v1/version');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      version: '0.1.0',
      graphqlSchemaHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('answers unknown routes with problem+json', async () => {
    const res = await request(build().app).get('/api/v1/nope').set('X-Request-ID', 'req-42');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 404, code: 'NOT_FOUND', requestId: 'req-42' });
  });

  it('rejects malformed JSON without leaking parser internals', async () => {
    const res = await request(build().app)
      .post('/api/v1/version')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      detail: 'Request body is not valid JSON.',
    });
  });
});

describe('GraphQL', () => {
  it('resolves featureFlags for the caller organisation', async () => {
    const res = await gql(build().app, '{ featureFlags { key enabled description } }');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { featureFlags: [{ key: 'hindi_ui', enabled: true, description: 'Hindi UI' }] },
    });
  });

  it('answers unimplemented operations with NOT_IMPLEMENTED', async () => {
    const res = await gql(build().app, '{ me { id } }');
    expect(res.body.errors[0]).toMatchObject({
      message: 'Query.me is not available yet.',
      extensions: { code: 'NOT_IMPLEMENTED' },
    });
  });

  it('refuses abusive queries before executing them', async () => {
    const deep =
      '{ node(id: "1") { ' +
      '... on Location { warehouses { location { '.repeat(6) +
      'id' +
      ' } } }'.repeat(6) +
      ' } }';
    const res = await gql(build().app, deep);
    // Deep nesting trips the cost limit before the depth limit; either way nothing executes.
    expect(res.body.data).toBeUndefined();
    expect(res.body.errors[0]).toMatchObject({
      message: expect.stringMatching(/depth|cost/i),
      extensions: { code: 'VALIDATION_FAILED' },
    });
  });
});
