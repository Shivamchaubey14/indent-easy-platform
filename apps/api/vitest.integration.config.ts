import { defineConfig } from 'vitest/config';

// Integration tests against a migrated, seeded database and Redis (`pnpm test:integration`).
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    // Setup creates accounts (Argon2) and apps; on a busy machine that takes more than 10 s.
    hookTimeout: 30_000,
  },
});
