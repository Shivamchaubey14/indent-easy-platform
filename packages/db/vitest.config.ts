import { defineConfig } from 'vitest/config';

// Unit tests only. *.int.test.ts need a migrated database: see vitest.integration.config.ts.
export default defineConfig({
  test: {
    exclude: ['src/**/*.int.test.ts', 'node_modules/**', 'dist/**'],
    passWithNoTests: true,
  },
});
