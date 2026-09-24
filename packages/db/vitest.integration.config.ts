import { defineConfig } from 'vitest/config';

// Integration tests against a migrated, seeded database (`pnpm test:integration`).
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    fileParallelism: false,
  },
});
