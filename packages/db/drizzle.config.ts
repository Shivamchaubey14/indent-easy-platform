import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// Local runs pick up the repository's .env; CI and servers pass real environment variables.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

// Migrations run as the schema owner. The API connects as the unprivileged app role instead.
const url = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL'];
if (!url) throw new Error('Set MIGRATION_DATABASE_URL (or DATABASE_URL) to run drizzle-kit');

export const APP_SCHEMAS = [
  'org',
  'identity',
  'config',
  'catalog',
  'indent',
  'workflow',
  'procurement',
  'receiving',
  'logistics',
  'inventory',
  'mpp',
  'recon',
  'finance',
  'docs',
  'notify',
  'audit',
  'events',
  'io',
  'reporting',
];

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: '../../database/migrations',
  dbCredentials: { url },
  schemaFilter: APP_SCHEMAS,
  // Monthly partitions are managed by SQL and a maintenance job; code only ever
  // addresses the partitioned parent table.
  tablesFilter: ['*', '!*_default', '!*_20[0-9][0-9]_[0-9][0-9]'],
  migrations: { schema: 'drizzle', table: '__drizzle_migrations' },
  strict: true,
  verbose: true,
});
