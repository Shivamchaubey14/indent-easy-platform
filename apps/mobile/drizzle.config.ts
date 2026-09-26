import { defineConfig } from 'drizzle-kit';

// The on-device SQLite database (SRS §18.1, §36). `pnpm --filter @ie/mobile db:generate` writes
// migrations that the app applies at start-up.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
