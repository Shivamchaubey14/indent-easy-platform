-- The audit log was left out of the baseline's row-level security (its schema was not in the
-- list), so the application role could read every organisation's audit trail. Every write already
-- happens with app.org_id set; reads through the parent table now see one organisation only.
ALTER TABLE audit.audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY p_org_isolation ON audit.audit_log AS PERMISSIVE FOR ALL TO public
  USING (organization_id = (NULLIF(current_setting('app.org_id', true), ''))::uuid)
  WITH CHECK (organization_id = (NULLIF(current_setting('app.org_id', true), ''))::uuid);--> statement-breakpoint

-- Reference configuration for an organisation (idempotent; run for every organisation now and by
-- org:bootstrap and the dev seed):
--  * number series in the legacy formats (MST-010: REQ + 4 digits, SMPCL + 4, STN- + 6); the
--    legacy data migration moves next_value past the highest migrated number
--  * the initial feature flags (SRS §55.3), all off except the dark theme and Hindi UI
-- Settings are not seeded: their defaults live with their definitions in the API, and rows exist
-- only for values an administrator changed.
CREATE FUNCTION config.seed_configuration(org uuid) RETURNS void
LANGUAGE sql SET search_path = pg_catalog, public AS $$
  INSERT INTO config.number_series (organization_id, doc_type, prefix, padding, next_value, reset_policy)
  SELECT org, s.doc_type, s.prefix, s.padding, 1, 'NEVER'
  FROM (VALUES ('INDENT', 'REQ', 4), ('GRN', 'SMPCL', 4), ('STN', 'STN-', 6))
    AS s(doc_type, prefix, padding)
  WHERE NOT EXISTS (
    SELECT 1 FROM config.number_series n
    WHERE n.organization_id = org AND n.doc_type = s.doc_type
      AND n.location_id IS NULL AND n.fiscal_year IS NULL);

  INSERT INTO config.feature_flag (organization_id, key, enabled, description)
  SELECT org, f.key, f.enabled, f.description
  FROM (VALUES
    ('mfa',                         false, 'Multi-factor authentication'),
    ('otp_login',                   false, 'One-time-password login'),
    ('rfq',                         false, 'Requests for quotation'),
    ('inspection_step',             false, 'Quality inspection step in GRN'),
    ('po_approval_workflow',        false, 'Approval workflow for purchase orders'),
    ('invoice_matching',            false, 'Invoice three-way match'),
    ('mobile_offline_advance_sale', false, 'Offline advance sales on mobile'),
    ('sahayak_sms',                 false, 'SMS to Sahayak on advance sale'),
    ('dark_mode',                   true,  'Dark colour theme'),
    ('hindi_ui',                    true,  'Hindi user interface'),
    ('canary_api',                  false, 'Route a share of traffic to the canary API'),
    ('legacy_hash_login',           false, 'Accept legacy Django password hashes on first login')
  ) AS f(key, enabled, description)
  ON CONFLICT (organization_id, key) DO NOTHING
$$;--> statement-breakpoint
SELECT config.seed_configuration(id) FROM org.organization;
