# Runbook: database schema and migrations

PostgreSQL 16 is the single system of record. The schema lives in two places that must agree:

| What | Where | Role |
|---|---|---|
| Migrations | `database/migrations/*.sql` + `meta/` | What actually runs against a database, reviewed as SQL (SRS ADR-015) |
| Typed schema | `packages/db/src/schema.ts` (+ `partitioned.ts`) | What code queries through Drizzle |

`0000_baseline.sql` is the original hand-written schema: 19 schemas, RLS policies, triggers,
partitions and generated columns. `schema.ts` was generated from a database built by it and is
maintained by hand from here on.

## Roles

| Role | Used by | Privileges |
|---|---|---|
| `ie` (owner) | migrations, seeds, `pnpm db:psql` | Owns every object. PostgreSQL skips row-level security for owners |
| `ie_app` | API, worker, scheduler | Read/write data, **subject to row-level security**. Cannot update or delete history tables (stock ledger, audit, approvals, report cell audit) |

Every business query runs inside `withOrgContext` (the API) or a transaction that sets
`app.org_id`. Without it `ie_app` sees no organisation-scoped rows at all. Migration `0001_app_role`
creates the role without a login; each environment grants the login and password outside of Git.
Locally, `database/init/10-app-role.sh` does it, and `.env` has both connection strings.

## Everyday commands

```sh
pnpm infra:up           # PostgreSQL, Redis, MinIO, Mailpit
pnpm db:migrate         # apply pending migrations (as the owner)
pnpm db:seed            # dev organisation + feature flags (idempotent)
pnpm db:reset           # wipe the LOCAL database, migrate, seed
pnpm db:smoke           # database invariant checks (rolled back)
pnpm test:integration   # RLS and permission tests as ie_app
```

## Changing the schema

1. **Tables, columns, indexes, FKs, checks:** edit `packages/db/src/schema.ts`, then run
   `pnpm db:generate --name <what_changed>`. Review the generated SQL like code, then commit the
   `.sql`, `meta/*_snapshot.json` and `meta/_journal.json`.
2. **Anything Drizzle can't express** (functions, triggers, partitions, RLS policies, grants,
   data fixes): `pnpm db:generate --custom --name <what>` creates an empty registered migration;
   write the SQL by hand. Separate statements with `--> statement-breakpoint`.
3. **Partitioned tables** are defined in `partitioned.ts`, outside drizzle-kit's view. Change them
   only with custom SQL migrations.
4. After either kind of change, `pnpm db:generate` must print **"No schema changes"**. If it
   proposes changes you didn't make, `schema.ts` and the migrations have drifted: fix that before
   merging.

Migrations must be backward compatible with the previous app version (expand, then contract),
because the migrator runs before the new API starts and the old one may still be serving.

## drizzle-kit pitfalls (seen on this schema)

`packages/db/scripts/pull-schema.mjs` works around these when regenerating `schema.ts`. Keep them
in mind when editing by hand:

| Pitfall | Effect | Rule |
|---|---|---|
| Backslashes in `` sql`...` `` template literals | `'^\+91'` silently becomes `'^+91'`: a different regex | Write `\\` inside `sql` templates |
| Expression indexes (`COALESCE(... ::uuid)`) are introspected truncated | Invalid index SQL in generated migrations | Compare with `pg_indexes.indexdef` |
| `bigint` identity `maxValue` | Precision loss in JS numbers | Omit it; the bigint maximum is the default |
| `citext`, `bytea`, `tsvector` are unknown to drizzle-kit | `unknown()` columns | Use `column-types.ts` |
| Partitioned tables are not introspected | Missing from `schema.ts` | Define in `partitioned.ts` |
| Tables that reference each other | TypeScript "implicitly has type any" | Annotate the constraint callback as `PgTableExtraConfigValue[]` |

## Readiness

The API's `/health/ready` compares `drizzle.__drizzle_migrations` with the journal shipped in the
build, and fails (503) while any migration is pending. A new version never takes traffic against
an older schema.
