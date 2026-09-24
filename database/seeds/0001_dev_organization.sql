-- Local development seed: the operating organisation and the initial feature flags.
-- Idempotent; safe to run repeatedly with `pnpm db:seed`. Not for production data.
BEGIN;

INSERT INTO org.organization (id, name, legal_name, base_currency, time_zone)
VALUES ('0192a000-0000-7000-8000-000000000001', 'Shwetdhara MPCL',
        'Shwetdhara Milk Producer Company Limited', 'INR', 'Asia/Kolkata')
ON CONFLICT (id) DO NOTHING;

INSERT INTO config.feature_flag (organization_id, key, enabled, description)
SELECT '0192a000-0000-7000-8000-000000000001', f.key, f.enabled, f.description
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
ON CONFLICT (organization_id, key) DO NOTHING;

COMMIT;
