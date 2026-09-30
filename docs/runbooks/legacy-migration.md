# Runbook: migrating master data from the legacy app (M1)

SRS §52: ETL from a dump of the legacy MySQL database into a staging schema, then idempotent
transforms into the new tables, with a reconciliation report for business sign-off. This runbook
covers **M1, master data**; open transactions, opening stock, history and documents (M2–M5) come
later.

## What M1 migrates

| Legacy | Becomes | Notes |
|---|---|---|
| `choices.LOCATION_CHOICES`, `BMCOrMCC`, user location strings | `org.location` | Matched by name (case, spaces and punctuation ignored). `…H.O` → head office; BMC table → BMC/MCC with the SAP plant; other names → type OTHER, listed for review |
| `choices.DEPARTMENT_CHOICES`, user departments | `org.department` | Departments found only on users are listed |
| `Employee`, `choices.EMPLOYEE_CODE_CHOICES` | `org.employee` | Codes without a name are listed |
| `CustomUser`, `MCCBMCUser` | `identity.app_user`, roles, user locations | Roles from the flags (`is_superuser` → ADMIN + SUPER_ADMIN, `is_hod` → HOD, `is_purchase` → PURCHASE_USER, `is_finance` → FINANCE_USER, `is_logistic` → LOGISTICS_USER, none → STORE_USER). Existing accounts with the same e-mail keep their password and roles |
| Django password hashes | `password_hash` | DEC-004 (OQ-025): `pbkdf2_sha256` hashes are kept and re-hashed at the first sign-in while `legacy_hash_login` is on; other hashes are dropped and listed (the user resets the password) |
| `Product` | `catalog.product` | Code = legacy code or `P` + id (5 digits); unit via the UOM legacy codes; category by name; `hod` → owner; Service category → `is_service` |
| `ProductMapping*` groups | `catalog.product_external_code` | The group's INDENT_EASY mapping identifies the product (code or name); SAP/NDDB mappings become its codes |
| `Vendor`, `ProductVendor` | `catalog.vendor` + contacts, `catalog.vendor_product` | Duplicate names merged (case, punctuation, "Private Limited" = "Pvt Ltd"; OQ-006); comma/semicolon e-mail lists split into contacts; `NULL` and invalid e-mails dropped and listed |
| `MPPWithCode` | `catalog.mpp` | Code = transaction code (MPPs without one are listed, not migrated); name without the code; mobile → E.164; legacy cycle bands |

WhatsApp tables and Django internals are never staged (DEC-001).

## Running it

Take a dump of the legacy database **without secrets** (no `.env`, no `settings.py`; OQ-004):

```sh
mysqldump --single-transaction --skip-lock-tables shwetdhara_db > legacy.sql
```

The organisation must exist first (`pnpm org:bootstrap --name …` on a fresh database).

### Locally

```sh
# dry run: stages the dump, migrates in a transaction, writes the report, rolls back
pnpm legacy:migrate --organization <org id> --dump legacy.sql --report m1.md
# after the report is signed off
pnpm legacy:migrate --organization <org id> --report m1.md --commit
```

### On a VM (as the schema owner, from the API image)

```sh
cd /opt/indent-easy
docker compose run --rm -v "$PWD/legacy.sql:/tmp/legacy.sql:ro" -v "$PWD:/out" migrate \
  dist/cli/legacy-migrate.js --organization <org id> --dump /tmp/legacy.sql --report /out/m1.md
```

Add `--commit` once the report is accepted. Delete the dump from the VM afterwards: it holds
personal data and password hashes.

## Re-running

Every step is idempotent through `legacy.id_map`: run again after fixing data or deciding an
issue, and records already migrated are updated, not duplicated. Loading a newer dump replaces
the staged rows. Every run is kept in `legacy.run` with its report, and audited as
`LEGACY_MIGRATION_RUN`.

## After cutover

Switch `legacy_hash_login` on (Administration › Feature flags) so users sign in with their old
passwords; each first sign-in replaces the legacy hash. Switch it off at the end of the
transition: anyone who has not signed in by then resets the password. Drop the `legacy` schema's
rows once the migration is signed off (`TRUNCATE legacy.source_row`).

The `legacy` schema belongs to the owner role only: the application cannot read it.
