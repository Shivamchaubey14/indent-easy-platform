import { defineConfig } from 'vitest/config';

// Unit tests only. *.int.test.ts need PostgreSQL and Redis: see vitest.integration.config.ts.
export default defineConfig({
  test: {
    exclude: ['src/**/*.int.test.ts', 'node_modules/**', 'dist/**'],
  },
});
