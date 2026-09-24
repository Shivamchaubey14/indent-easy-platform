import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './index.js';

const base = {
  PUBLIC_BASE_URL: 'http://localhost:5173',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173, http://localhost:8081',
  DATABASE_URL: 'postgres://ie:pw@localhost:5432/indent_easy',
  REDIS_URL: 'redis://localhost:6380',
  S3_BUCKET_DOCUMENTS: 'ie-documents',
  S3_BUCKET_EXPORTS: 'ie-exports',
  S3_BUCKET_IMPORTS: 'ie-imports',
  S3_BUCKET_QUARANTINE: 'ie-quarantine',
  SMTP_HOST: 'localhost',
  MAIL_FROM: 'Indent Easy <no-reply@indent-easy.local>',
};

function problemsOf(env: Record<string, string>): string[] {
  try {
    loadConfig(env);
  } catch (err) {
    if (err instanceof ConfigError) return err.problems;
    throw err;
  }
  return [];
}

describe('loadConfig', () => {
  it('applies defaults and groups settings', () => {
    const config = loadConfig(base);
    expect(config.http.port).toBe(8080);
    expect(config.http.corsAllowedOrigins).toEqual([
      'http://localhost:5173',
      'http://localhost:8081',
    ]);
    expect(config.database.poolMax).toBe(10);
    expect(config.auth.accessTtlSeconds).toBe(600);
    expect(config.graphql).toEqual({
      maxDepth: 10,
      maxCost: 5000,
      persistedOnly: true,
      introspection: false,
    });
    expect(config.timezone).toBe('Asia/Kolkata');
  });

  it('treats blank optional values as unset', () => {
    const config = loadConfig({ ...base, DATABASE_READ_URL: '', S3_ENDPOINT: '  ' });
    expect(config.database.readUrl).toBeUndefined();
    expect(config.storage.endpoint).toBeUndefined();
  });

  it('reports every missing required variable at once', () => {
    const problems = problemsOf({});
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^DATABASE_URL:/),
        expect.stringMatching(/^REDIS_URL:/),
        expect.stringMatching(/^PUBLIC_BASE_URL:/),
      ]),
    );
  });

  it('rejects non-postgres database URLs', () => {
    expect(problemsOf({ ...base, DATABASE_URL: 'mysql://root@localhost/indent' })).toEqual([
      expect.stringMatching(/^DATABASE_URL:/),
    ]);
  });

  it('rejects wildcard CORS origins', () => {
    expect(problemsOf({ ...base, CORS_ALLOWED_ORIGINS: '*' })).toEqual([
      'CORS_ALLOWED_ORIGINS: wildcards are not allowed',
    ]);
  });

  it('requires secrets and disables introspection in production', () => {
    const problems = problemsOf({ ...base, APP_ENV: 'prod', GRAPHQL_INTROSPECTION: 'true' });
    expect(problems).toEqual([
      'JWT_SIGNING_KEYS: required in prod',
      'CSRF_SECRET: required in prod',
      'GRAPHQL_INTROSPECTION: must be false in prod',
    ]);
  });

  it('never echoes values in error messages', () => {
    const secret = 'mysql://root:SuperSecret123@db/indent';
    expect(problemsOf({ ...base, DATABASE_URL: secret }).join('\n')).not.toContain(
      'SuperSecret123',
    );
  });
});
