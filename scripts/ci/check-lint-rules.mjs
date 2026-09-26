// Proves the architecture lint rules actually bite: writes deliberately wrong files, lints them,
// and fails unless each one is rejected by the expected rule. Files are always removed again.
// Run: node scripts/ci/check-lint-rules.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ESLint } from 'eslint';

const cases = [
  {
    what: 'a web feature imports another feature’s internals',
    file: 'apps/web/src/features/auth/zz-lint-probe.ts',
    code: "import { featureFlagsQuery } from '../dashboard/api';\nexport const probe = featureFlagsQuery;\n",
    rule: 'boundaries/dependencies',
  },
  {
    what: 'shared web code imports a feature',
    file: 'apps/web/src/components/zz-lint-probe.ts',
    code: "import { featureFlagsQuery } from '../features/dashboard/api';\nexport const probe = featureFlagsQuery;\n",
    rule: 'boundaries/dependencies',
  },
  {
    what: 'a package imports an app',
    file: 'packages/validation/src/zz-lint-probe.ts',
    code: "import { REST_ROUTES } from '../../../apps/api/src/rest/routes.js';\nexport const probe = REST_ROUTES;\n",
    rule: 'boundaries/dependencies',
  },
  {
    what: 'API code outside a module bypasses the module’s index.ts',
    file: 'apps/api/src/graphql/zz-lint-probe.ts',
    code: "import { postgresFeatureFlags } from '../modules/configuration/feature-flags.js';\nexport const probe = postgresFeatureFlags;\n",
    rule: 'boundaries/dependencies',
  },
  {
    what: 'shared API infrastructure depends on a module',
    file: 'apps/api/src/shared/zz-lint-probe.ts',
    code: "import { configurationResolvers } from '../modules/configuration/index.js';\nexport const probe = configurationResolvers;\n",
    rule: 'boundaries/dependencies',
  },
  {
    what: 'the domain layer imports a database driver',
    file: 'apps/api/src/modules/configuration/domain/zz-lint-probe.ts',
    code: "import pg from 'pg';\nexport const probe = pg;\n",
    rule: 'no-restricted-imports',
  },
  {
    what: 'a web feature calls fetch directly',
    file: 'apps/web/src/features/dashboard/zz-lint-probe.ts',
    code: "export const probe = () => fetch('/api/v1/version');\n",
    rule: 'no-restricted-globals',
  },
  {
    what: 'hard-coded user-facing text in JSX',
    file: 'apps/web/src/features/dashboard/zz-lint-probe-jsx.tsx',
    code: 'export const Probe = () => <p>Hello there</p>;\n',
    rule: 'i18next/no-literal-string',
  },
  {
    what: 'a promise is neither awaited nor handled',
    file: 'apps/api/src/shared/zz-lint-probe-promise.ts',
    code: 'async function work(): Promise<void> {}\nexport function probe(): void {\n  work();\n}\n',
    rule: '@typescript-eslint/no-floating-promises',
  },
];

// Write every probe first, then lint them in one pass. typescript-eslint's project service
// caches each tsconfig's file list per process, so a file created after its project was loaded
// may not be seen. Each probe needs its own basename: TypeScript drops x.tsx when x.ts exists.
let failed = 0;
try {
  for (const c of cases) {
    mkdirSync(dirname(c.file), { recursive: true });
    writeFileSync(c.file, c.code);
  }
  const results = await new ESLint().lintFiles(cases.map((c) => c.file));
  for (const c of cases) {
    const result = results.find((r) => r.filePath.replaceAll('\\', '/').endsWith(c.file));
    const rules = (result?.messages ?? []).map((m) => m.ruleId ?? `parse error: ${m.message}`);
    if (rules.includes(c.rule)) {
      console.log(`ok   ${c.what}`);
    } else {
      failed++;
      console.log(`FAIL ${c.what}: expected ${c.rule}, got ${JSON.stringify(rules)}`);
    }
  }
} finally {
  for (const c of cases) rmSync(c.file, { force: true });
  rmSync('apps/api/src/modules/configuration/domain', { recursive: true, force: true });
}

if (failed) {
  console.error(`::error::${failed} lint rule check(s) failed`);
  process.exit(1);
}
