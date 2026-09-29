-- Local development seed: the operating organisation and the initial feature flags.
-- Idempotent; safe to run repeatedly with `pnpm db:seed`. Not for production data.
BEGIN;

INSERT INTO org.organization (id, name, legal_name, base_currency, time_zone)
VALUES ('0192a000-0000-7000-8000-000000000001', 'Shwetdhara MPCL',
        'Shwetdhara Milk Producer Company Limited', 'INR', 'Asia/Kolkata')
ON CONFLICT (id) DO NOTHING;

-- The twelve system role templates with their default permissions (migration 0003).
SELECT identity.seed_role_templates('0192a000-0000-7000-8000-000000000001');

-- Units of measure, categories and external systems (migration 0005).
SELECT catalog.seed_reference('0192a000-0000-7000-8000-000000000001');
SELECT docs.seed_document_types('0192a000-0000-7000-8000-000000000001');

SELECT config.seed_configuration('0192a000-0000-7000-8000-000000000001');

COMMIT;
