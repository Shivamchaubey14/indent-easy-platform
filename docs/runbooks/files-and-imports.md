# Runbook: file uploads and imports

## Uploads (SRS §35)

1. The client hashes the file (SHA-256) and calls `POST /api/v1/files/upload-intents` with the
   document type, name, MIME type, size and hash. The API checks the type's allowed MIME types and
   size limit (`docs.document_type`, seeded per organisation by `docs.seed_document_types`) and
   returns a signed PUT URL (10 minutes). Type and checksum are part of the signature.
2. The client PUTs the file **straight to object storage**; files never pass through the API.
3. `POST /api/v1/files/{id}/complete` checks the object is there with the right size, moves the
   document to `PENDING_SCAN` and emits `DocumentUploaded`.
4. The worker's `document-check` consumer re-reads the file: SHA-256 and size must match, the
   first bytes must fit the declared type (an `.exe` renamed `.xlsx` fails), then ClamAV scans it
   when `CLAMAV_HOST` is set. Clean → `AVAILABLE` + `DocumentAvailable`. Otherwise the object moves
   to the quarantine bucket, the document becomes `QUARANTINED` and a security event is written.
5. `GET /api/v1/files/{id}/download` redirects to a signed GET URL (5 minutes). Import and export
   files are visible only to their owner.

Without `CLAMAV_HOST` documents are checked by checksum and signature only and recorded with scan
status `SKIPPED` (a warning is logged). Locally, start ClamAV with
`docker compose -f infrastructure/docker/compose.yaml -p indent-easy --profile scan up -d clamav`
(about 1 GB of memory; stop it when done) and set `CLAMAV_HOST=localhost`.

`S3_PUBLIC_ENDPOINT` is where browsers reach the object store, if not at `S3_ENDPOINT`. Signed
URLs include the host and path, so the store must be reachable at that address without a path
prefix. The browser needs CORS on the store for its origin (MinIO allows it by default) and the
web CSP must allow it in `connect-src`.

## Imports (SRS OP-12)

| Kind | Permission | Key | Notes |
|---|---|---|---|
| `PRODUCT_MAPPING` | `product:map_external` | product code (or unique name) | Legacy engine checks; products must exist |
| `VENDOR_PRODUCT` | `vendor:map_products` | vendor code or name + product code | Pairs not in the file are kept |
| `MPP_MASTER` | `mpp:import` + location scope | MPP code | `deactivateMissing` only touches BMCs in the file; never deletes |

Flow: upload the file as `IMPORT_FILE` → `startImport` (preview) → the worker validates every row
into a preview (counts, problems per row, an XLSX report) → `commitImport` → the worker applies it
in chunks of 1,000 rows, each row in a savepoint → `PROCESSED` or `PROCESSED_WITH_EXCEPTIONS`,
`IMPORT_COMMITTED` audit and `ImportCompleted`. `discardImport` drops a preview.

- The worker claims batches with `io.claim_import_batch` (lease 5 minutes, renewed per chunk).
  A batch whose worker died is claimed again when the lease runs out; the file is planned again
  against the current data, so rows already applied show as unchanged.
- The same file (same kind and SHA-256) is refused with `RECONCILIATION_DUPLICATE_FILE` unless
  `force` is set.
- `GET /api/v1/imports/templates/{kind}` returns the kind's template filled with the current
  data: the export and the starting point for the next import.
- Files are read whole (at most 25 MB, 100,000 rows). ExcelJS's streaming reader is not used: in
  4.4 it fails at random when a worksheet comes before `workbook.xml` in the ZIP. `.xls` is refused
  with a request to save as `.xlsx`.

### Looking into a batch

```sql
-- as the owner (pnpm db:psql): state, counts and lease
SELECT id, kind, status, total_rows, processed_rows, failed_rows, lease_until, metrics
FROM io.import_batch ORDER BY created_at DESC LIMIT 10;
SELECT row_index, rule, message FROM io.import_error WHERE batch_id = '<id>' ORDER BY id;
SELECT row_index, action, entity_id FROM io.import_row_audit WHERE batch_id = '<id>' ORDER BY id;
```

A batch stuck in `VALIDATING`/`PROCESSING` with an old `lease_until` means no worker is running:
check `journalctl`/`docker compose logs worker`. `FAILED` with `metrics.failure` = `UPLOADER_NOT_ALLOWED`
means the uploader lost the permission or was deactivated before the worker got to it.
