-- Document versions and links, import errors and row audit get their own organisation column, so
-- row-level security isolates them like every other organisation table. Added nullable, backfilled
-- from the parent, then made NOT NULL (the tables may hold rows).
ALTER TABLE "docs"."document_link" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "docs"."document_version" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "io"."import_error" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "io"."import_row_audit" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "docs"."document_link" l SET organization_id = d.organization_id
  FROM "docs"."document" d WHERE d.id = l.document_id;--> statement-breakpoint
UPDATE "docs"."document_version" v SET organization_id = d.organization_id
  FROM "docs"."document" d WHERE d.id = v.document_id;--> statement-breakpoint
UPDATE "io"."import_error" e SET organization_id = b.organization_id
  FROM "io"."import_batch" b WHERE b.id = e.batch_id;--> statement-breakpoint
UPDATE "io"."import_row_audit" a SET organization_id = b.organization_id
  FROM "io"."import_batch" b WHERE b.id = a.batch_id;--> statement-breakpoint
ALTER TABLE "docs"."document_link" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "docs"."document_version" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "io"."import_error" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "io"."import_row_audit" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "docs"."document_link" ADD CONSTRAINT "document_link_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs"."document_version" ADD CONSTRAINT "document_version_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "io"."import_error" ADD CONSTRAINT "import_error_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "io"."import_row_audit" ADD CONSTRAINT "import_row_audit_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs"."document_link" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "docs"."document_version" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "io"."import_error" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "io"."import_row_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "p_org_isolation" ON "docs"."document_link" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)) WITH CHECK ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "p_org_isolation" ON "docs"."document_version" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)) WITH CHECK ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "p_org_isolation" ON "io"."import_error" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)) WITH CHECK ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "p_org_isolation" ON "io"."import_row_audit" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)) WITH CHECK ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid));--> statement-breakpoint

-- Import batches are worked by whichever worker claims them: a lease marks the claim, and a batch
-- whose lease ran out (the worker died) is claimed again and resumes where it stopped.
ALTER TABLE "io"."import_batch" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ix_import_batch_pending" ON "io"."import_batch" USING btree ("status" text_ops) WHERE (status = ANY (ARRAY['UPLOADED'::text, 'VALIDATING'::text, 'PROCESSING'::text]));--> statement-breakpoint

-- The worker has no organisation context, so row-level security hides every batch from it. This
-- function (run as the owner) claims the oldest batch that is waiting or whose lease expired, and
-- returns only its id and organisation; the worker then works on it with that organisation set.
CREATE FUNCTION io.claim_import_batch(lease interval)
RETURNS TABLE (batch_id uuid, organization_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  UPDATE io.import_batch b
     SET lease_until = now() + lease,
         status = CASE WHEN b.status = 'UPLOADED' THEN 'VALIDATING' ELSE b.status END,
         started_at = coalesce(b.started_at, now())
   WHERE b.id = (
     SELECT id FROM io.import_batch
      WHERE status IN ('UPLOADED', 'VALIDATING', 'PROCESSING')
        AND (lease_until IS NULL OR lease_until < now())
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED)
  RETURNING b.id, b.organization_id
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION io.claim_import_batch(interval) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION io.claim_import_batch(interval) TO ie_app;--> statement-breakpoint

-- Document types with their allowed files and limits (SRS §35, DOC-002: 10 MB images and PDFs,
-- 25 MB spreadsheets). Idempotent; run for every organisation, now and by org:bootstrap and the seed.
CREATE FUNCTION docs.seed_document_types(org uuid) RETURNS void
LANGUAGE sql SET search_path = pg_catalog, public AS $$
  INSERT INTO docs.document_type (organization_id, code, name, allowed_mime, max_bytes, retention_days, requires_scan)
  SELECT org, t.code, t.name, t.mime, t.max_bytes, t.retention, t.scan
  FROM (VALUES
    ('IMPORT_FILE', 'Import file', ARRAY[
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       'application/vnd.ms-excel', 'text/csv'], 26214400::bigint, 90, true),
    ('EXPORT_FILE', 'Export file', ARRAY[
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv',
       'application/pdf', 'application/zip'], 104857600::bigint, 7, false),
    ('CHALLAN', 'Delivery challan', ARRAY['application/pdf', 'image/jpeg', 'image/png'], 10485760::bigint, NULL, true),
    ('INVOICE', 'Invoice', ARRAY['application/pdf', 'image/jpeg', 'image/png'], 10485760::bigint, NULL, true),
    ('APPROVAL_EVIDENCE', 'Approval evidence', ARRAY['application/pdf', 'image/jpeg', 'image/png'], 10485760::bigint, NULL, true),
    ('EWAY_BILL', 'E-way bill', ARRAY['application/pdf', 'image/jpeg', 'image/png'], 10485760::bigint, NULL, true),
    ('STN_COPY', 'STN copy', ARRAY['application/pdf', 'image/jpeg', 'image/png'], 10485760::bigint, NULL, true),
    ('POD', 'Proof of delivery', ARRAY['application/pdf', 'image/jpeg', 'image/png'], 10485760::bigint, NULL, true),
    ('QUOTATION', 'Quotation', ARRAY['application/pdf', 'image/jpeg', 'image/png'], 10485760::bigint, NULL, true),
    ('PHOTO', 'Photo', ARRAY['image/jpeg', 'image/png'], 10485760::bigint, NULL, true),
    ('SIGNATURE', 'Signature', ARRAY['image/jpeg', 'image/png'], 1048576::bigint, NULL, true),
    ('SEAL', 'Seal', ARRAY['image/jpeg', 'image/png'], 1048576::bigint, NULL, true),
    ('OTHER', 'Other', ARRAY['application/pdf', 'image/jpeg', 'image/png'], 10485760::bigint, NULL, true)
  ) AS t(code, name, mime, max_bytes, retention, scan)
  ON CONFLICT (organization_id, code) DO NOTHING
$$;--> statement-breakpoint
SELECT docs.seed_document_types(id) FROM org.organization;
