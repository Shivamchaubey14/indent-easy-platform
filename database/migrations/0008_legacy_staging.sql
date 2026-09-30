-- Staging for the migration from the legacy Django app (SRS §52). Owner only: the application role
-- gets no access, because the raw rows hold personal data and legacy password hashes.
--
--  legacy.source_row  every row of the legacy dump, as loaded (table, legacy id, columns as jsonb)
--  legacy.id_map      which new record each legacy record became, per organisation; makes every
--                     step re-runnable (natural-key upserts) for the dress rehearsals
--  legacy.run         one row per migration run, with its reconciliation report
CREATE SCHEMA legacy;--> statement-breakpoint
REVOKE ALL ON SCHEMA legacy FROM PUBLIC;--> statement-breakpoint

CREATE TABLE legacy.source_row (
  table_name  text NOT NULL,
  legacy_id   text NOT NULL,
  data        jsonb NOT NULL,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, legacy_id)
);--> statement-breakpoint

CREATE TABLE legacy.id_map (
  organization_id uuid NOT NULL REFERENCES org.organization(id),
  entity          text NOT NULL,
  legacy_key      text NOT NULL,
  new_id          uuid NOT NULL,
  PRIMARY KEY (organization_id, entity, legacy_key)
);--> statement-breakpoint

CREATE TABLE legacy.run (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES org.organization(id),
  phase           text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  report          jsonb
);
