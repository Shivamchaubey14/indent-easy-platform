// Introspects the database with drizzle-kit and writes src/schema.ts and src/relations.ts.
//
// Used once to create the baseline. After that src/schema.ts is maintained by hand and
// `drizzle-kit generate` must report no changes against a migrated database. Fixes what
// drizzle-kit cannot type: citext, bytea and tsvector columns become the custom types in
// src/column-types.ts.
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'ie-db-pull-'));

try {
  const config = readFileSync(join(pkgDir, 'drizzle.config.ts'), 'utf8').replace(
    "out: '../../database/migrations'",
    `out: ${JSON.stringify(out)}`,
  );
  const tempConfig = join(pkgDir, 'drizzle.pull.config.ts');
  writeFileSync(tempConfig, config);
  try {
    execSync(`pnpm exec drizzle-kit pull --config "${tempConfig}"`, {
      cwd: pkgDir,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  } finally {
    rmSync(tempConfig, { force: true });
  }

  const customTypes = { bytea: 'bytea', tsvector: 'tsvector', citext: 'citext' };
  let schema = readFileSync(join(out, 'schema.ts'), 'utf8');
  schema = schema.replace(
    /\/\/ TODO: failed to parse database type '(\w+)'\r?\n(\s*\w+: )unknown\(/g,
    (whole, type, prefix) => {
      const custom = customTypes[type];
      if (!custom) throw new Error(`No custom column type for database type '${type}'`);
      return `${prefix}${custom}(`;
    },
  );
  if (/\bunknown\(/.test(schema)) throw new Error('Unmapped unknown() column left in schema');
  // drizzle-kit renders an empty-string default as `.default(')`.
  schema = schema.replaceAll(".default(')", ".default('')");
  schema = schema.replace(/sql`([^`]*)`/g, (_whole, body) => {
    // Backslashes in SQL (regexes such as '^\+[1-9]') must survive the JS template literal.
    let fixed = body.replaceAll('\\', '\\\\');
    // Index expressions come back with the closing cast and parenthesis cut off, e.g.
    // COALESCE(x, '0000…'::uu instead of COALESCE(x, '0000…'::uuid).
    fixed = fixed.replace(/'::u(u(i(d)?)?)?$/, "'::uuid");
    const open = (fixed.match(/\(/g) ?? []).length;
    const close = (fixed.match(/\)/g) ?? []).length;
    return 'sql`' + fixed + ')'.repeat(Math.max(0, open - close)) + '`';
  });
  // bigint's maximum is the identity default and cannot be written as a JS number exactly.
  schema = schema.replaceAll(', maxValue: 9223372036854775807', '');
  // Tables that reference each other (users ↔ documents) defeat type inference; an explicit
  // return type on every constraint callback breaks the cycle.
  schema = schema.replaceAll('}, (table) => [', '}, (table): PgTableExtraConfigValue[] => [');
  schema = schema.replace(
    'import { sql } from "drizzle-orm"',
    'import { sql } from "drizzle-orm"\nimport type { PgTableExtraConfigValue } from "drizzle-orm/pg-core"\nimport { bytea, citext, tsvector } from "./column-types.js"',
  );
  const relations = readFileSync(join(out, 'relations.ts'), 'utf8').replace(
    'from "./schema";',
    'from "./schema.js";',
  );

  writeFileSync(join(pkgDir, 'src', 'schema.ts'), schema);
  writeFileSync(join(pkgDir, 'src', 'relations.ts'), relations);
  execSync('pnpm exec prettier --write src/schema.ts src/relations.ts', {
    cwd: pkgDir,
    stdio: 'ignore',
  });
  console.log('wrote src/schema.ts and src/relations.ts');
} finally {
  rmSync(out, { recursive: true, force: true });
}
