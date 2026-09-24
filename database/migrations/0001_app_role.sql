-- Application role.
--
-- The API, worker and scheduler connect as ie_app. It owns nothing, which is what makes the
-- row-level security policies apply to it: PostgreSQL skips RLS for table owners and superusers.
-- Migrations keep running as the owner. The role is created without LOGIN here; each
-- environment grants LOGIN and a password outside of migrations, so no secret is ever in Git.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ie_app') THEN
    CREATE ROLE ie_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['org','identity','config','catalog','indent','workflow','procurement',
                           'receiving','logistics','inventory','mpp','recon','finance','docs',
                           'notify','audit','events','io','reporting']
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO ie_app', s);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO ie_app', s);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO ie_app', s);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO ie_app', s);
    -- Objects created by later migrations (run by the owner) get the same grants.
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ie_app', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO ie_app', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO ie_app', s);
  END LOOP;
END $$;
--> statement-breakpoint
-- History tables: the app appends and reads, never rewrites. Triggers already reject UPDATE and
-- DELETE; withholding the privilege makes the intent explicit and fails earlier.
REVOKE UPDATE, DELETE ON inventory.stock_transaction, audit.audit_log, audit.security_event,
  workflow.approval_action, reporting.stock_statement_cell_audit FROM ie_app;
--> statement-breakpoint
-- Readiness compares applied migrations with the ones shipped in the build.
GRANT USAGE ON SCHEMA drizzle TO ie_app;
--> statement-breakpoint
GRANT SELECT ON drizzle.__drizzle_migrations TO ie_app;
