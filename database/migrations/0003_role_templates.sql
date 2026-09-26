-- System role templates and their default permissions (SRS §10.1, Appendix C).
--
-- Roles are data: an organisation gets these twelve templates, which administrators can edit
-- (is_system roles cannot be deleted). Permission lists use LIKE patterns over the permission
-- catalogue, so "purchase_request:%" means every purchase_request action. The home workspace and
-- priority pick a user's start page when they hold several roles (lowest priority number wins,
-- matching the legacy get_redirect_url order).
CREATE FUNCTION identity.seed_role_templates(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('SUPER_ADMIN', 'Super administrator', 'ADMIN', 10,
       'Everything, including role templates, feature flags and integrations.',
       ARRAY['%']),
      ('ADMIN', 'Administrator', 'ADMIN', 20,
       'Users, roles, masters, workflows, templates and settings.',
       ARRAY['admin:user_manage', 'admin:role_manage', 'admin:workflow_manage', 'admin:master_manage',
             'admin:settings_manage', 'admin:number_series_manage', 'product:%', 'vendor:%', 'mpp:%',
             'notification:manage_templates', 'notification:read_delivery_logs',
             'notification:send_manual', 'document:manage_types', 'audit:read', 'report:read_admin']),
      ('HOD', 'Head of department', 'HOD', 30,
       'Approves, rejects and returns indents; approves transfers.',
       ARRAY['indent:read', 'approval:act', 'approval:delegate', 'inventory:read_all', 'transfer:read',
             'product:read', 'report:read_hod', 'report:export', 'document:read',
             'notification:read_own']),
      ('PURCHASE_HEAD', 'Purchase head', 'PURCHASE', 40,
       'Purchase user who also approves purchase orders.',
       ARRAY['purchase_request:%', 'purchase_order:%', 'sap_po:%', 'vendor:create', 'vendor:read',
             'vendor:update', 'vendor:map_products', 'product:read', 'indent:read_all', 'grn:read',
             'grn:approve_excess', 'approval:act', 'approval:delegate', 'rfq:award',
             'finance_document:read', 'document:upload', 'document:read', 'report:read_purchase',
             'report:export']),
      ('PURCHASE_USER', 'Purchase user', 'PURCHASE', 41,
       'Purchase requests, vendors, purchase orders and SAP PO import.',
       ARRAY['purchase_request:%', 'purchase_order:create', 'purchase_order:read',
             'purchase_order:update', 'purchase_order:send', 'purchase_order:cancel',
             'purchase_order:close', 'purchase_order:export', 'sap_po:%', 'vendor:create',
             'vendor:read', 'vendor:update', 'vendor:map_products', 'product:read', 'indent:read_all',
             'grn:read', 'finance_document:read', 'document:upload', 'document:read',
             'report:read_purchase', 'report:export']),
      ('FINANCE_ADMIN', 'Finance administrator', 'FINANCE', 50,
       'Finance user who also approves adjustments, reversals and exceptions.',
       ARRAY['cycle:%', 'reconciliation:%', 'invoice:%', 'payment:%', 'finance_document:read',
             'inventory:read_all', 'inventory:adjust_request', 'inventory:adjust_approve',
             'inventory:export', 'advance_sale:read_all', 'general_sale:read', 'grn:read', 'grn:reverse',
             'purchase_order:read', 'indent:read_all', 'transfer:resolve_discrepancy', 'audit:read',
             'report:read_finance', 'report:export', 'document:read']),
      ('FINANCE_USER', 'Finance user', 'FINANCE', 51,
       'Cycles, SAP imports, reconciliation and invoice verification.',
       ARRAY['cycle:read', 'cycle:manage', 'cycle:activate', 'reconciliation:import_sap_sales',
             'reconciliation:import_post_sheet', 'reconciliation:read', 'invoice:create',
             'invoice:read', 'invoice:verify', 'invoice:match', 'payment:read',
             'finance_document:read', 'inventory:read_all', 'inventory:adjust_request',
             'inventory:export', 'advance_sale:read_all', 'general_sale:read', 'grn:read',
             'purchase_order:read', 'indent:read_all', 'report:read_finance', 'report:export',
             'document:read']),
      ('LOGISTICS_USER', 'Logistics user', 'LOGISTICS', 60,
       'Transfer planning, STNs, dispatch and POD oversight.',
       ARRAY['transfer:%', 'inventory:read_all', 'indent:read_all', 'advance_sale:read_all',
             'report:read_logistics', 'report:export', 'document:upload', 'document:read']),
      ('MANAGEMENT', 'Management', 'MANAGEMENT', 65,
       'Read-only dashboards and reports; approves where a workflow step names this role.',
       ARRAY['report:read\_%', 'approval:act']),
      ('AUDITOR', 'Auditor', 'MANAGEMENT', 70,
       'Reads everything, including audit logs. Changes nothing.',
       ARRAY['%:read', '%:read\_%', 'audit:read']),
      ('CLUSTER_MIS', 'Cluster MIS', 'MANAGEMENT', 75,
       'Views and downloads the Sale & Stock Report for the locations of one cluster zone.',
       ARRAY['inventory:read', 'report:export']),
      ('STORE_USER', 'Store user', 'STORE', 80,
       'Indents, receipts, transfers, inventory, advance sales and POD for own locations.',
       ARRAY['indent:create', 'indent:read', 'indent:update', 'indent:submit', 'indent:cancel',
             'indent:delete_draft', 'indent:export', 'inventory:read', 'inventory:adjust_request',
             'inventory:count', 'inventory:export', 'grn:create', 'grn:read', 'grn:cancel',
             'transfer:read', 'transfer:dispatch', 'transfer:receive', 'advance_sale:create',
             'advance_sale:read', 'advance_sale:upload_pod', 'general_sale:read',
             'general_sale:dispatch', 'mpp:read', 'cycle:read', 'reconciliation:read_location',
             'reconciliation:acknowledge', 'product:read', 'vendor:read', 'purchase_order:read',
             'document:upload', 'document:read', 'notification:read_own', 'report:read_store',
             'report:export'])
    ) AS v(code, name, workspace, priority, description, grants)
  LOOP
    INSERT INTO identity.role
      (organization_id, code, name, description, is_system, home_workspace, home_priority)
    VALUES (p_org, t.code, t.name, t.description, true, t.workspace, t.priority)
    ON CONFLICT (organization_id, code) DO NOTHING;

    INSERT INTO identity.role_permission (role_id, permission_code)
    SELECT r.id, p.code
    FROM identity.role r
    CROSS JOIN identity.permission p
    WHERE r.organization_id = p_org AND r.code = t.code AND p.code LIKE ANY (t.grants)
    ON CONFLICT DO NOTHING;
  END LOOP;
END
$$;
--> statement-breakpoint
SELECT identity.seed_role_templates(id) FROM org.organization;
