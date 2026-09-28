-- Catalogue child tables get their own organisation column, so row-level security isolates them
-- like every other organisation table instead of relying on joins through the parent.
-- Added nullable, backfilled from the parent, then made NOT NULL (the tables may hold rows).
ALTER TABLE "catalog"."uom_conversion" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog"."vendor_contact" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog"."vendor_product" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "catalog"."uom_conversion" c SET organization_id = u.organization_id
  FROM "catalog"."uom" u WHERE u.id = c.from_uom_id;--> statement-breakpoint
UPDATE "catalog"."vendor_contact" c SET organization_id = v.organization_id
  FROM "catalog"."vendor" v WHERE v.id = c.vendor_id;--> statement-breakpoint
UPDATE "catalog"."vendor_product" c SET organization_id = v.organization_id
  FROM "catalog"."vendor" v WHERE v.id = c.vendor_id;--> statement-breakpoint
ALTER TABLE "catalog"."uom_conversion" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."vendor_contact" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."vendor_product" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."uom_conversion" ADD CONSTRAINT "uom_conversion_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."vendor_contact" ADD CONSTRAINT "vendor_contact_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."vendor_product" ADD CONSTRAINT "vendor_product_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."uom_conversion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "catalog"."vendor_contact" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "catalog"."vendor_product" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "p_org_isolation" ON "catalog"."uom_conversion" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)) WITH CHECK ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "p_org_isolation" ON "catalog"."vendor_contact" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)) WITH CHECK ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "p_org_isolation" ON "catalog"."vendor_product" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)) WITH CHECK ((organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid));
