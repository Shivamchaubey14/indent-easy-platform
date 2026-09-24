import {
  pgTable,
  pgSchema,
  uuid,
  text,
  char,
  timestamp,
  foreignKey,
  unique,
  pgPolicy,
  boolean,
  integer,
  check,
  index,
  date,
  inet,
  uniqueIndex,
  numeric,
  bigint,
  jsonb,
  type AnyPgColumn,
  varchar,
  smallint,
  doublePrecision,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { PgTableExtraConfigValue } from 'drizzle-orm/pg-core';
import { bytea, citext, tsvector } from './column-types.js';

export const org = pgSchema('org');
export const identity = pgSchema('identity');
export const config = pgSchema('config');
export const catalog = pgSchema('catalog');
export const indent = pgSchema('indent');
export const workflow = pgSchema('workflow');
export const procurement = pgSchema('procurement');
export const docs = pgSchema('docs');
export const receiving = pgSchema('receiving');
export const logistics = pgSchema('logistics');
export const inventory = pgSchema('inventory');
export const recon = pgSchema('recon');
export const mpp = pgSchema('mpp');
export const notify = pgSchema('notify');
export const finance = pgSchema('finance');
export const events = pgSchema('events');
export const io = pgSchema('io');
export const audit = pgSchema('audit');
export const reporting = pgSchema('reporting');

export const organizationInOrg = org.table('organization', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  legalName: text('legal_name'),
  gstin: text(),
  baseCurrency: char('base_currency', { length: 3 }).default('INR').notNull(),
  timeZone: text('time_zone').default('Asia/Kolkata').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const regionInOrg = org.table(
  'region',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'region_organization_id_fkey',
    }),
    unique('uq_region_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const roleInIdentity = identity.table(
  'role',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    description: text(),
    isSystem: boolean('is_system').default(false).notNull(),
    homeWorkspace: text('home_workspace'),
    homePriority: integer('home_priority').default(100).notNull(),
    status: text().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'role_organization_id_fkey',
    }),
    unique('uq_role_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const permissionInIdentity = identity.table(
  'permission',
  {
    code: text().primaryKey().notNull(),
    description: text().notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    check('ck_permission_code', sql`code ~ '^[a-z_]+:[a-z_]+$'::text`),
  ],
);

export const userRoleInIdentity = identity.table(
  'user_role',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
    scopeLocationIds: uuid('scope_location_ids').array().default(['']).notNull(),
    scopeDepartmentIds: uuid('scope_department_ids').array().default(['']).notNull(),
    scopeCategoryIds: uuid('scope_category_ids').array().default(['']).notNull(),
    validFrom: date('valid_from'),
    validTo: date('valid_to'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_user_role_scope_loc').using(
      'gin',
      table.scopeLocationIds.asc().nullsLast().op('array_ops'),
    ),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roleInIdentity.id],
      name: 'user_role_role_id_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'user_role_user_id_fkey',
    }).onDelete('cascade'),
    unique('uq_user_role').on(table.userId, table.roleId),
    check(
      'ck_user_role_validity',
      sql`(valid_to IS NULL) OR (valid_from IS NULL) OR (valid_to >= valid_from)`,
    ),
  ],
);

export const sessionInIdentity = identity.table(
  'session',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    deviceName: text('device_name'),
    platform: text(),
    clientVersion: text('client_version'),
    ip: inet(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    idleExpiresAt: timestamp('idle_expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    absoluteExpiresAt: timestamp('absolute_expires_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    revokeReason: text('revoke_reason'),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_session_user_active')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(revoked_at IS NULL)`),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'session_user_id_fkey',
    }),
  ],
);

export const refreshTokenInIdentity = identity.table(
  'refresh_token',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    sessionId: uuid('session_id').notNull(),
    familyId: uuid('family_id').notNull(),
    tokenHash: bytea('token_hash').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'string' }),
    replacedById: uuid('replaced_by_id'),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_refresh_family').using('btree', table.familyId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.replacedById],
      foreignColumns: [table.id],
      name: 'refresh_token_replaced_by_id_fkey',
    }),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [sessionInIdentity.id],
      name: 'refresh_token_session_id_fkey',
    }).onDelete('cascade'),
    unique('uq_refresh_token_hash').on(table.tokenHash),
  ],
);

export const mfaFactorInIdentity = identity.table(
  'mfa_factor',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    type: text().notNull(),
    secretEncrypted: bytea('secret_encrypted'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'mfa_factor_user_id_fkey',
    }),
    check(
      'ck_mfa_type',
      sql`type = ANY (ARRAY['TOTP'::text, 'SMS_OTP'::text, 'RECOVERY_CODES'::text])`,
    ),
  ],
);

export const passwordResetTokenInIdentity = identity.table(
  'password_reset_token',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    tokenHash: bytea('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'password_reset_token_user_id_fkey',
    }),
    unique('password_reset_token_token_hash_key').on(table.tokenHash),
  ],
);

export const apiClientInIdentity = identity.table(
  'api_client',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    name: text().notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: bytea('key_hash').notNull(),
    scopes: text().array().notNull(),
    status: text().default('ACTIVE').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'api_client_organization_id_fkey',
    }),
    unique('api_client_key_prefix_key').on(table.keyPrefix),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const employeeInOrg = org.table(
  'employee',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    employeeCode: text('employee_code').notNull(),
    name: text().notNull(),
    departmentId: uuid('department_id'),
    userId: uuid('user_id'),
    status: text().default('ACTIVE').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.departmentId],
      foreignColumns: [departmentInOrg.id],
      name: 'employee_department_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'employee_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'employee_user_id_fkey',
    }),
    unique('uq_employee_code').on(table.organizationId, table.employeeCode),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const uomConversionInCatalog = catalog.table(
  'uom_conversion',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    fromUomId: uuid('from_uom_id').notNull(),
    toUomId: uuid('to_uom_id').notNull(),
    productId: uuid('product_id'),
    factor: numeric({ precision: 18, scale: 6 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_uom_conversion').using(
      'btree',
      sql`from_uom_id`,
      sql`to_uom_id`,
      sql`COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    foreignKey({
      columns: [table.fromUomId],
      foreignColumns: [uomInCatalog.id],
      name: 'uom_conversion_from_uom_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'uom_conversion_product_id_fkey',
    }),
    foreignKey({
      columns: [table.toUomId],
      foreignColumns: [uomInCatalog.id],
      name: 'uom_conversion_to_uom_id_fkey',
    }),
    check('ck_uom_conv_distinct', sql`from_uom_id <> to_uom_id`),
    check('ck_uom_conv_factor', sql`factor > (0)::numeric`),
  ],
);

export const productInCatalog = catalog.table(
  'product',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    nameHi: text('name_hi'),
    sizeLabel: text('size_label'),
    baseUomId: uuid('base_uom_id').notNull(),
    categoryId: uuid('category_id'),
    materialType: text('material_type'),
    hsnCode: text('hsn_code'),
    standardPrice: numeric('standard_price', { precision: 18, scale: 2 }).default('0').notNull(),
    isStockItem: boolean('is_stock_item').default(true).notNull(),
    isService: boolean('is_service').default(false).notNull(),
    batchTracked: boolean('batch_tracked').default(false).notNull(),
    serialTracked: boolean('serial_tracked').default(false).notNull(),
    reorderLevel: numeric('reorder_level', { precision: 18, scale: 3 }),
    ownerUserId: uuid('owner_user_id'),
    status: text().default('ACTIVE').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    legacyProductId: bigint('legacy_product_id', { mode: 'number' }),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('simple'::regconfig, ((((((COALESCE(code, ''::text) || ' '::text) || COALESCE(name, ''::text)) || ' '::text) || COALESCE(size_label, ''::text)) || ' '::text) || COALESCE(material_type, ''::text)))`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    updatedBy: uuid('updated_by'),
    version: integer().default(1).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_product_name_trgm').using('gin', table.name.asc().nullsLast().op('gin_trgm_ops')),
    index('ix_product_owner').using('btree', table.ownerUserId.asc().nullsLast().op('uuid_ops')),
    index('ix_product_tsv').using('gin', table.searchTsv.asc().nullsLast().op('tsvector_ops')),
    uniqueIndex('uq_product_name_size').using(
      'btree',
      sql`organization_id`,
      sql`lower(name)`,
      sql`COALESCE(lower(size_label), ''::text)`,
    ),
    foreignKey({
      columns: [table.baseUomId],
      foreignColumns: [uomInCatalog.id],
      name: 'product_base_uom_id_fkey',
    }),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [productCategoryInCatalog.id],
      name: 'product_category_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'product_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.ownerUserId],
      foreignColumns: [appUserInIdentity.id],
      name: 'product_owner_user_id_fkey',
    }),
    unique('uq_product_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_product_price', sql`standard_price >= (0)::numeric`),
    check('ck_product_service_stock', sql`NOT (is_service AND is_stock_item)`),
    check('ck_product_status', sql`status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])`),
  ],
);

export const externalSystemInCatalog = catalog.table(
  'external_system',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    displayPriority: integer('display_priority').default(100).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'external_system_organization_id_fkey',
    }),
    unique('uq_external_system').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const vendorContactInCatalog = catalog.table(
  'vendor_contact',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    vendorId: uuid('vendor_id').notNull(),
    name: text(),
    email: citext('email'),
    phoneE164: text('phone_e164'),
    purposes: text().array().default(['PO']).notNull(),
    status: text().default('ACTIVE').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_vendor_contact_vendor').using(
      'btree',
      table.vendorId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.vendorId],
      foreignColumns: [vendorInCatalog.id],
      name: 'vendor_contact_vendor_id_fkey',
    }).onDelete('cascade'),
    check('ck_contact_channel', sql`(email IS NOT NULL) OR (phone_e164 IS NOT NULL)`),
  ],
);

export const productExternalCodeInCatalog = catalog.table(
  'product_external_code',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    productId: uuid('product_id').notNull(),
    externalSystemId: uuid('external_system_id').notNull(),
    externalCode: text('external_code'),
    externalName: text('external_name').notNull(),
    uomText: text('uom_text'),
    isPrimary: boolean('is_primary').default(true).notNull(),
    status: text().default('ACTIVE').notNull(),
    legacyGroupName: text('legacy_group_name'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_ext_name_trgm').using('gin', table.externalName.asc().nullsLast().op('gin_trgm_ops')),
    uniqueIndex('uq_ext_code')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('uuid_ops'),
        table.externalSystemId.asc().nullsLast().op('uuid_ops'),
        table.externalCode.asc().nullsLast().op('text_ops'),
      )
      .where(sql`((external_code IS NOT NULL) AND (status = 'ACTIVE'::text))`),
    uniqueIndex('uq_ext_primary')
      .using(
        'btree',
        table.productId.asc().nullsLast().op('uuid_ops'),
        table.externalSystemId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`(is_primary AND (status = 'ACTIVE'::text))`),
    foreignKey({
      columns: [table.externalSystemId],
      foreignColumns: [externalSystemInCatalog.id],
      name: 'product_external_code_external_system_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'product_external_code_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'product_external_code_product_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const vendorInCatalog = catalog.table(
  'vendor',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    legalName: text('legal_name'),
    gstin: text(),
    pan: text(),
    sapVendorCode: text('sap_vendor_code'),
    paymentTermsDays: integer('payment_terms_days'),
    address: jsonb(),
    status: text().default('ACTIVE').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    legacyVendorIds: bigint('legacy_vendor_ids', { mode: 'number' }).array().default([]).notNull(),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('simple'::regconfig, ((((COALESCE(code, ''::text) || ' '::text) || COALESCE(name, ''::text)) || ' '::text) || COALESCE(gstin, ''::text)))`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    updatedBy: uuid('updated_by'),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_vendor_tsv').using('gin', table.searchTsv.asc().nullsLast().op('tsvector_ops')),
    uniqueIndex('uq_vendor_gstin')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('uuid_ops'),
        table.gstin.asc().nullsLast().op('text_ops'),
      )
      .where(sql`(gstin IS NOT NULL)`),
    uniqueIndex('uq_vendor_name').using('btree', sql`organization_id`, sql`lower(name)`),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'vendor_organization_id_fkey',
    }),
    unique('uq_vendor_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_vendor_gstin', sql`(gstin IS NULL) OR (gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'::text)`),
    check(
      'ck_vendor_status',
      sql`status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'BLOCKED'::text])`,
    ),
  ],
);

export const mppInCatalog = catalog.table(
  'mpp',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    bmcLocationId: uuid('bmc_location_id').notNull(),
    sahayakName: text('sahayak_name'),
    sahayakMobileE164: text('sahayak_mobile_e164'),
    cycleBand: text('cycle_band'),
    village: text(),
    status: text().default('ACTIVE').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    legacyMppId: bigint('legacy_mpp_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_mpp_bmc').using('btree', table.bmcLocationId.asc().nullsLast().op('uuid_ops')),
    index('ix_mpp_name_trgm').using('gin', table.name.asc().nullsLast().op('gin_trgm_ops')),
    foreignKey({
      columns: [table.bmcLocationId],
      foreignColumns: [locationInOrg.id],
      name: 'mpp_bmc_location_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'mpp_organization_id_fkey',
    }),
    unique('uq_mpp_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_mpp_band',
      sql`(cycle_band IS NULL) OR (cycle_band = ANY (ARRAY['DAYS_1_10'::text, 'DAYS_11_20'::text, 'DAYS_21_31'::text]))`,
    ),
    check(
      'ck_mpp_mobile',
      sql`(sahayak_mobile_e164 IS NULL) OR (sahayak_mobile_e164 ~ '^\\+[1-9][0-9]{7,14}$'::text)`,
    ),
    check('ck_mpp_status', sql`status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])`),
  ],
);

export const workflowVersionInWorkflow = workflow.table(
  'workflow_version',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    definitionId: uuid('definition_id').notNull(),
    versionNo: integer('version_no').notNull(),
    definition: jsonb().notNull(),
    status: text().default('DRAFT').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    publishedBy: uuid('published_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_wf_single_published')
      .using('btree', table.definitionId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(status = 'PUBLISHED'::text)`),
    foreignKey({
      columns: [table.definitionId],
      foreignColumns: [workflowDefinitionInWorkflow.id],
      name: 'workflow_version_definition_id_fkey',
    }),
    foreignKey({
      columns: [table.publishedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'workflow_version_published_by_fkey',
    }),
    unique('uq_wf_version').on(table.definitionId, table.versionNo),
    check(
      'ck_wf_version_status',
      sql`status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'RETIRED'::text])`,
    ),
  ],
);

export const approvalGroupInWorkflow = workflow.table(
  'approval_group',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    instanceId: uuid('instance_id').notNull(),
    routingKey: text('routing_key').notNull(),
    lineIds: uuid('line_ids').array().default(['']).notNull(),
    currentStep: text('current_step'),
    outcome: text(),
    decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_approval_group_instance').using(
      'btree',
      table.instanceId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.instanceId],
      foreignColumns: [workflowInstanceInWorkflow.id],
      name: 'approval_group_instance_id_fkey',
    }),
    check(
      'ck_group_outcome',
      sql`(outcome IS NULL) OR (outcome = ANY (ARRAY['APPROVED'::text, 'APPROVED_FOR_TRANSFER'::text, 'REJECTED'::text, 'RETURNED'::text, 'CANCELLED'::text, 'MIXED'::text]))`,
    ),
  ],
);

export const approvalActionInWorkflow = workflow.table(
  'approval_action',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    taskId: uuid('task_id').notNull(),
    action: text().notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOfId: uuid('on_behalf_of_id'),
    remark: text(),
    payload: jsonb(),
    ip: inet(),
    userAgent: text('user_agent'),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_action_task').using('btree', table.taskId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [appUserInIdentity.id],
      name: 'approval_action_actor_id_fkey',
    }),
    foreignKey({
      columns: [table.onBehalfOfId],
      foreignColumns: [appUserInIdentity.id],
      name: 'approval_action_on_behalf_of_id_fkey',
    }),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [approvalTaskInWorkflow.id],
      name: 'approval_action_task_id_fkey',
    }),
    check(
      'ck_action_type',
      sql`action = ANY (ARRAY['APPROVE'::text, 'APPROVE_FOR_TRANSFER'::text, 'REJECT'::text, 'RETURN'::text, 'DELEGATE'::text, 'REASSIGN'::text, 'ESCALATE'::text, 'REMIND'::text, 'COMMENT'::text])`,
    ),
  ],
);

export const indentLineInIndent = indent.table(
  'indent_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    indentId: uuid('indent_id').notNull(),
    lineNo: integer('line_no').notNull(),
    productId: uuid('product_id').notNull(),
    productSnapshot: jsonb('product_snapshot').notNull(),
    qtyRequested: numeric('qty_requested', { precision: 18, scale: 3 }).notNull(),
    uomId: uuid('uom_id').notNull(),
    qtyBase: numeric('qty_base', { precision: 18, scale: 3 }).notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    estUnitPrice: numeric('est_unit_price', { precision: 18, scale: 4 }),
    estAmount: numeric('est_amount', { precision: 18, scale: 2 }),
    remark: text(),
    remarkInternal: boolean('remark_internal').default(false).notNull(),
    status: text().default('DRAFT').notNull(),
    qtyApproved: numeric('qty_approved', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyRejected: numeric('qty_rejected', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyOrdered: numeric('qty_ordered', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyTransferred: numeric('qty_transferred', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyReceived: numeric('qty_received', { precision: 18, scale: 3 }).default('0').notNull(),
    approvalGroupKey: text('approval_group_key'),
    clientLineId: uuid('client_line_id'),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    legacyRequisitionId: bigint('legacy_requisition_id', { mode: 'number' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_indent_line_procurement')
      .using('btree', table.status.asc().nullsLast().op('text_ops'))
      .where(sql`(status = 'APPROVED'::text)`),
    index('ix_indent_line_product_status').using(
      'btree',
      table.productId.asc().nullsLast().op('text_ops'),
      table.status.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.indentId],
      foreignColumns: [indentInIndent.id],
      name: 'indent_line_indent_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'indent_line_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'indent_line_product_id_fkey',
    }),
    foreignKey({
      columns: [table.uomId],
      foreignColumns: [uomInCatalog.id],
      name: 'indent_line_uom_id_fkey',
    }),
    unique('uq_indent_line_no').on(table.indentId, table.lineNo),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_indent_line_approved',
      sql`(qty_approved >= (0)::numeric) AND ((qty_approved + qty_rejected) <= qty_base)`,
    ),
    check('ck_indent_line_fulfil', sql`(qty_ordered + qty_transferred) <= qty_approved`),
    check('ck_indent_line_qty', sql`(qty_requested > (0)::numeric) AND (qty_base > (0)::numeric)`),
    check(
      'ck_indent_line_status',
      sql`status = ANY (ARRAY['DRAFT'::text, 'PENDING_APPROVAL'::text, 'RETURNED'::text, 'APPROVED'::text, 'APPROVED_FOR_TRANSFER'::text, 'REJECTED'::text, 'PO_CREATED'::text, 'STN_ISSUED'::text, 'PARTIALLY_RECEIVED'::text, 'RECEIVED'::text, 'CLOSED_SHORT'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const workflowDefinitionInWorkflow = workflow.table(
  'workflow_definition',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    subjectType: text('subject_type').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'workflow_definition_organization_id_fkey',
    }),
    unique('uq_wf_def').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_wf_subject',
      sql`subject_type = ANY (ARRAY['INDENT'::text, 'PURCHASE_ORDER'::text, 'GRN_EXCESS'::text, 'GRN_REVERSAL'::text, 'STOCK_ADJUSTMENT'::text, 'TRANSFER_REQUEST'::text, 'ADVANCE_SALE_CANCELLATION'::text, 'INVOICE_EXCEPTION'::text, 'TRANSIT_WRITE_OFF'::text])`,
    ),
  ],
);

export const purchaseRequestLineInProcurement = procurement.table(
  'purchase_request_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    prId: uuid('pr_id').notNull(),
    indentLineId: uuid('indent_line_id').notNull(),
    productId: uuid('product_id').notNull(),
    qtyBase: numeric('qty_base', { precision: 18, scale: 3 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.indentLineId],
      foreignColumns: [indentLineInIndent.id],
      name: 'purchase_request_line_indent_line_id_fkey',
    }),
    foreignKey({
      columns: [table.prId],
      foreignColumns: [purchaseRequestInProcurement.id],
      name: 'purchase_request_line_pr_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'purchase_request_line_product_id_fkey',
    }),
    check('ck_pr_line_qty', sql`qty_base > (0)::numeric`),
  ],
);

export const quotationInProcurement = procurement.table(
  'quotation',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    rfqId: uuid('rfq_id').notNull(),
    vendorId: uuid('vendor_id').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    validUntil: date('valid_until'),
    terms: text(),
    documentId: uuid('document_id'),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [documentInDocs.id],
      name: 'fk_quotation_document',
    }),
    foreignKey({
      columns: [table.rfqId],
      foreignColumns: [rfqInProcurement.id],
      name: 'quotation_rfq_id_fkey',
    }),
    foreignKey({
      columns: [table.vendorId],
      foreignColumns: [vendorInCatalog.id],
      name: 'quotation_vendor_id_fkey',
    }),
    unique('uq_quotation').on(table.rfqId, table.vendorId),
  ],
);

export const quotationLineInProcurement = procurement.table(
  'quotation_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    quotationId: uuid('quotation_id').notNull(),
    productId: uuid('product_id').notNull(),
    qtyBase: numeric('qty_base', { precision: 18, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
    taxPct: numeric('tax_pct', { precision: 5, scale: 2 }).default('0').notNull(),
    deliveryDays: integer('delivery_days'),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'quotation_line_product_id_fkey',
    }),
    foreignKey({
      columns: [table.quotationId],
      foreignColumns: [quotationInProcurement.id],
      name: 'quotation_line_quotation_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const purchaseOrderLineInProcurement = procurement.table(
  'purchase_order_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    poId: uuid('po_id').notNull(),
    lineNo: integer('line_no').notNull(),
    productId: uuid('product_id').notNull(),
    productSnapshot: jsonb('product_snapshot').notNull(),
    qtyOrdered: numeric('qty_ordered', { precision: 18, scale: 3 }).notNull(),
    uomId: uuid('uom_id').notNull(),
    qtyBase: numeric('qty_base', { precision: 18, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
    taxPct: numeric('tax_pct', { precision: 5, scale: 2 }).default('0').notNull(),
    amount: numeric({ precision: 18, scale: 2 }).notNull(),
    deliveryDate: date('delivery_date'),
    deliveryPointCode: text('delivery_point_code'),
    sapPoLineId: uuid('sap_po_line_id'),
    qtyReceived: numeric('qty_received', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyAccepted: numeric('qty_accepted', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyRejected: numeric('qty_rejected', { precision: 18, scale: 3 }).default('0').notNull(),
    status: text().default('OPEN').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_po_line_product').using('btree', table.productId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.poId],
      foreignColumns: [purchaseOrderInProcurement.id],
      name: 'purchase_order_line_po_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'purchase_order_line_product_id_fkey',
    }),
    foreignKey({
      columns: [table.sapPoLineId],
      foreignColumns: [sapPoLineInProcurement.id],
      name: 'purchase_order_line_sap_po_line_id_fkey',
    }),
    foreignKey({
      columns: [table.uomId],
      foreignColumns: [uomInCatalog.id],
      name: 'purchase_order_line_uom_id_fkey',
    }),
    unique('uq_po_line_no').on(table.poId, table.lineNo),
    check('ck_po_line_ceiling', sql`qty_received <= (qty_base * 1.5)`),
    check(
      'ck_po_line_price',
      sql`(unit_price >= (0)::numeric) AND (tax_pct >= (0)::numeric) AND (tax_pct <= (100)::numeric)`,
    ),
    check('ck_po_line_qty', sql`(qty_ordered > (0)::numeric) AND (qty_base > (0)::numeric)`),
    check(
      'ck_po_line_receipts',
      sql`(qty_received >= (0)::numeric) AND ((qty_accepted + qty_rejected) = qty_received)`,
    ),
    check(
      'ck_po_line_status',
      sql`status = ANY (ARRAY['OPEN'::text, 'PARTIALLY_RECEIVED'::text, 'RECEIVED'::text, 'SHORT_CLOSED'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const purchaseRequestInProcurement = procurement.table(
  'purchase_request',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    prNumber: text('pr_number').notNull(),
    status: text().default('OPEN').notNull(),
    notes: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'purchase_request_created_by_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'purchase_request_organization_id_fkey',
    }),
    unique('uq_pr_number').on(table.organizationId, table.prNumber),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_pr_status',
      sql`status = ANY (ARRAY['OPEN'::text, 'RFQ'::text, 'ORDERED'::text, 'CLOSED'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const rfqInProcurement = procurement.table(
  'rfq',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    rfqNumber: text('rfq_number').notNull(),
    prId: uuid('pr_id'),
    status: text().default('DRAFT').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'string' }),
    awardedVendorId: uuid('awarded_vendor_id'),
    awardJustification: text('award_justification'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.awardedVendorId],
      foreignColumns: [vendorInCatalog.id],
      name: 'rfq_awarded_vendor_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'rfq_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.prId],
      foreignColumns: [purchaseRequestInProcurement.id],
      name: 'rfq_pr_id_fkey',
    }),
    unique('uq_rfq_number').on(table.organizationId, table.rfqNumber),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const documentVersionInDocs = docs.table(
  'document_version',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    documentId: uuid('document_id').notNull(),
    versionNo: integer('version_no').notNull(),
    storageKey: text('storage_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sha256: char({ length: 64 }).notNull(),
    scanStatus: text('scan_status').default('PENDING').notNull(),
    scannedAt: timestamp('scanned_at', { withTimezone: true, mode: 'string' }),
    uploadedBy: uuid('uploaded_by'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [documentInDocs.id],
      name: 'document_version_document_id_fkey',
    }),
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'document_version_uploaded_by_fkey',
    }),
    unique('uq_document_version').on(table.documentId, table.versionNo),
    unique('uq_document_storage_key').on(table.storageKey),
    check(
      'ck_scan_status',
      sql`scan_status = ANY (ARRAY['PENDING'::text, 'CLEAN'::text, 'INFECTED'::text, 'ERROR'::text, 'SKIPPED'::text])`,
    ),
  ],
);

export const grnLineInReceiving = receiving.table(
  'grn_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    grnId: uuid('grn_id').notNull(),
    poLineId: uuid('po_line_id'),
    productId: uuid('product_id').notNull(),
    qtyReceived: numeric('qty_received', { precision: 18, scale: 3 }).notNull(),
    qtyAccepted: numeric('qty_accepted', { precision: 18, scale: 3 }).notNull(),
    qtyRejected: numeric('qty_rejected', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyDamaged: numeric('qty_damaged', { precision: 18, scale: 3 }).default('0').notNull(),
    rejectReasonCode: text('reject_reason_code'),
    batchNo: text('batch_no'),
    mfgDate: date('mfg_date'),
    expiryDate: date('expiry_date'),
    remarks: text(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_grn_line_grn').using('btree', table.grnId.asc().nullsLast().op('uuid_ops')),
    index('ix_grn_line_po_line').using('btree', table.poLineId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.grnId],
      foreignColumns: [grnInReceiving.id],
      name: 'grn_line_grn_id_fkey',
    }),
    foreignKey({
      columns: [table.poLineId],
      foreignColumns: [purchaseOrderLineInProcurement.id],
      name: 'grn_line_po_line_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'grn_line_product_id_fkey',
    }),
    check('ck_grn_line_balance', sql`qty_received = (qty_accepted + qty_rejected)`),
    check('ck_grn_line_damaged', sql`qty_damaged <= qty_rejected`),
    check(
      'ck_grn_line_expiry',
      sql`(expiry_date IS NULL) OR (mfg_date IS NULL) OR (expiry_date >= mfg_date)`,
    ),
    check(
      'ck_grn_line_nonneg',
      sql`(qty_received >= (0)::numeric) AND (qty_accepted >= (0)::numeric) AND (qty_rejected >= (0)::numeric) AND (qty_damaged >= (0)::numeric)`,
    ),
  ],
);

export const documentTypeInDocs = docs.table(
  'document_type',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    allowedMime: text('allowed_mime').array().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    maxBytes: bigint('max_bytes', { mode: 'number' }).notNull(),
    retentionDays: integer('retention_days'),
    requiresScan: boolean('requires_scan').default(true).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'document_type_organization_id_fkey',
    }),
    unique('uq_document_type').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_doc_type_max', sql`max_bytes > 0`),
  ],
);

export const documentInDocs = docs.table(
  'document',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    typeId: uuid('type_id').notNull(),
    title: text().notNull(),
    currentVersionNo: integer('current_version_no').default(1).notNull(),
    status: text().default('PENDING_UPLOAD').notNull(),
    ownerId: uuid('owner_id'),
    sensitivity: text().default('INTERNAL').notNull(),
    legalHold: boolean('legal_hold').default(false).notNull(),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('simple'::regconfig, COALESCE(title, ''::text))`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_document_tsv').using('gin', table.searchTsv.asc().nullsLast().op('tsvector_ops')),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'document_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [appUserInIdentity.id],
      name: 'document_owner_id_fkey',
    }),
    foreignKey({
      columns: [table.typeId],
      foreignColumns: [documentTypeInDocs.id],
      name: 'document_type_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_document_sensitivity',
      sql`sensitivity = ANY (ARRAY['PUBLIC'::text, 'INTERNAL'::text, 'CONFIDENTIAL'::text, 'RESTRICTED'::text])`,
    ),
    check(
      'ck_document_status',
      sql`status = ANY (ARRAY['PENDING_UPLOAD'::text, 'PENDING_SCAN'::text, 'AVAILABLE'::text, 'QUARANTINED'::text, 'SUPERSEDED'::text, 'DELETED'::text])`,
    ),
  ],
);

export const grnInReceiving = receiving.table(
  'grn',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    grnNumber: text('grn_number'),
    grnType: text('grn_type').default('PO').notNull(),
    poId: uuid('po_id'),
    vendorId: uuid('vendor_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    challanNumber: text('challan_number').notNull(),
    challanDate: date('challan_date').notNull(),
    invoiceNumber: text('invoice_number'),
    invoiceDate: date('invoice_date'),
    vehicleNumber: text('vehicle_number'),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    status: text().default('DRAFT').notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true, mode: 'string' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'string' }),
    reversalOfId: uuid('reversal_of_id'),
    pdfDocumentId: uuid('pdf_document_id'),
    channel: text().default('WEB').notNull(),
    legacyGrnNumber: text('legacy_grn_number'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    updatedBy: uuid('updated_by'),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_grn_po').using('btree', table.poId.asc().nullsLast().op('uuid_ops')),
    index('ix_grn_warehouse_date').using(
      'btree',
      table.warehouseId.asc().nullsLast().op('uuid_ops'),
      table.receivedAt.desc().nullsFirst().op('uuid_ops'),
    ),
    uniqueIndex('uq_grn_challan_posted')
      .using(
        'btree',
        sql`organization_id`,
        sql`vendor_id`,
        sql`lower(challan_number)`,
        sql`challan_date`,
      )
      .where(
        sql`((status = ANY (ARRAY['POSTED'::text, 'VERIFIED'::text])) AND (reversal_of_id IS NULL))`,
      ),
    uniqueIndex('uq_grn_number')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('text_ops'),
        table.grnNumber.asc().nullsLast().op('text_ops'),
      )
      .where(sql`(grn_number IS NOT NULL)`),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'grn_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.pdfDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'grn_pdf_document_id_fkey',
    }),
    foreignKey({
      columns: [table.poId],
      foreignColumns: [purchaseOrderInProcurement.id],
      name: 'grn_po_id_fkey',
    }),
    foreignKey({
      columns: [table.reversalOfId],
      foreignColumns: [table.id],
      name: 'grn_reversal_of_id_fkey',
    }),
    foreignKey({
      columns: [table.vendorId],
      foreignColumns: [vendorInCatalog.id],
      name: 'grn_vendor_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouseInOrg.id],
      name: 'grn_warehouse_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_grn_number_posted',
      sql`(status <> ALL (ARRAY['POSTED'::text, 'VERIFIED'::text, 'REVERSED'::text])) OR (grn_number IS NOT NULL)`,
    ),
    check('ck_grn_po', sql`(grn_type = 'NO_PO'::text) OR (po_id IS NOT NULL)`),
    check(
      'ck_grn_status',
      sql`status = ANY (ARRAY['DRAFT'::text, 'PENDING_EXCESS_APPROVAL'::text, 'PENDING_INSPECTION'::text, 'POSTED'::text, 'VERIFIED'::text, 'REVERSED'::text, 'CANCELLED'::text])`,
    ),
    check('ck_grn_type', sql`grn_type = ANY (ARRAY['PO'::text, 'NO_PO'::text])`),
  ],
);

export const inspectionInReceiving = receiving.table(
  'inspection',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    grnId: uuid('grn_id').notNull(),
    inspectorId: uuid('inspector_id').notNull(),
    result: text().notNull(),
    remarks: text(),
    inspectedAt: timestamp('inspected_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.grnId],
      foreignColumns: [grnInReceiving.id],
      name: 'inspection_grn_id_fkey',
    }),
    foreignKey({
      columns: [table.inspectorId],
      foreignColumns: [appUserInIdentity.id],
      name: 'inspection_inspector_id_fkey',
    }),
    check(
      'ck_inspection_result',
      sql`result = ANY (ARRAY['PASSED'::text, 'PARTIALLY_PASSED'::text, 'FAILED'::text])`,
    ),
  ],
);

export const transferOrderLineInLogistics = logistics.table(
  'transfer_order_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    transferId: uuid('transfer_id').notNull(),
    indentLineId: uuid('indent_line_id'),
    productId: uuid('product_id').notNull(),
    qtyBase: numeric('qty_base', { precision: 18, scale: 3 }).notNull(),
    qtyOnStn: numeric('qty_on_stn', { precision: 18, scale: 3 }).default('0').notNull(),
    status: text().default('OPEN').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_to_line_transfer').using('btree', table.transferId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.indentLineId],
      foreignColumns: [indentLineInIndent.id],
      name: 'transfer_order_line_indent_line_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'transfer_order_line_product_id_fkey',
    }),
    foreignKey({
      columns: [table.transferId],
      foreignColumns: [transferOrderInLogistics.id],
      name: 'transfer_order_line_transfer_id_fkey',
    }),
    check(
      'ck_to_line_qty',
      sql`(qty_base > (0)::numeric) AND (qty_on_stn >= (0)::numeric) AND (qty_on_stn <= qty_base)`,
    ),
  ],
);

export const stnReceiptLineInLogistics = logistics.table(
  'stn_receipt_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    receiptId: uuid('receipt_id').notNull(),
    stnLineId: uuid('stn_line_id').notNull(),
    qtyReceived: numeric('qty_received', { precision: 18, scale: 3 }).notNull(),
    qtyAccepted: numeric('qty_accepted', { precision: 18, scale: 3 }).notNull(),
    qtyRejected: numeric('qty_rejected', { precision: 18, scale: 3 }).default('0').notNull(),
    reason: text(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.receiptId],
      foreignColumns: [stnReceiptInLogistics.id],
      name: 'stn_receipt_line_receipt_id_fkey',
    }),
    foreignKey({
      columns: [table.stnLineId],
      foreignColumns: [stnLineInLogistics.id],
      name: 'stn_receipt_line_stn_line_id_fkey',
    }),
    check(
      'ck_stn_rl_balance',
      sql`(qty_received >= (0)::numeric) AND (qty_accepted >= (0)::numeric) AND (qty_rejected >= (0)::numeric) AND (qty_received = (qty_accepted + qty_rejected))`,
    ),
  ],
);

export const stnLineInLogistics = logistics.table(
  'stn_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    stnId: uuid('stn_id').notNull(),
    toLineId: uuid('to_line_id'),
    productId: uuid('product_id').notNull(),
    batchId: uuid('batch_id'),
    qtyPlanned: numeric('qty_planned', { precision: 18, scale: 3 }).notNull(),
    qtyDispatched: numeric('qty_dispatched', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyReceived: numeric('qty_received', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyRejected: numeric('qty_rejected', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyResolved: numeric('qty_resolved', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyInTransit: numeric('qty_in_transit', { precision: 18, scale: 3 }).generatedAlwaysAs(
      sql`((qty_dispatched - qty_received) - qty_resolved)`,
    ),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_stn_line_stn').using('btree', table.stnId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'stn_line_product_id_fkey',
    }),
    foreignKey({
      columns: [table.stnId],
      foreignColumns: [stnInLogistics.id],
      name: 'stn_line_stn_id_fkey',
    }),
    foreignKey({
      columns: [table.toLineId],
      foreignColumns: [transferOrderLineInLogistics.id],
      name: 'stn_line_to_line_id_fkey',
    }),
    check(
      'ck_stn_line_dispatch',
      sql`(qty_dispatched >= (0)::numeric) AND (qty_dispatched <= qty_planned)`,
    ),
    check('ck_stn_line_planned', sql`qty_planned > (0)::numeric`),
    check(
      'ck_stn_line_receipt',
      sql`(qty_received >= (0)::numeric) AND (qty_rejected >= (0)::numeric) AND (qty_resolved >= (0)::numeric) AND ((qty_received + qty_resolved) <= qty_dispatched)`,
    ),
  ],
);

export const transferOrderInLogistics = logistics.table(
  'transfer_order',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    transferNumber: text('transfer_number').notNull(),
    sourceLocationId: uuid('source_location_id').notNull(),
    destLocationId: uuid('dest_location_id').notNull(),
    status: text().default('PENDING_PLANNING').notNull(),
    origin: text().notNull(),
    reason: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_transfer_route_status').using(
      'btree',
      table.sourceLocationId.asc().nullsLast().op('text_ops'),
      table.destLocationId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.destLocationId],
      foreignColumns: [locationInOrg.id],
      name: 'transfer_order_dest_location_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'transfer_order_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.sourceLocationId],
      foreignColumns: [locationInOrg.id],
      name: 'transfer_order_source_location_id_fkey',
    }),
    unique('uq_transfer_number').on(table.organizationId, table.transferNumber),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_transfer_distinct', sql`source_location_id <> dest_location_id`),
    check('ck_transfer_origin', sql`origin = ANY (ARRAY['HOD_APPROVAL'::text, 'MANUAL'::text])`),
    check(
      'ck_transfer_status',
      sql`status = ANY (ARRAY['PENDING_APPROVAL'::text, 'PENDING_PLANNING'::text, 'STN_ISSUED'::text, 'PARTIALLY_DISPATCHED'::text, 'DISPATCHED'::text, 'PARTIALLY_RECEIVED'::text, 'RECEIVED'::text, 'DISCREPANCY_OPEN'::text, 'CLOSED'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const stnInLogistics = logistics.table(
  'stn',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    stnNumber: text('stn_number').notNull(),
    transferId: uuid('transfer_id'),
    sourceWarehouseId: uuid('source_warehouse_id').notNull(),
    destWarehouseId: uuid('dest_warehouse_id').notNull(),
    transporterName: text('transporter_name'),
    vehicleNumber: text('vehicle_number'),
    driverName: text('driver_name'),
    driverPhoneE164: text('driver_phone_e164'),
    ewayBillNumber: text('eway_bill_number'),
    expectedArrival: timestamp('expected_arrival', { withTimezone: true, mode: 'string' }),
    status: text().default('DRAFT').notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true, mode: 'string' }),
    postedBy: uuid('posted_by'),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true, mode: 'string' }),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' }),
    pdfDocumentId: uuid('pdf_document_id'),
    legacyStnNumber: text('legacy_stn_number'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_stn_dest_open')
      .using('btree', table.destWarehouseId.asc().nullsLast().op('uuid_ops'))
      .where(
        sql`(status = ANY (ARRAY['DISPATCHED'::text, 'IN_TRANSIT'::text, 'PARTIALLY_RECEIVED'::text]))`,
      ),
    index('ix_stn_source_open')
      .using('btree', table.sourceWarehouseId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(status = ANY (ARRAY['STN_ISSUED'::text, 'PARTIALLY_DISPATCHED'::text]))`),
    foreignKey({
      columns: [table.destWarehouseId],
      foreignColumns: [warehouseInOrg.id],
      name: 'stn_dest_warehouse_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'stn_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.pdfDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'stn_pdf_document_id_fkey',
    }),
    foreignKey({
      columns: [table.sourceWarehouseId],
      foreignColumns: [warehouseInOrg.id],
      name: 'stn_source_warehouse_id_fkey',
    }),
    foreignKey({
      columns: [table.transferId],
      foreignColumns: [transferOrderInLogistics.id],
      name: 'stn_transfer_id_fkey',
    }),
    unique('uq_stn_number').on(table.organizationId, table.stnNumber),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_stn_distinct', sql`source_warehouse_id <> dest_warehouse_id`),
    check(
      'ck_stn_status',
      sql`status = ANY (ARRAY['DRAFT'::text, 'STN_ISSUED'::text, 'PARTIALLY_DISPATCHED'::text, 'DISPATCHED'::text, 'IN_TRANSIT'::text, 'PARTIALLY_RECEIVED'::text, 'RECEIVED'::text, 'DISCREPANCY_OPEN'::text, 'CLOSED'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const stockAdjustmentLineInInventory = inventory.table(
  'stock_adjustment_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    adjustmentId: uuid('adjustment_id').notNull(),
    productId: uuid('product_id').notNull(),
    batchKey: uuid('batch_key')
      .default(sql`'00000000-0000-0000-0000-000000000000'`)
      .notNull(),
    bookQty: numeric('book_qty', { precision: 18, scale: 3 }).notNull(),
    qtyDelta: numeric('qty_delta', { precision: 18, scale: 3 }).notNull(),
    countedQty: numeric('counted_qty', { precision: 18, scale: 3 }),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.adjustmentId],
      foreignColumns: [stockAdjustmentInInventory.id],
      name: 'stock_adjustment_line_adjustment_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'stock_adjustment_line_product_id_fkey',
    }),
    check('ck_adj_line_delta', sql`qty_delta <> (0)::numeric`),
  ],
);

export const stockAdjustmentInInventory = inventory.table(
  'stock_adjustment',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    adjNumber: text('adj_number').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    reasonCode: text('reason_code').notNull(),
    remarks: text().notNull(),
    status: text().default('PENDING_APPROVAL').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    approvedBy: uuid('approved_by'),
    workflowInstanceId: uuid('workflow_instance_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true, mode: 'string' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.approvedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'stock_adjustment_approved_by_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'stock_adjustment_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.requestedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'stock_adjustment_requested_by_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouseInOrg.id],
      name: 'stock_adjustment_warehouse_id_fkey',
    }),
    foreignKey({
      columns: [table.workflowInstanceId],
      foreignColumns: [workflowInstanceInWorkflow.id],
      name: 'stock_adjustment_workflow_instance_id_fkey',
    }),
    unique('uq_adj_number').on(table.organizationId, table.adjNumber),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_adj_sod', sql`(approved_by IS NULL) OR (approved_by <> requested_by)`),
    check(
      'ck_adj_status',
      sql`status = ANY (ARRAY['PENDING_APPROVAL'::text, 'APPROVED'::text, 'POSTED'::text, 'REJECTED'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const advanceSaleLineInMpp = mpp.table(
  'advance_sale_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    saleId: uuid('sale_id').notNull(),
    lineNo: integer('line_no').notNull(),
    productId: uuid('product_id').notNull(),
    productSnapshot: jsonb('product_snapshot').notNull(),
    qty: numeric({ precision: 18, scale: 3 }).notNull(),
    uomId: uuid('uom_id').notNull(),
    qtyBase: numeric('qty_base', { precision: 18, scale: 3 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'advance_sale_line_product_id_fkey',
    }),
    foreignKey({
      columns: [table.saleId],
      foreignColumns: [advanceSaleInMpp.id],
      name: 'advance_sale_line_sale_id_fkey',
    }),
    foreignKey({
      columns: [table.uomId],
      foreignColumns: [uomInCatalog.id],
      name: 'advance_sale_line_uom_id_fkey',
    }),
    unique('uq_sale_line').on(table.saleId, table.lineNo),
    check('ck_sale_line_qty', sql`(qty > (0)::numeric) AND (qty_base > (0)::numeric)`),
  ],
);

export const generalSaleLineInMpp = mpp.table(
  'general_sale_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    generalSaleId: uuid('general_sale_id').notNull(),
    productId: uuid('product_id').notNull(),
    qtyBase: numeric('qty_base', { precision: 18, scale: 3 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.generalSaleId],
      foreignColumns: [generalSaleInMpp.id],
      name: 'general_sale_line_general_sale_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'general_sale_line_product_id_fkey',
    }),
    check('ck_gs_line_qty', sql`qty_base > (0)::numeric`),
  ],
);

export const reconciliationRecordInRecon = recon.table(
  'reconciliation_record',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    sheetId: uuid('sheet_id').notNull(),
    locationId: uuid('location_id'),
    locationRaw: text('location_raw').notNull(),
    mppId: uuid('mpp_id'),
    mppCodeRaw: text('mpp_code_raw').notNull(),
    mppNameRaw: text('mpp_name_raw'),
    productId: uuid('product_id'),
    productRaw: text('product_raw').notNull(),
    advanceQty: numeric('advance_qty', { precision: 18, scale: 3 }).default('0').notNull(),
    sapQty: numeric('sap_qty', { precision: 18, scale: 3 }).default('0').notNull(),
    inputStatus: text('input_status'),
    inputMatchQuality: text('input_match_quality'),
    computedStatus: text('computed_status'),
    toBeSent: numeric('to_be_sent', { precision: 18, scale: 3 }).default('0').notNull(),
    toBeDeducted: numeric('to_be_deducted', { precision: 18, scale: 3 }).default('0').notNull(),
    isService: boolean('is_service').default(false).notNull(),
    exceptionCode: text('exception_code'),
    exceptionResolution: text('exception_resolution'),
    acknowledgedBy: uuid('acknowledged_by'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true, mode: 'string' }),
    ackComment: text('ack_comment'),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_recon_record_exceptions')
      .using('btree', table.sheetId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(exception_code IS NOT NULL)`),
    index('ix_recon_record_location').using(
      'btree',
      table.locationId.asc().nullsLast().op('uuid_ops'),
      table.sheetId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.acknowledgedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'reconciliation_record_acknowledged_by_fkey',
    }),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'reconciliation_record_location_id_fkey',
    }),
    foreignKey({
      columns: [table.mppId],
      foreignColumns: [mppInCatalog.id],
      name: 'reconciliation_record_mpp_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'reconciliation_record_product_id_fkey',
    }),
    foreignKey({
      columns: [table.sheetId],
      foreignColumns: [reconciliationSheetInRecon.id],
      name: 'reconciliation_record_sheet_id_fkey',
    }),
    unique('uq_recon_record').on(
      table.sheetId,
      table.locationRaw,
      table.mppCodeRaw,
      table.productRaw,
    ),
    check(
      'ck_recon_amounts',
      sql`(to_be_sent >= (0)::numeric) AND (to_be_deducted >= (0)::numeric) AND (NOT ((to_be_sent > (0)::numeric) AND (to_be_deducted > (0)::numeric)))`,
    ),
    check(
      'ck_recon_computed',
      sql`(computed_status IS NULL) OR (computed_status = ANY (ARRAY['PERFECT_MATCH'::text, 'UNDER_RECORDED'::text, 'OVER_RECORDED'::text, 'NOT_RECORDED'::text]))`,
    ),
    check(
      'ck_recon_mapped',
      sql`(exception_code IS NOT NULL) OR (computed_status = 'NOT_RECORDED'::text) OR ((mpp_id IS NOT NULL) AND (product_id IS NOT NULL)) OR (computed_status IS NULL)`,
    ),
  ],
);

export const advanceSaleInMpp = mpp.table(
  'advance_sale',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    saleNumber: text('sale_number').notNull(),
    saleCode: char('sale_code', { length: 10 }).notNull(),
    locationId: uuid('location_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    mppId: uuid('mpp_id').notNull(),
    mppSnapshot: jsonb('mpp_snapshot').notNull(),
    cycleId: uuid('cycle_id').notNull(),
    saleDate: date('sale_date').notNull(),
    status: text().default('ISSUED').notNull(),
    podStatus: text('pod_status').default('PENDING').notNull(),
    receiptDocumentId: uuid('receipt_document_id'),
    receiptStatus: text('receipt_status').default('PENDING').notNull(),
    channel: text().default('WEB').notNull(),
    clientRef: uuid('client_ref').notNull(),
    clientCreatedAt: timestamp('client_created_at', { withTimezone: true, mode: 'string' }),
    cancelledReason: text('cancelled_reason'),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    legacyAdvanceSaleIds: bigint('legacy_advance_sale_ids', { mode: 'number' })
      .array()
      .default([])
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_sale_location_cycle').using(
      'btree',
      table.locationId.asc().nullsLast().op('uuid_ops'),
      table.cycleId.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_sale_mpp').using(
      'btree',
      table.mppId.asc().nullsLast().op('date_ops'),
      table.saleDate.desc().nullsFirst().op('date_ops'),
    ),
    index('ix_sale_pod_pending')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`((pod_status = 'PENDING'::text) AND (status = 'ISSUED'::text))`),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'advance_sale_created_by_fkey',
    }),
    foreignKey({
      columns: [table.cycleId],
      foreignColumns: [paymentCycleInRecon.id],
      name: 'advance_sale_cycle_id_fkey',
    }),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'advance_sale_location_id_fkey',
    }),
    foreignKey({
      columns: [table.mppId],
      foreignColumns: [mppInCatalog.id],
      name: 'advance_sale_mpp_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'advance_sale_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.receiptDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'advance_sale_receipt_document_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouseInOrg.id],
      name: 'advance_sale_warehouse_id_fkey',
    }),
    unique('uq_sale_code').on(table.organizationId, table.saleCode),
    unique('uq_sale_number').on(table.organizationId, table.saleNumber),
    unique('uq_sale_client_ref').on(table.organizationId, table.clientRef, table.createdBy),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_sale_channel',
      sql`channel = ANY (ARRAY['WEB'::text, 'MOBILE'::text, 'MOBILE_OFFLINE'::text, 'API'::text])`,
    ),
    check('ck_sale_code', sql`sale_code ~ '^[0-9]{10}$'::text`),
    check(
      'ck_sale_pod',
      sql`pod_status = ANY (ARRAY['PENDING'::text, 'UPLOADED'::text, 'NOT_REQUIRED'::text])`,
    ),
    check(
      'ck_sale_receipt',
      sql`receipt_status = ANY (ARRAY['PENDING'::text, 'GENERATING'::text, 'READY'::text, 'FAILED'::text])`,
    ),
    check(
      'ck_sale_status',
      sql`status = ANY (ARRAY['ISSUED'::text, 'DELIVERED'::text, 'RECONCILED'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const invoiceLineInFinance = finance.table(
  'invoice_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    poLineId: uuid('po_line_id'),
    grnLineIds: uuid('grn_line_ids').array().default(['']).notNull(),
    productId: uuid('product_id'),
    qty: numeric({ precision: 18, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
    taxPct: numeric('tax_pct', { precision: 5, scale: 2 }).default('0').notNull(),
    amount: numeric({ precision: 18, scale: 2 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.invoiceId],
      foreignColumns: [invoiceInFinance.id],
      name: 'invoice_line_invoice_id_fkey',
    }),
    foreignKey({
      columns: [table.poLineId],
      foreignColumns: [purchaseOrderLineInProcurement.id],
      name: 'invoice_line_po_line_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'invoice_line_product_id_fkey',
    }),
    check('ck_invoice_line', sql`(qty > (0)::numeric) AND (unit_price >= (0)::numeric)`),
  ],
);

export const paymentRecordInFinance = finance.table(
  'payment_record',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    amount: numeric({ precision: 18, scale: 2 }).notNull(),
    paidOn: date('paid_on').notNull(),
    reference: text().notNull(),
    mode: text(),
    recordedBy: uuid('recorded_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.invoiceId],
      foreignColumns: [invoiceInFinance.id],
      name: 'payment_record_invoice_id_fkey',
    }),
    foreignKey({
      columns: [table.recordedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'payment_record_recorded_by_fkey',
    }),
    check('ck_payment_amount', sql`amount > (0)::numeric`),
  ],
);

export const matchResultInFinance = finance.table(
  'match_result',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    invoiceLineId: uuid('invoice_line_id').notNull(),
    poLineId: uuid('po_line_id'),
    qtyPo: numeric('qty_po', { precision: 18, scale: 3 }),
    qtyGrnAccepted: numeric('qty_grn_accepted', { precision: 18, scale: 3 }),
    qtyInvoiced: numeric('qty_invoiced', { precision: 18, scale: 3 }).notNull(),
    pricePo: numeric('price_po', { precision: 18, scale: 4 }),
    priceInvoiced: numeric('price_invoiced', { precision: 18, scale: 4 }).notNull(),
    varianceAmount: numeric('variance_amount', { precision: 18, scale: 2 }).default('0').notNull(),
    status: text().notNull(),
    toleranceApplied: jsonb('tolerance_applied'),
    resolution: text(),
    resolvedBy: uuid('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
    matchedAt: timestamp('matched_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.invoiceLineId],
      foreignColumns: [invoiceLineInFinance.id],
      name: 'match_result_invoice_line_id_fkey',
    }),
    foreignKey({
      columns: [table.poLineId],
      foreignColumns: [purchaseOrderLineInProcurement.id],
      name: 'match_result_po_line_id_fkey',
    }),
    foreignKey({
      columns: [table.resolvedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'match_result_resolved_by_fkey',
    }),
    check(
      'ck_match_status',
      sql`status = ANY (ARRAY['MATCHED'::text, 'QTY_MISMATCH'::text, 'PRICE_MISMATCH'::text, 'MISSING_GRN'::text, 'MISSING_PO'::text])`,
    ),
  ],
);

export const grnVerificationInFinance = finance.table(
  'grn_verification',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    grnId: uuid('grn_id').notNull(),
    status: text().notNull(),
    remarks: text(),
    verifiedBy: uuid('verified_by').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.grnId],
      foreignColumns: [grnInReceiving.id],
      name: 'grn_verification_grn_id_fkey',
    }),
    foreignKey({
      columns: [table.verifiedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'grn_verification_verified_by_fkey',
    }),
    check('ck_grn_verif', sql`status = ANY (ARRAY['VERIFIED'::text, 'REJECTED'::text])`),
  ],
);

export const invoiceInFinance = finance.table(
  'invoice',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    vendorId: uuid('vendor_id').notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    invoiceDate: date('invoice_date').notNull(),
    fiscalYear: text('fiscal_year').notNull(),
    poId: uuid('po_id'),
    vendorGstin: text('vendor_gstin'),
    subtotal: numeric({ precision: 18, scale: 2 }).default('0').notNull(),
    taxTotal: numeric('tax_total', { precision: 18, scale: 2 }).default('0').notNull(),
    grandTotal: numeric('grand_total', { precision: 18, scale: 2 }).default('0').notNull(),
    status: text().default('DRAFT').notNull(),
    paymentStatus: text('payment_status').default('UNPAID').notNull(),
    documentId: uuid('document_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [documentInDocs.id],
      name: 'invoice_document_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'invoice_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.poId],
      foreignColumns: [purchaseOrderInProcurement.id],
      name: 'invoice_po_id_fkey',
    }),
    foreignKey({
      columns: [table.vendorId],
      foreignColumns: [vendorInCatalog.id],
      name: 'invoice_vendor_id_fkey',
    }),
    unique('uq_invoice').on(
      table.organizationId,
      table.vendorId,
      table.invoiceNumber,
      table.fiscalYear,
    ),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_invoice_payment',
      sql`payment_status = ANY (ARRAY['UNPAID'::text, 'SCHEDULED'::text, 'PARTIALLY_PAID'::text, 'PAID'::text])`,
    ),
    check(
      'ck_invoice_status',
      sql`status = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text, 'MATCHED'::text, 'EXCEPTION'::text, 'APPROVED'::text, 'ON_HOLD'::text, 'REJECTED'::text])`,
    ),
    check('ck_invoice_totals', sql`grand_total = (subtotal + tax_total)`),
  ],
);

export const deadLetterInEvents = events.table(
  'dead_letter',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    consumer: text().notNull(),
    eventId: uuid('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb().notNull(),
    error: text().notNull(),
    attempts: integer().notNull(),
    failedAt: timestamp('failed_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    replayedAt: timestamp('replayed_at', { withTimezone: true, mode: 'string' }),
    replayedBy: uuid('replayed_by'),
  },
  (table): PgTableExtraConfigValue[] => [
    unique('uq_dead_letter').on(table.consumer, table.eventId),
  ],
);

export const notificationInNotify = notify.table(
  'notification',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    userId: uuid('user_id').notNull(),
    category: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    link: text(),
    priority: text().default('NORMAL').notNull(),
    eventId: uuid('event_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_notification_user_unread')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('timestamptz_ops'),
        table.createdAt.desc().nullsFirst().op('timestamptz_ops'),
      )
      .where(sql`(read_at IS NULL)`),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'notification_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'notification_user_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const pushDeviceInNotify = notify.table(
  'push_device',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    sessionId: uuid('session_id'),
    platform: text().notNull(),
    token: text().notNull(),
    deviceName: text('device_name'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [sessionInIdentity.id],
      name: 'push_device_session_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'push_device_user_id_fkey',
    }).onDelete('cascade'),
    unique('push_device_token_key').on(table.token),
    check(
      'ck_push_platform',
      sql`platform = ANY (ARRAY['ANDROID'::text, 'IOS'::text, 'WEB'::text])`,
    ),
  ],
);

export const webhookInboxInNotify = notify.table(
  'webhook_inbox',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    provider: text().notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    payload: jsonb().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
    error: text(),
  },
  (table): PgTableExtraConfigValue[] => [
    unique('uq_webhook_dedupe').on(table.provider, table.dedupeKey),
  ],
);

export const outboxInEvents = events.table(
  'outbox',
  {
    id: uuid().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    eventType: text('event_type').notNull(),
    eventVersion: integer('event_version').default(1).notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    aggregateVersion: integer('aggregate_version').notNull(),
    payload: jsonb().notNull(),
    metadata: jsonb().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    publishAttempts: integer('publish_attempts').default(0).notNull(),
    lastError: text('last_error'),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_outbox_aggregate').using(
      'btree',
      table.aggregateType.asc().nullsLast().op('int4_ops'),
      table.aggregateId.asc().nullsLast().op('int4_ops'),
      table.aggregateVersion.asc().nullsLast().op('text_ops'),
    ),
    index('ix_outbox_unpublished')
      .using('btree', table.createdAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(published_at IS NULL)`),
  ],
);

export const loginEventInAudit = audit.table(
  'login_event',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    userId: uuid('user_id'),
    outcome: text().notNull(),
    method: text().notNull(),
    ip: inet(),
    device: text(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_login_user').using(
      'btree',
      table.userId.asc().nullsLast().op('timestamptz_ops'),
      table.occurredAt.desc().nullsFirst().op('timestamptz_ops'),
    ),
    check(
      'ck_login_outcome',
      sql`outcome = ANY (ARRAY['SUCCESS'::text, 'FAILURE'::text, 'LOCKED'::text, 'MFA_REQUIRED'::text, 'MFA_FAILED'::text])`,
    ),
  ],
);

export const importErrorInIo = io.table(
  'import_error',
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity({
      name: 'io.import_error_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      cache: 1,
    }),
    batchId: uuid('batch_id').notNull(),
    rowIndex: integer('row_index').notNull(),
    field: text(),
    value: text(),
    rule: text().notNull(),
    message: text().notNull(),
    suggestion: text(),
    isCritical: boolean('is_critical').default(true).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_import_error_batch').using(
      'btree',
      table.batchId.asc().nullsLast().op('int4_ops'),
      table.rowIndex.asc().nullsLast().op('int4_ops'),
    ),
    foreignKey({
      columns: [table.batchId],
      foreignColumns: [importBatchInIo.id],
      name: 'import_error_batch_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const importRowAuditInIo = io.table(
  'import_row_audit',
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity({
      name: 'io.import_row_audit_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      cache: 1,
    }),
    batchId: uuid('batch_id').notNull(),
    rowIndex: integer('row_index').notNull(),
    action: text().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    changes: jsonb(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.batchId],
      foreignColumns: [importBatchInIo.id],
      name: 'import_row_audit_batch_id_fkey',
    }).onDelete('cascade'),
    check(
      'ck_row_audit_action',
      sql`action = ANY (ARRAY['CREATE'::text, 'UPDATE'::text, 'MERGE'::text, 'SKIP'::text, 'REJECT'::text, 'DEACTIVATE'::text])`,
    ),
  ],
);

export const savedFilterInIo = io.table(
  'saved_filter',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    listKey: text('list_key').notNull(),
    name: text().notNull(),
    filters: jsonb().notNull(),
    columns: text().array(),
    isDefault: boolean('is_default').default(false).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'saved_filter_user_id_fkey',
    }).onDelete('cascade'),
    unique('uq_saved_filter').on(table.userId, table.listKey, table.name),
  ],
);

export const stockStatementEntryInReporting = reporting.table(
  'stock_statement_entry',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    statementId: uuid('statement_id').notNull(),
    locationId: uuid('location_id').notNull(),
    productId: uuid('product_id').notNull(),
    openingBalance: integer('opening_balance').default(0).notNull(),
    received: integer().default(0).notNull(),
    receivedMcc: integer('received_mcc').default(0).notNull(),
    stockTransfer: integer('stock_transfer').default(0).notNull(),
    mppSale: integer('mpp_sale').default(0).notNull(),
    transporterDeduction: integer('transporter_deduction').default(0).notNull(),
    damage: integer().default(0).notNull(),
    expire: integer().default(0).notNull(),
    closingBalance: integer('closing_balance').generatedAlwaysAs(
      sql`(((((((opening_balance + received) + received_mcc) - abs(stock_transfer)) - mpp_sale) - transporter_deduction) - damage) - expire)`,
    ),
    remark: varchar({ length: 255 }).default('').notNull(),
    receivedSynced: integer('received_synced'),
    receivedMccSynced: integer('received_mcc_synced'),
    stockTransferSynced: integer('stock_transfer_synced'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_sse_location').using(
      'btree',
      table.locationId.asc().nullsLast().op('uuid_ops'),
      table.statementId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'stock_statement_entry_location_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'stock_statement_entry_product_id_fkey',
    }),
    foreignKey({
      columns: [table.statementId],
      foreignColumns: [stockStatementInReporting.id],
      name: 'stock_statement_entry_statement_id_fkey',
    }),
    unique('uq_stock_statement_entry').on(table.statementId, table.locationId, table.productId),
    check(
      'ck_sse_manual_nonneg',
      sql`(transporter_deduction >= 0) AND (damage >= 0) AND (expire >= 0)`,
    ),
    check('ck_sse_transfer', sql`stock_transfer <= 0`),
  ],
);

export const mppSaleRowInReporting = reporting.table(
  'mpp_sale_row',
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity({
      name: 'reporting.mpp_sale_row_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      cache: 1,
    }),
    statementId: uuid('statement_id').notNull(),
    sapPlant: text('sap_plant'),
    sapMccName: text('sap_mcc_name'),
    sapMppCode: text('sap_mpp_code'),
    sapMppName: text('sap_mpp_name'),
    sapMaterialCode: text('sap_material_code'),
    sapMaterialDesc: text('sap_material_desc'),
    quantity: integer().notNull(),
    matched: boolean().default(false).notNull(),
    locationId: uuid('location_id'),
    productId: uuid('product_id'),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_msr_statement').using(
      'btree',
      table.statementId.asc().nullsLast().op('bool_ops'),
      table.matched.asc().nullsLast().op('bool_ops'),
    ),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'mpp_sale_row_location_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'mpp_sale_row_product_id_fkey',
    }),
    foreignKey({
      columns: [table.statementId],
      foreignColumns: [stockStatementInReporting.id],
      name: 'mpp_sale_row_statement_id_fkey',
    }),
    check(
      'ck_msr_matched',
      sql`(NOT matched) OR ((location_id IS NOT NULL) AND (product_id IS NOT NULL))`,
    ),
  ],
);

export const exportJobInIo = io.table(
  'export_job',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    reportKey: text('report_key').notNull(),
    format: text().notNull(),
    filters: jsonb(),
    columns: text().array(),
    status: text().default('QUEUED').notNull(),
    rowCount: integer('row_count'),
    documentId: uuid('document_id'),
    requestedBy: uuid('requested_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [documentInDocs.id],
      name: 'export_job_document_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'export_job_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.requestedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'export_job_requested_by_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_export_format', sql`format = ANY (ARRAY['CSV'::text, 'XLSX'::text, 'PDF'::text])`),
    check(
      'ck_export_status',
      sql`status = ANY (ARRAY['QUEUED'::text, 'RUNNING'::text, 'COMPLETED'::text, 'FAILED'::text, 'EXPIRED'::text])`,
    ),
  ],
);

export const approvalTaskInWorkflow = workflow.table(
  'approval_task',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    instanceId: uuid('instance_id').notNull(),
    groupId: uuid('group_id'),
    stepKey: text('step_key').notNull(),
    stepName: text('step_name').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    subjectNumber: text('subject_number'),
    amount: numeric({ precision: 18, scale: 2 }),
    assigneeUserId: uuid('assignee_user_id'),
    assigneeRoleId: uuid('assignee_role_id'),
    onBehalfOfUserId: uuid('on_behalf_of_user_id'),
    mode: text().default('ANY').notNull(),
    status: text().default('PENDING').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'string' }),
    remindedAt: timestamp('reminded_at', { withTimezone: true, mode: 'string' }),
    escalatedAt: timestamp('escalated_at', { withTimezone: true, mode: 'string' }),
    actedAt: timestamp('acted_at', { withTimezone: true, mode: 'string' }),
    actedBy: uuid('acted_by'),
    action: text(),
    remark: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_task_assignee_open')
      .using(
        'btree',
        table.assigneeUserId.asc().nullsLast().op('timestamptz_ops'),
        table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`(status = ANY (ARRAY['PENDING'::text, 'ESCALATED'::text]))`),
    index('ix_task_due')
      .using('btree', table.dueAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(status = ANY (ARRAY['PENDING'::text, 'ESCALATED'::text]))`),
    index('ix_task_role_open')
      .using('btree', table.assigneeRoleId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(status = ANY (ARRAY['PENDING'::text, 'ESCALATED'::text]))`),
    index('ix_task_subject').using(
      'btree',
      table.subjectType.asc().nullsLast().op('text_ops'),
      table.subjectId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.actedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'approval_task_acted_by_fkey',
    }),
    foreignKey({
      columns: [table.assigneeRoleId],
      foreignColumns: [roleInIdentity.id],
      name: 'approval_task_assignee_role_id_fkey',
    }),
    foreignKey({
      columns: [table.assigneeUserId],
      foreignColumns: [appUserInIdentity.id],
      name: 'approval_task_assignee_user_id_fkey',
    }),
    foreignKey({
      columns: [table.groupId],
      foreignColumns: [approvalGroupInWorkflow.id],
      name: 'approval_task_group_id_fkey',
    }),
    foreignKey({
      columns: [table.instanceId],
      foreignColumns: [workflowInstanceInWorkflow.id],
      name: 'approval_task_instance_id_fkey',
    }),
    foreignKey({
      columns: [table.onBehalfOfUserId],
      foreignColumns: [appUserInIdentity.id],
      name: 'approval_task_on_behalf_of_user_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'approval_task_organization_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_task_acted',
      sql`((status = ANY (ARRAY['PENDING'::text, 'ESCALATED'::text])) = (acted_at IS NULL)) OR (status = ANY (ARRAY['CANCELLED'::text, 'REASSIGNED'::text]))`,
    ),
    check(
      'ck_task_assignee',
      sql`(assignee_user_id IS NOT NULL) OR (assignee_role_id IS NOT NULL)`,
    ),
    check('ck_task_mode', sql`mode = ANY (ARRAY['ANY'::text, 'ALL'::text, 'QUORUM'::text])`),
    check(
      'ck_task_status',
      sql`status = ANY (ARRAY['PENDING'::text, 'ESCALATED'::text, 'APPROVED'::text, 'REJECTED'::text, 'RETURNED'::text, 'CANCELLED'::text, 'REASSIGNED'::text])`,
    ),
  ],
);

export const delegationInWorkflow = workflow.table(
  'delegation',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    delegatorId: uuid('delegator_id').notNull(),
    delegateId: uuid('delegate_id').notNull(),
    definitionCodes: text('definition_codes').array().notNull(),
    scope: jsonb(),
    maxAmount: numeric('max_amount', { precision: 18, scale: 2 }),
    validFrom: timestamp('valid_from', { withTimezone: true, mode: 'string' }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true, mode: 'string' }).notNull(),
    reason: text(),
    status: text().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_delegation_active')
      .using(
        'btree',
        table.delegatorId.asc().nullsLast().op('timestamptz_ops'),
        table.validFrom.asc().nullsLast().op('timestamptz_ops'),
        table.validTo.asc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`(status = 'ACTIVE'::text)`),
    foreignKey({
      columns: [table.delegateId],
      foreignColumns: [appUserInIdentity.id],
      name: 'delegation_delegate_id_fkey',
    }),
    foreignKey({
      columns: [table.delegatorId],
      foreignColumns: [appUserInIdentity.id],
      name: 'delegation_delegator_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'delegation_organization_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_delegation_period', sql`valid_to > valid_from`),
    check('ck_delegation_self', sql`delegator_id <> delegate_id`),
    check(
      'ck_delegation_status',
      sql`status = ANY (ARRAY['ACTIVE'::text, 'REVOKED'::text, 'EXPIRED'::text])`,
    ),
  ],
);

export const stockStatementCellAuditInReporting = reporting.table(
  'stock_statement_cell_audit',
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity({
      name: 'reporting.stock_statement_cell_audit_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      cache: 1,
    }),
    entryId: uuid('entry_id').notNull(),
    columnKey: text('column_key').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    reason: text(),
    source: text().notNull(),
    changedBy: uuid('changed_by'),
    changedAt: timestamp('changed_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.changedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'stock_statement_cell_audit_changed_by_fkey',
    }),
    foreignKey({
      columns: [table.entryId],
      foreignColumns: [stockStatementEntryInReporting.id],
      name: 'stock_statement_cell_audit_entry_id_fkey',
    }),
    check(
      'ck_cell_audit_source',
      sql`source = ANY (ARRAY['INLINE_ADMIN'::text, 'INLINE_LOCATION'::text, 'FILLED_UPLOAD'::text, 'CORRECTED_UPLOAD'::text, 'SALE_UPLOAD'::text, 'REFRESH'::text])`,
    ),
  ],
);

export const sapPoLineInProcurement = procurement.table(
  'sap_po_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    importBatchId: uuid('import_batch_id'),
    sapPoNumber: text('sap_po_number').notNull(),
    sapMaterialCode: text('sap_material_code').notNull(),
    sapMaterialName: text('sap_material_name').notNull(),
    productId: uuid('product_id'),
    orderQty: numeric('order_qty', { precision: 18, scale: 3 }).notNull(),
    qtyConsumed: numeric('qty_consumed', { precision: 18, scale: 3 }).default('0').notNull(),
    plant: text(),
    storageLocation: text('storage_location'),
    documentDate: date('document_date').notNull(),
    vendorText: text('vendor_text'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_sap_po_product_open')
      .using('btree', table.productId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(qty_consumed < order_qty)`),
    foreignKey({
      columns: [table.importBatchId],
      foreignColumns: [importBatchInIo.id],
      name: 'fk_sap_po_import',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'sap_po_line_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'sap_po_line_product_id_fkey',
    }),
    unique('uq_sap_po_line').on(table.organizationId, table.sapPoNumber, table.sapMaterialCode),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_sap_po_qty', sql`(order_qty >= (0)::numeric) AND (qty_consumed >= (0)::numeric)`),
  ],
);

export const purchaseOrderInProcurement = procurement.table(
  'purchase_order',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    poNumber: text('po_number').notNull(),
    externalPoNumber: text('external_po_number'),
    poType: text('po_type').default('STANDARD').notNull(),
    vendorId: uuid('vendor_id').notNull(),
    vendorSnapshot: jsonb('vendor_snapshot').notNull(),
    billToLocationId: uuid('bill_to_location_id').notNull(),
    shipToLocationId: uuid('ship_to_location_id').notNull(),
    status: text().default('DRAFT').notNull(),
    orderDate: date('order_date')
      .default(sql`CURRENT_DATE`)
      .notNull(),
    currency: char({ length: 3 }).default('INR').notNull(),
    subtotal: numeric({ precision: 18, scale: 2 }).default('0').notNull(),
    taxTotal: numeric('tax_total', { precision: 18, scale: 2 }).default('0').notNull(),
    grandTotal: numeric('grand_total', { precision: 18, scale: 2 }).default('0').notNull(),
    terms: text(),
    sendSuppressed: boolean('send_suppressed').default(false).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
    noPoReason: text('no_po_reason'),
    workflowInstanceId: uuid('workflow_instance_id'),
    legacyPoRaw: text('legacy_po_raw'),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('simple'::regconfig, ((COALESCE(po_number, ''::text) || ' '::text) || COALESCE(external_po_number, ''::text)))`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    updatedBy: uuid('updated_by'),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_po_ship_to_open')
      .using('btree', table.shipToLocationId.asc().nullsLast().op('uuid_ops'))
      .where(
        sql`(status = ANY (ARRAY['SENT'::text, 'PARTIALLY_RECEIVED'::text, 'APPROVED'::text]))`,
      ),
    index('ix_po_tsv').using('gin', table.searchTsv.asc().nullsLast().op('tsvector_ops')),
    index('ix_po_vendor_status').using(
      'btree',
      table.vendorId.asc().nullsLast().op('text_ops'),
      table.status.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('uq_po_external')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('text_ops'),
        table.vendorId.asc().nullsLast().op('text_ops'),
        table.externalPoNumber.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`(external_po_number IS NOT NULL)`),
    foreignKey({
      columns: [table.billToLocationId],
      foreignColumns: [locationInOrg.id],
      name: 'purchase_order_bill_to_location_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'purchase_order_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.shipToLocationId],
      foreignColumns: [locationInOrg.id],
      name: 'purchase_order_ship_to_location_id_fkey',
    }),
    foreignKey({
      columns: [table.vendorId],
      foreignColumns: [vendorInCatalog.id],
      name: 'purchase_order_vendor_id_fkey',
    }),
    foreignKey({
      columns: [table.workflowInstanceId],
      foreignColumns: [workflowInstanceInWorkflow.id],
      name: 'purchase_order_workflow_instance_id_fkey',
    }),
    unique('uq_po_number').on(table.organizationId, table.poNumber),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_po_no_po_reason', sql`(po_type <> 'NO_PO'::text) OR (no_po_reason IS NOT NULL)`),
    check(
      'ck_po_status',
      sql`status = ANY (ARRAY['DRAFT'::text, 'PENDING_APPROVAL'::text, 'APPROVED'::text, 'REJECTED'::text, 'SENT'::text, 'PARTIALLY_RECEIVED'::text, 'RECEIVED'::text, 'SHORT_CLOSED'::text, 'CLOSED'::text, 'CANCELLED'::text])`,
    ),
    check(
      'ck_po_totals',
      sql`(subtotal >= (0)::numeric) AND (tax_total >= (0)::numeric) AND (grand_total = (subtotal + tax_total))`,
    ),
    check(
      'ck_po_type',
      sql`po_type = ANY (ARRAY['STANDARD'::text, 'SAP_REFERENCE'::text, 'NO_PO'::text])`,
    ),
  ],
);

export const stnReceiptInLogistics = logistics.table(
  'stn_receipt',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    stnId: uuid('stn_id').notNull(),
    receiptNumber: text('receipt_number').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    receivedBy: uuid('received_by').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    legacyGrnNumber: text('legacy_grn_number'),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'stn_receipt_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.receivedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'stn_receipt_received_by_fkey',
    }),
    foreignKey({
      columns: [table.stnId],
      foreignColumns: [stnInLogistics.id],
      name: 'stn_receipt_stn_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouseInOrg.id],
      name: 'stn_receipt_warehouse_id_fkey',
    }),
    unique('uq_stn_receipt_number').on(table.organizationId, table.receiptNumber),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const otherSaleLineInMpp = mpp.table(
  'other_sale_line',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    otherSaleId: uuid('other_sale_id').notNull(),
    productId: uuid('product_id').notNull(),
    qtyBase: numeric('qty_base', { precision: 18, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.otherSaleId],
      foreignColumns: [otherSaleInMpp.id],
      name: 'other_sale_line_other_sale_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'other_sale_line_product_id_fkey',
    }),
    check('ck_other_sale_line', sql`(qty_base > (0)::numeric) AND (unit_price >= (0)::numeric)`),
  ],
);

export const locationInOrg = org.table(
  'location',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    regionId: uuid('region_id'),
    code: text().notNull(),
    name: text().notNull(),
    nameHi: text('name_hi'),
    type: text().notNull(),
    sapPlantCode: text('sap_plant_code'),
    address: text(),
    gstin: text(),
    excludedFromCrossView: boolean('excluded_from_cross_view').default(false).notNull(),
    status: text().default('ACTIVE').notNull(),
    legacyName: text('legacy_name'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_location_sap_plant')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('text_ops'),
        table.sapPlantCode.asc().nullsLast().op('text_ops'),
      )
      .where(sql`(sap_plant_code IS NOT NULL)`),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'location_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.regionId],
      foreignColumns: [regionInOrg.id],
      name: 'location_region_id_fkey',
    }),
    unique('uq_location_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_location_status', sql`status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])`),
    check(
      'ck_location_type',
      sql`type = ANY (ARRAY['HEAD_OFFICE'::text, 'BMC'::text, 'MCC'::text, 'PLANT'::text, 'WAREHOUSE'::text, 'OTHER'::text])`,
    ),
  ],
);

export const warehouseInOrg = org.table(
  'warehouse',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    locationId: uuid('location_id'),
    code: text().notNull(),
    name: text().notNull(),
    type: text().default('STORE').notNull(),
    status: text().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_warehouse_location').using(
      'btree',
      table.locationId.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('uq_warehouse_single_transit')
      .using('btree', table.organizationId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(type = 'IN_TRANSIT'::text)`),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'warehouse_location_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'warehouse_organization_id_fkey',
    }),
    unique('uq_warehouse_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_warehouse_location', sql`(type = 'IN_TRANSIT'::text) OR (location_id IS NOT NULL)`),
    check(
      'ck_warehouse_type',
      sql`type = ANY (ARRAY['STORE'::text, 'IN_TRANSIT'::text, 'QUARANTINE'::text, 'DAMAGED'::text, 'EXPIRED'::text])`,
    ),
  ],
);

export const departmentInOrg = org.table(
  'department',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    status: text().default('ACTIVE').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'department_organization_id_fkey',
    }),
    unique('uq_department_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const designationInOrg = org.table(
  'designation',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'designation_organization_id_fkey',
    }),
    unique('uq_designation_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const appUserInIdentity = identity.table(
  'app_user',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    email: citext('email').notNull(),
    mobileE164: text('mobile_e164'),
    employeeCode: text('employee_code'),
    displayName: text('display_name').notNull(),
    departmentId: uuid('department_id'),
    designationId: uuid('designation_id'),
    primaryLocationId: uuid('primary_location_id'),
    deliveryPointCode: text('delivery_point_code'),
    preferredLocale: text('preferred_locale').default('EN').notNull(),
    signatureDocumentId: uuid('signature_document_id'),
    sealDocumentId: uuid('seal_document_id'),
    reportsToId: uuid('reports_to_id'),
    status: text().default('INVITED').notNull(),
    passwordHash: text('password_hash'),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true, mode: 'string' }),
    mustChangePassword: boolean('must_change_password').default(false).notNull(),
    failedAttempts: integer('failed_attempts').default(0).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'string' }),
    mfaEnforced: boolean('mfa_enforced').default(false).notNull(),
    rolesVersion: integer('roles_version').default(1).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'string' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    legacyUserId: bigint('legacy_user_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    updatedBy: uuid('updated_by'),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_user_location').using(
      'btree',
      table.primaryLocationId.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_user_name_trgm').using('gin', table.displayName.asc().nullsLast().op('gin_trgm_ops')),
    foreignKey({
      columns: [table.departmentId],
      foreignColumns: [departmentInOrg.id],
      name: 'app_user_department_id_fkey',
    }),
    foreignKey({
      columns: [table.designationId],
      foreignColumns: [designationInOrg.id],
      name: 'app_user_designation_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'app_user_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.primaryLocationId],
      foreignColumns: [locationInOrg.id],
      name: 'app_user_primary_location_id_fkey',
    }),
    foreignKey({
      columns: [table.reportsToId],
      foreignColumns: [table.id],
      name: 'app_user_reports_to_id_fkey',
    }),
    foreignKey({
      columns: [table.sealDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'fk_user_seal',
    }),
    foreignKey({
      columns: [table.signatureDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'fk_user_signature',
    }),
    unique('uq_user_employee_code').on(table.organizationId, table.employeeCode),
    unique('uq_user_delivery_point').on(table.organizationId, table.deliveryPointCode),
    unique('uq_user_email').on(table.email),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_user_locale', sql`preferred_locale = ANY (ARRAY['EN'::text, 'HI'::text])`),
    check(
      'ck_user_mobile',
      sql`(mobile_e164 IS NULL) OR (mobile_e164 ~ '^\\+[1-9][0-9]{7,14}$'::text)`,
    ),
    check(
      'ck_user_status',
      sql`status = ANY (ARRAY['INVITED'::text, 'ACTIVE'::text, 'LOCKED'::text, 'DISABLED'::text])`,
    ),
  ],
);

export const numberSeriesInConfig = config.table(
  'number_series',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    docType: text('doc_type').notNull(),
    locationId: uuid('location_id'),
    fiscalYear: text('fiscal_year'),
    prefix: text().notNull(),
    padding: integer().default(4).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    nextValue: bigint('next_value', { mode: 'number' }).default(1).notNull(),
    resetPolicy: text('reset_policy').default('NEVER').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_number_series').using(
      'btree',
      sql`organization_id`,
      sql`doc_type`,
      sql`COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`COALESCE(fiscal_year, ''::text)`,
    ),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'number_series_location_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'number_series_organization_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_series_next', sql`next_value >= 1`),
    check('ck_series_padding', sql`(padding >= 1) AND (padding <= 12)`),
    check(
      'ck_series_reset',
      sql`reset_policy = ANY (ARRAY['NEVER'::text, 'FISCAL_YEAR'::text, 'CALENDAR_YEAR'::text])`,
    ),
  ],
);

export const holidayInConfig = config.table(
  'holiday',
  {
    organizationId: uuid('organization_id').notNull(),
    locationId: uuid('location_id'),
    holidayDate: date('holiday_date').notNull(),
    name: text().notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_holiday').using(
      'btree',
      sql`organization_id`,
      sql`COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`holiday_date`,
    ),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'holiday_location_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'holiday_organization_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const uomInCatalog = catalog.table(
  'uom',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    name: text().notNull(),
    nameHi: text('name_hi'),
    decimalsAllowed: smallint('decimals_allowed').default(0).notNull(),
    legacyCodes: text('legacy_codes').array().default(['']).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'uom_organization_id_fkey',
    }),
    unique('uq_uom_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_uom_decimals', sql`(decimals_allowed >= 0) AND (decimals_allowed <= 3)`),
  ],
);

export const productCategoryInCatalog = catalog.table(
  'product_category',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    parentId: uuid('parent_id'),
    code: text().notNull(),
    name: text().notNull(),
    ownerUserId: uuid('owner_user_id'),
    requiresInspection: boolean('requires_inspection').default(false).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'product_category_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.ownerUserId],
      foreignColumns: [appUserInIdentity.id],
      name: 'product_category_owner_user_id_fkey',
    }),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'product_category_parent_id_fkey',
    }),
    unique('uq_category_code').on(table.organizationId, table.code),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const indentInIndent = indent.table(
  'indent',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    indentNumber: text('indent_number'),
    locationId: uuid('location_id').notNull(),
    departmentId: uuid('department_id'),
    requestedByUserId: uuid('requested_by_user_id').notNull(),
    requestedForEmployeeId: uuid('requested_for_employee_id'),
    priority: text().default('NORMAL').notNull(),
    requiredBy: date('required_by'),
    justification: text(),
    budgetCode: text('budget_code'),
    remarks: text(),
    status: text().default('DRAFT').notNull(),
    estimatedTotal: numeric('estimated_total', { precision: 18, scale: 2 }).default('0').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'string' }),
    workflowInstanceId: uuid('workflow_instance_id'),
    channel: text().default('WEB').notNull(),
    clientRef: uuid('client_ref'),
    legacyRequisitionNumber: text('legacy_requisition_number'),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('simple'::regconfig, ((((COALESCE(indent_number, ''::text) || ' '::text) || COALESCE(justification, ''::text)) || ' '::text) || COALESCE(remarks, ''::text)))`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    updatedBy: uuid('updated_by'),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_indent_location_status').using(
      'btree',
      table.locationId.asc().nullsLast().op('text_ops'),
      table.status.asc().nullsLast().op('text_ops'),
      table.submittedAt.desc().nullsFirst().op('uuid_ops'),
    ),
    index('ix_indent_requester').using(
      'btree',
      table.requestedByUserId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsFirst().op('uuid_ops'),
    ),
    index('ix_indent_tsv').using('gin', table.searchTsv.asc().nullsLast().op('tsvector_ops')),
    uniqueIndex('uq_indent_client_ref')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('uuid_ops'),
        table.requestedByUserId.asc().nullsLast().op('uuid_ops'),
        table.clientRef.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`(client_ref IS NOT NULL)`),
    uniqueIndex('uq_indent_number')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('text_ops'),
        table.indentNumber.asc().nullsLast().op('text_ops'),
      )
      .where(sql`(indent_number IS NOT NULL)`),
    foreignKey({
      columns: [table.workflowInstanceId],
      foreignColumns: [workflowInstanceInWorkflow.id],
      name: 'fk_indent_workflow',
    }),
    foreignKey({
      columns: [table.departmentId],
      foreignColumns: [departmentInOrg.id],
      name: 'indent_department_id_fkey',
    }),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'indent_location_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'indent_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.requestedByUserId],
      foreignColumns: [appUserInIdentity.id],
      name: 'indent_requested_by_user_id_fkey',
    }),
    foreignKey({
      columns: [table.requestedForEmployeeId],
      foreignColumns: [employeeInOrg.id],
      name: 'indent_requested_for_employee_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_indent_number_after_submit',
      sql`(status = 'DRAFT'::text) OR (indent_number IS NOT NULL)`,
    ),
    check(
      'ck_indent_priority',
      sql`priority = ANY (ARRAY['LOW'::text, 'NORMAL'::text, 'HIGH'::text, 'URGENT'::text])`,
    ),
    check(
      'ck_indent_status',
      sql`status = ANY (ARRAY['DRAFT'::text, 'PENDING_APPROVAL'::text, 'PARTIALLY_APPROVED'::text, 'RETURNED'::text, 'APPROVED'::text, 'REJECTED'::text, 'IN_FULFILMENT'::text, 'FULFILLED'::text, 'CLOSED'::text, 'CANCELLED'::text])`,
    ),
    check('ck_indent_total', sql`estimated_total >= (0)::numeric`),
  ],
);

export const workflowInstanceInWorkflow = workflow.table(
  'workflow_instance',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    versionId: uuid('version_id').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    status: text().default('RUNNING').notNull(),
    context: jsonb().default({}).notNull(),
    previousInstanceId: uuid('previous_instance_id'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_wf_instance_subject').using(
      'btree',
      table.subjectType.asc().nullsLast().op('text_ops'),
      table.subjectId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'workflow_instance_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.previousInstanceId],
      foreignColumns: [table.id],
      name: 'workflow_instance_previous_instance_id_fkey',
    }),
    foreignKey({
      columns: [table.versionId],
      foreignColumns: [workflowVersionInWorkflow.id],
      name: 'workflow_instance_version_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_wf_instance_status',
      sql`status = ANY (ARRAY['RUNNING'::text, 'COMPLETED'::text, 'RETURNED'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const transitDiscrepancyInLogistics = logistics.table(
  'transit_discrepancy',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    stnLineId: uuid('stn_line_id').notNull(),
    type: text().notNull(),
    qty: numeric({ precision: 18, scale: 3 }).notNull(),
    status: text().default('OPEN').notNull(),
    resolution: text(),
    remarks: text(),
    resolvedBy: uuid('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_disc_open')
      .using('btree', table.createdAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(status <> 'RESOLVED'::text)`),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'transit_discrepancy_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.resolvedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'transit_discrepancy_resolved_by_fkey',
    }),
    foreignKey({
      columns: [table.stnLineId],
      foreignColumns: [stnLineInLogistics.id],
      name: 'transit_discrepancy_stn_line_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_disc_qty', sql`qty > (0)::numeric`),
    check(
      'ck_disc_resolution',
      sql`(resolution IS NULL) OR (resolution = ANY (ARRAY['RETURN_TO_SOURCE'::text, 'WRITE_OFF'::text, 'LATE_RECEIPT'::text]))`,
    ),
    check(
      'ck_disc_resolved',
      sql`(status = 'RESOLVED'::text) = ((resolution IS NOT NULL) AND (resolved_at IS NOT NULL))`,
    ),
    check(
      'ck_disc_status',
      sql`status = ANY (ARRAY['OPEN'::text, 'PENDING_APPROVAL'::text, 'RESOLVED'::text])`,
    ),
    check('ck_disc_type', sql`type = ANY (ARRAY['SHORT'::text, 'DAMAGED'::text, 'EXCESS'::text])`),
  ],
);

export const batchInInventory = inventory.table(
  'batch',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    productId: uuid('product_id').notNull(),
    batchNo: text('batch_no').notNull(),
    mfgDate: date('mfg_date'),
    expiryDate: date('expiry_date'),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'batch_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'batch_product_id_fkey',
    }),
    unique('uq_batch').on(table.organizationId, table.productId, table.batchNo),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const stockCountInInventory = inventory.table(
  'stock_count',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    countNumber: text('count_number').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    status: text().default('OPEN').notNull(),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'string' }),
    adjustmentId: uuid('adjustment_id'),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.adjustmentId],
      foreignColumns: [stockAdjustmentInInventory.id],
      name: 'stock_count_adjustment_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'stock_count_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouseInOrg.id],
      name: 'stock_count_warehouse_id_fkey',
    }),
    unique('uq_count_number').on(table.organizationId, table.countNumber),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_count_status',
      sql`status = ANY (ARRAY['OPEN'::text, 'SUBMITTED'::text, 'ADJUSTED'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const cycleMonthInRecon = recon.table(
  'cycle_month',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    year: integer().notNull(),
    month: integer().notNull(),
    name: text().notNull(),
    description: text(),
    isLocked: boolean('is_locked').default(false).notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'string' }),
    lockedBy: uuid('locked_by'),
    lockReason: text('lock_reason'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'cycle_month_created_by_fkey',
    }),
    foreignKey({
      columns: [table.lockedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'cycle_month_locked_by_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'cycle_month_organization_id_fkey',
    }),
    unique('uq_cycle_month').on(table.organizationId, table.year, table.month),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_cycle_month',
      sql`((month >= 1) AND (month <= 12)) AND ((year >= 2020) AND (year <= 2100))`,
    ),
    check('ck_cycle_month_lock', sql`(NOT is_locked) OR (locked_at IS NOT NULL)`),
  ],
);

export const paymentCycleInRecon = recon.table(
  'payment_cycle',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    cycleMonthId: uuid('cycle_month_id').notNull(),
    cycleNo: integer('cycle_no').notNull(),
    name: text().notNull(),
    sapCycleNumber: text('sap_cycle_number'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: text().default('PLANNED').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    legacyCycleId: bigint('legacy_cycle_id', { mode: 'number' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_cycle_sap_number')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('text_ops'),
        table.sapCycleNumber.asc().nullsLast().op('text_ops'),
      )
      .where(sql`(sap_cycle_number IS NOT NULL)`),
    uniqueIndex('uq_cycle_single_active')
      .using('btree', table.organizationId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(status = 'ACTIVE'::text)`),
    foreignKey({
      columns: [table.cycleMonthId],
      foreignColumns: [cycleMonthInRecon.id],
      name: 'payment_cycle_cycle_month_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'payment_cycle_organization_id_fkey',
    }),
    unique('uq_cycle_no').on(table.cycleMonthId, table.cycleNo),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_cycle_dates', sql`start_date <= end_date`),
    check(
      'ck_cycle_status',
      sql`status = ANY (ARRAY['PLANNED'::text, 'ACTIVE'::text, 'INACTIVE'::text, 'RECONCILING'::text, 'CLOSED'::text])`,
    ),
  ],
);

export const generalSaleInMpp = mpp.table(
  'general_sale',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    saleNumber: text('sale_number').notNull(),
    saleCode: char('sale_code', { length: 10 }),
    origin: text().notNull(),
    reconciliationRecordId: uuid('reconciliation_record_id'),
    locationId: uuid('location_id').notNull(),
    mppId: uuid('mpp_id').notNull(),
    cycleId: uuid('cycle_id').notNull(),
    status: text().default('PENDING').notNull(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true, mode: 'string' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'string' }),
    clientRef: uuid('client_ref'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by'),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_general_sale_code')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('bpchar_ops'),
        table.saleCode.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`(sale_code IS NOT NULL)`),
    foreignKey({
      columns: [table.reconciliationRecordId],
      foreignColumns: [reconciliationRecordInRecon.id],
      name: 'fk_general_sale_record',
    }),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'general_sale_created_by_fkey',
    }),
    foreignKey({
      columns: [table.cycleId],
      foreignColumns: [paymentCycleInRecon.id],
      name: 'general_sale_cycle_id_fkey',
    }),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'general_sale_location_id_fkey',
    }),
    foreignKey({
      columns: [table.mppId],
      foreignColumns: [mppInCatalog.id],
      name: 'general_sale_mpp_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'general_sale_organization_id_fkey',
    }),
    unique('uq_general_sale_number').on(table.organizationId, table.saleNumber),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_gs_origin', sql`origin = ANY (ARRAY['RECONCILIATION'::text, 'MANUAL'::text])`),
    check(
      'ck_gs_status',
      sql`status = ANY (ARRAY['PENDING'::text, 'ISSUED'::text, 'DELIVERED'::text, 'RECONCILED'::text, 'CANCELLED'::text])`,
    ),
  ],
);

export const podInMpp = mpp.table(
  'pod',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    documentId: uuid('document_id').notNull(),
    verifiedCodeMatch: boolean('verified_code_match').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true, mode: 'string' }).notNull(),
    geoLat: doublePrecision('geo_lat'),
    geoLng: doublePrecision('geo_lng'),
    uploadedBy: uuid('uploaded_by').notNull(),
    status: text().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_pod_active')
      .using(
        'btree',
        table.subjectType.asc().nullsLast().op('text_ops'),
        table.subjectId.asc().nullsLast().op('text_ops'),
      )
      .where(sql`(status = 'ACTIVE'::text)`),
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [documentInDocs.id],
      name: 'pod_document_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'pod_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'pod_uploaded_by_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_pod_status', sql`status = ANY (ARRAY['ACTIVE'::text, 'SUPERSEDED'::text])`),
    check(
      'ck_pod_subject',
      sql`subject_type = ANY (ARRAY['ADVANCE_SALE'::text, 'GENERAL_SALE'::text, 'OTHER_SALE'::text, 'STN'::text])`,
    ),
    check('ck_pod_verified', sql`CHECK (verified_code_match)`),
  ],
);

export const reconciliationSheetInRecon = recon.table(
  'reconciliation_sheet',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    cycleId: uuid('cycle_id').notNull(),
    versionNo: integer('version_no').notNull(),
    importBatchId: uuid('import_batch_id'),
    fileDocumentId: uuid('file_document_id'),
    fileSha256: char('file_sha256', { length: 64 }).notNull(),
    status: text().default('UPLOADED').notNull(),
    totalRecords: integer('total_records').default(0).notNull(),
    perfectMatchCount: integer('perfect_match_count').default(0).notNull(),
    underRecordedCount: integer('under_recorded_count').default(0).notNull(),
    overRecordedCount: integer('over_recorded_count').default(0).notNull(),
    notRecordedCount: integer('not_recorded_count').default(0).notNull(),
    exceptionCount: integer('exception_count').default(0).notNull(),
    uploadedBy: uuid('uploaded_by').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    supersededById: uuid('superseded_by_id'),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    legacySheetId: bigint('legacy_sheet_id', { mode: 'number' }),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.importBatchId],
      foreignColumns: [importBatchInIo.id],
      name: 'fk_recon_sheet_import',
    }),
    foreignKey({
      columns: [table.cycleId],
      foreignColumns: [paymentCycleInRecon.id],
      name: 'reconciliation_sheet_cycle_id_fkey',
    }),
    foreignKey({
      columns: [table.fileDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'reconciliation_sheet_file_document_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'reconciliation_sheet_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.supersededById],
      foreignColumns: [table.id],
      name: 'reconciliation_sheet_superseded_by_id_fkey',
    }),
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'reconciliation_sheet_uploaded_by_fkey',
    }),
    unique('uq_recon_sheet_version').on(table.cycleId, table.versionNo),
    unique('uq_recon_sheet_file').on(table.cycleId, table.fileSha256),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_recon_sheet_status',
      sql`status = ANY (ARRAY['UPLOADED'::text, 'VALIDATING'::text, 'VALIDATION_FAILED'::text, 'PREVIEW_READY'::text, 'PROCESSING'::text, 'PROCESSED'::text, 'PROCESSED_WITH_EXCEPTIONS'::text, 'FAILED'::text, 'DISCARDED'::text, 'PUBLISHED'::text, 'SUPERSEDED'::text])`,
    ),
  ],
);

export const notificationTemplateInNotify = notify.table(
  'notification_template',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    code: text().notNull(),
    channel: text().notNull(),
    locale: text().notNull(),
    versionNo: integer('version_no').notNull(),
    subject: text(),
    body: text().notNull(),
    providerTemplateName: text('provider_template_name'),
    variables: text().array().default(['']).notNull(),
    status: text().default('DRAFT').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_template_published')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('uuid_ops'),
        table.code.asc().nullsLast().op('text_ops'),
        table.channel.asc().nullsLast().op('text_ops'),
        table.locale.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`(status = 'PUBLISHED'::text)`),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'notification_template_organization_id_fkey',
    }),
    unique('uq_template_version').on(
      table.organizationId,
      table.code,
      table.channel,
      table.locale,
      table.versionNo,
    ),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_template_channel',
      sql`channel = ANY (ARRAY['IN_APP'::text, 'PUSH'::text, 'EMAIL'::text, 'SMS'::text])`,
    ),
    check('ck_template_locale', sql`locale = ANY (ARRAY['EN'::text, 'HI'::text])`),
    check(
      'ck_template_status',
      sql`status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'RETIRED'::text])`,
    ),
  ],
);

export const notificationRuleInNotify = notify.table(
  'notification_rule',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    eventType: text('event_type').notNull(),
    condition: jsonb(),
    recipientResolvers: jsonb('recipient_resolvers').notNull(),
    channels: text().array().notNull(),
    templateCode: text('template_code').notNull(),
    category: text().notNull(),
    priority: text().default('NORMAL').notNull(),
    dedupeWindowSec: integer('dedupe_window_sec').default(0).notNull(),
    enabled: boolean().default(true).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_rule_event')
      .using(
        'btree',
        table.organizationId.asc().nullsLast().op('text_ops'),
        table.eventType.asc().nullsLast().op('text_ops'),
      )
      .where(sql`enabled`),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'notification_rule_organization_id_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_rule_priority',
      sql`priority = ANY (ARRAY['LOW'::text, 'NORMAL'::text, 'HIGH'::text, 'CRITICAL'::text])`,
    ),
  ],
);

export const importBatchInIo = io.table(
  'import_batch',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    kind: text().notNull(),
    fileDocumentId: uuid('file_document_id'),
    fileName: text('file_name').notNull(),
    fileSha256: char('file_sha256', { length: 64 }).notNull(),
    cycleId: uuid('cycle_id'),
    status: text().default('UPLOADED').notNull(),
    previewOnly: boolean('preview_only').default(true).notNull(),
    forceReprocess: boolean('force_reprocess').default(false).notNull(),
    totalRows: integer('total_rows').default(0).notNull(),
    processedRows: integer('processed_rows').default(0).notNull(),
    succeededRows: integer('succeeded_rows').default(0).notNull(),
    failedRows: integer('failed_rows').default(0).notNull(),
    metrics: jsonb(),
    options: jsonb(),
    resultDocumentId: uuid('result_document_id'),
    uploadedBy: uuid('uploaded_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_import_file')
      .using(
        'btree',
        sql`organization_id`,
        sql`kind`,
        sql`COALESCE(cycle_id, '00000000-0000-0000-0000-000000000000'::uuid)`,
        sql`file_sha256`,
      )
      .where(
        sql`((NOT force_reprocess) AND (status <> ALL (ARRAY['DISCARDED'::text, 'FAILED'::text, 'VALIDATION_FAILED'::text])))`,
      ),
    foreignKey({
      columns: [table.cycleId],
      foreignColumns: [paymentCycleInRecon.id],
      name: 'import_batch_cycle_id_fkey',
    }),
    foreignKey({
      columns: [table.fileDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'import_batch_file_document_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'import_batch_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.resultDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'import_batch_result_document_id_fkey',
    }),
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'import_batch_uploaded_by_fkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_import_counts',
      sql`((succeeded_rows + failed_rows) <= processed_rows) AND (processed_rows <= total_rows)`,
    ),
    check(
      'ck_import_kind',
      sql`kind = ANY (ARRAY['PRODUCT_MAPPING'::text, 'VENDOR_PRODUCT'::text, 'MPP_MASTER'::text, 'SAP_PO'::text, 'SAP_SALES'::text, 'RECON_SHEET'::text, 'OPENING_STOCK'::text, 'INDENT_BULK'::text, 'STOCK_SALE'::text, 'STOCK_FILLED'::text, 'STOCK_CORRECTED'::text, 'SAP_ORDER_DEMAND'::text, 'LEGACY_MIGRATION'::text])`,
    ),
    check(
      'ck_import_status',
      sql`status = ANY (ARRAY['UPLOADED'::text, 'VALIDATING'::text, 'VALIDATION_FAILED'::text, 'PREVIEW_READY'::text, 'PROCESSING'::text, 'PROCESSED'::text, 'PROCESSED_WITH_EXCEPTIONS'::text, 'PARTIAL'::text, 'FAILED'::text, 'DISCARDED'::text, 'PUBLISHED'::text, 'SUPERSEDED'::text])`,
    ),
  ],
);

export const stockStatementInReporting = reporting.table(
  'stock_statement',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    cycleId: uuid('cycle_id').notNull(),
    status: text().default('OPEN').notNull(),
    isManualOverride: boolean('is_manual_override').default(false).notNull(),
    overrideUploadedAt: timestamp('override_uploaded_at', { withTimezone: true, mode: 'string' }),
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'string' }),
    generatedBy: uuid('generated_by'),
    saleUploadedAt: timestamp('sale_uploaded_at', { withTimezone: true, mode: 'string' }),
    saleDocumentId: uuid('sale_document_id'),
    saleFileName: text('sale_file_name'),
    saleRowsTotal: integer('sale_rows_total').default(0).notNull(),
    saleRowsMatched: integer('sale_rows_matched').default(0).notNull(),
    saleRowsUnmatched: integer('sale_rows_unmatched').default(0).notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true, mode: 'string' }),
    finalizedBy: uuid('finalized_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.cycleId],
      foreignColumns: [paymentCycleInRecon.id],
      name: 'stock_statement_cycle_id_fkey',
    }),
    foreignKey({
      columns: [table.finalizedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'stock_statement_finalized_by_fkey',
    }),
    foreignKey({
      columns: [table.generatedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'stock_statement_generated_by_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'stock_statement_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.saleDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'stock_statement_sale_document_id_fkey',
    }),
    unique('uq_stock_statement_cycle').on(table.cycleId),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_stock_statement_final',
      sql`(status <> 'FINALIZED'::text) OR (finalized_at IS NOT NULL)`,
    ),
    check(
      'ck_stock_statement_rows',
      sql`(sale_rows_matched + sale_rows_unmatched) = sale_rows_total`,
    ),
    check('ck_stock_statement_status', sql`status = ANY (ARRAY['OPEN'::text, 'FINALIZED'::text])`),
  ],
);

export const otherSaleInMpp = mpp.table(
  'other_sale',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    saleNumber: text('sale_number').notNull(),
    locationId: uuid('location_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    partyName: text('party_name').notNull(),
    partyAddress: text('party_address'),
    partyGstin: text('party_gstin'),
    invoiceDocumentId: uuid('invoice_document_id'),
    status: text().default('ISSUED').notNull(),
    clientRef: uuid('client_ref').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'other_sale_created_by_fkey',
    }),
    foreignKey({
      columns: [table.invoiceDocumentId],
      foreignColumns: [documentInDocs.id],
      name: 'other_sale_invoice_document_id_fkey',
    }),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'other_sale_location_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'other_sale_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouseInOrg.id],
      name: 'other_sale_warehouse_id_fkey',
    }),
    unique('uq_other_sale_number').on(table.organizationId, table.saleNumber),
    unique('uq_other_sale_invoice').on(table.organizationId, table.invoiceNumber),
    unique('uq_other_sale_client').on(table.organizationId, table.clientRef, table.createdBy),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_other_sale_status', sql`status = ANY (ARRAY['ISSUED'::text, 'CANCELLED'::text])`),
  ],
);

export const userLocationInIdentity = identity.table(
  'user_location',
  {
    userId: uuid('user_id').notNull(),
    locationId: uuid('location_id').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'user_location_location_id_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'user_location_user_id_fkey',
    }).onDelete('cascade'),
    primaryKey({ columns: [table.userId, table.locationId], name: 'user_location_pkey' }),
  ],
);

export const rolePermissionInIdentity = identity.table(
  'role_permission',
  {
    roleId: uuid('role_id').notNull(),
    permissionCode: text('permission_code').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.permissionCode],
      foreignColumns: [permissionInIdentity.code],
      name: 'role_permission_permission_code_fkey',
    }),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roleInIdentity.id],
      name: 'role_permission_role_id_fkey',
    }).onDelete('cascade'),
    primaryKey({ columns: [table.roleId, table.permissionCode], name: 'role_permission_pkey' }),
  ],
);

export const regionMemberInOrg = org.table(
  'region_member',
  {
    regionId: uuid('region_id').notNull(),
    locationId: uuid('location_id').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'region_member_location_id_fkey',
    }),
    foreignKey({
      columns: [table.regionId],
      foreignColumns: [regionInOrg.id],
      name: 'region_member_region_id_fkey',
    }),
    primaryKey({ columns: [table.regionId, table.locationId], name: 'region_member_pkey' }),
  ],
);

export const poLineAllocationInProcurement = procurement.table(
  'po_line_allocation',
  {
    poLineId: uuid('po_line_id').notNull(),
    indentLineId: uuid('indent_line_id').notNull(),
    qtyBase: numeric('qty_base', { precision: 18, scale: 3 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_alloc_indent_line').using(
      'btree',
      table.indentLineId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.indentLineId],
      foreignColumns: [indentLineInIndent.id],
      name: 'po_line_allocation_indent_line_id_fkey',
    }),
    foreignKey({
      columns: [table.poLineId],
      foreignColumns: [purchaseOrderLineInProcurement.id],
      name: 'po_line_allocation_po_line_id_fkey',
    }),
    primaryKey({ columns: [table.poLineId, table.indentLineId], name: 'po_line_allocation_pkey' }),
    check('ck_alloc_qty', sql`qty_base > (0)::numeric`),
  ],
);

export const grnLineSerialInReceiving = receiving.table(
  'grn_line_serial',
  {
    grnLineId: uuid('grn_line_id').notNull(),
    productId: uuid('product_id').notNull(),
    serialNo: text('serial_no').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex('uq_serial_per_product').using(
      'btree',
      table.productId.asc().nullsLast().op('text_ops'),
      table.serialNo.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.grnLineId],
      foreignColumns: [grnLineInReceiving.id],
      name: 'grn_line_serial_grn_line_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'grn_line_serial_product_id_fkey',
    }),
    primaryKey({ columns: [table.grnLineId, table.serialNo], name: 'grn_line_serial_pkey' }),
  ],
);

export const processedEventInEvents = events.table(
  'processed_event',
  {
    consumer: text().notNull(),
    eventId: uuid('event_id').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ columns: [table.consumer, table.eventId], name: 'processed_event_pkey' }),
  ],
);

export const saleProductAliasInReporting = reporting.table(
  'sale_product_alias',
  {
    organizationId: uuid('organization_id').notNull(),
    alias: text().notNull(),
    productId: uuid('product_id').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'sale_product_alias_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'sale_product_alias_product_id_fkey',
    }),
    primaryKey({ columns: [table.organizationId, table.alias], name: 'sale_product_alias_pkey' }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const notificationPreferenceInNotify = notify.table(
  'notification_preference',
  {
    userId: uuid('user_id').notNull(),
    category: text().notNull(),
    channel: text().notNull(),
    enabled: boolean().notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUserInIdentity.id],
      name: 'notification_preference_user_id_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.userId, table.category, table.channel],
      name: 'notification_preference_pkey',
    }),
  ],
);

export const consumerPositionInEvents = events.table(
  'consumer_position',
  {
    consumer: text().notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    lastVersion: integer('last_version').notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({
      columns: [table.consumer, table.aggregateType, table.aggregateId],
      name: 'consumer_position_pkey',
    }),
  ],
);

export const documentLinkInDocs = docs.table(
  'document_link',
  {
    documentId: uuid('document_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    role: text().default('ATTACHMENT').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_document_link_entity').using(
      'btree',
      table.entityType.asc().nullsLast().op('text_ops'),
      table.entityId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [documentInDocs.id],
      name: 'document_link_document_id_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.documentId, table.entityType, table.entityId, table.role],
      name: 'document_link_pkey',
    }),
  ],
);

export const physicalCountInInventory = inventory.table(
  'physical_count',
  {
    organizationId: uuid('organization_id').notNull(),
    locationId: uuid('location_id').notNull(),
    productId: uuid('product_id').notNull(),
    physicalQty: integer('physical_qty'),
    countedBy: uuid('counted_by'),
    countedAt: timestamp('counted_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.countedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'physical_count_counted_by_fkey',
    }),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'physical_count_location_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'physical_count_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'physical_count_product_id_fkey',
    }),
    primaryKey({ columns: [table.locationId, table.productId], name: 'physical_count_pkey' }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_physical_nonneg', sql`(physical_qty IS NULL) OR (physical_qty >= 0)`),
  ],
);

export const vendorProductInCatalog = catalog.table(
  'vendor_product',
  {
    vendorId: uuid('vendor_id').notNull(),
    productId: uuid('product_id').notNull(),
    priority: integer().default(1).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    lastPrice: numeric('last_price', { precision: 18, scale: 4 }),
    leadTimeDays: integer('lead_time_days'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_vendor_product_product').using(
      'btree',
      table.productId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'vendor_product_product_id_fkey',
    }),
    foreignKey({
      columns: [table.vendorId],
      foreignColumns: [vendorInCatalog.id],
      name: 'vendor_product_vendor_id_fkey',
    }),
    primaryKey({ columns: [table.vendorId, table.productId], name: 'vendor_product_pkey' }),
  ],
);

export const stockCountLineInInventory = inventory.table(
  'stock_count_line',
  {
    countId: uuid('count_id').notNull(),
    productId: uuid('product_id').notNull(),
    batchKey: uuid('batch_key')
      .default(sql`'00000000-0000-0000-0000-000000000000'`)
      .notNull(),
    bookQty: numeric('book_qty', { precision: 18, scale: 3 }).notNull(),
    countedQty: numeric('counted_qty', { precision: 18, scale: 3 }),
    countedBy: uuid('counted_by'),
    countedAt: timestamp('counted_at', { withTimezone: true, mode: 'string' }),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.countId],
      foreignColumns: [stockCountInInventory.id],
      name: 'stock_count_line_count_id_fkey',
    }),
    foreignKey({
      columns: [table.countedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'stock_count_line_counted_by_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'stock_count_line_product_id_fkey',
    }),
    primaryKey({
      columns: [table.countId, table.productId, table.batchKey],
      name: 'stock_count_line_pkey',
    }),
    check('ck_count_nonneg', sql`(counted_qty IS NULL) OR (counted_qty >= (0)::numeric)`),
  ],
);

export const statementLocationStateInReporting = reporting.table(
  'statement_location_state',
  {
    statementId: uuid('statement_id').notNull(),
    locationId: uuid('location_id').notNull(),
    transporterOpen: boolean('transporter_open').default(false).notNull(),
    damageOpen: boolean('damage_open').default(false).notNull(),
    expireOpen: boolean('expire_open').default(false).notNull(),
    updatedBy: uuid('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'statement_location_state_location_id_fkey',
    }),
    foreignKey({
      columns: [table.statementId],
      foreignColumns: [stockStatementInReporting.id],
      name: 'statement_location_state_statement_id_fkey',
    }),
    foreignKey({
      columns: [table.updatedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'statement_location_state_updated_by_fkey',
    }),
    primaryKey({
      columns: [table.statementId, table.locationId],
      name: 'statement_location_state_pkey',
    }),
  ],
);

export const featureFlagInConfig = config.table(
  'feature_flag',
  {
    organizationId: uuid('organization_id').notNull(),
    key: text().notNull(),
    enabled: boolean().default(false).notNull(),
    rules: jsonb(),
    description: text(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedBy: uuid('updated_by'),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'feature_flag_organization_id_fkey',
    }),
    primaryKey({ columns: [table.organizationId, table.key], name: 'feature_flag_pkey' }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const reportProductInReporting = reporting.table(
  'report_product',
  {
    organizationId: uuid('organization_id').notNull(),
    productId: uuid('product_id').notNull(),
    displayName: text('display_name'),
    position: integer().notNull(),
    isBase: boolean('is_base').default(false).notNull(),
    scopeLocationIds: uuid('scope_location_ids').array().default(['']).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'report_product_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'report_product_product_id_fkey',
    }),
    primaryKey({ columns: [table.organizationId, table.productId], name: 'report_product_pkey' }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_report_product_position', sql`"position" >= 0`),
  ],
);

export const locationNotificationInRecon = recon.table(
  'location_notification',
  {
    sheetId: uuid('sheet_id').notNull(),
    locationId: uuid('location_id').notNull(),
    status: text().default('PENDING').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
    viewedAt: timestamp('viewed_at', { withTimezone: true, mode: 'string' }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true, mode: 'string' }),
    acknowledgedBy: uuid('acknowledged_by'),
    comment: text(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.acknowledgedBy],
      foreignColumns: [appUserInIdentity.id],
      name: 'location_notification_acknowledged_by_fkey',
    }),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'location_notification_location_id_fkey',
    }),
    foreignKey({
      columns: [table.sheetId],
      foreignColumns: [reconciliationSheetInRecon.id],
      name: 'location_notification_sheet_id_fkey',
    }),
    primaryKey({ columns: [table.sheetId, table.locationId], name: 'location_notification_pkey' }),
    check(
      'ck_loc_notif_status',
      sql`status = ANY (ARRAY['PENDING'::text, 'SENT'::text, 'VIEWED'::text, 'ACKNOWLEDGED'::text])`,
    ),
  ],
);

export const settingInConfig = config.table(
  'setting',
  {
    organizationId: uuid('organization_id').notNull(),
    key: text().notNull(),
    scopeType: text('scope_type').default('ORGANIZATION').notNull(),
    scopeId: uuid('scope_id')
      .default(sql`'00000000-0000-0000-0000-000000000000'`)
      .notNull(),
    value: jsonb().notNull(),
    valueSchema: jsonb('value_schema'),
    description: text(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedBy: uuid('updated_by'),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'setting_organization_id_fkey',
    }),
    primaryKey({
      columns: [table.organizationId, table.key, table.scopeType, table.scopeId],
      name: 'setting_pkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_setting_scope',
      sql`scope_type = ANY (ARRAY['ORGANIZATION'::text, 'LOCATION'::text])`,
    ),
  ],
);

export const cycleProductSummaryInRecon = recon.table(
  'cycle_product_summary',
  {
    cycleId: uuid('cycle_id').notNull(),
    productId: uuid('product_id').notNull(),
    totalAdvance: numeric('total_advance', { precision: 18, scale: 3 }).default('0').notNull(),
    totalSap: numeric('total_sap', { precision: 18, scale: 3 }).default('0').notNull(),
    totalToSend: numeric('total_to_send', { precision: 18, scale: 3 }).default('0').notNull(),
    totalToDeduct: numeric('total_to_deduct', { precision: 18, scale: 3 }).default('0').notNull(),
    mppCount: integer('mpp_count').default(0).notNull(),
    reconciledCount: integer('reconciled_count').default(0).notNull(),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.cycleId],
      foreignColumns: [paymentCycleInRecon.id],
      name: 'cycle_product_summary_cycle_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'cycle_product_summary_product_id_fkey',
    }),
    primaryKey({ columns: [table.cycleId, table.productId], name: 'cycle_product_summary_pkey' }),
  ],
);

export const saleEntryInRecon = recon.table(
  'sale_entry',
  {
    organizationId: uuid('organization_id').notNull(),
    cycleId: uuid('cycle_id').notNull(),
    locationId: uuid('location_id').notNull(),
    mppId: uuid('mpp_id').notNull(),
    productId: uuid('product_id').notNull(),
    advanceQty: numeric('advance_qty', { precision: 18, scale: 3 }).default('0').notNull(),
    sapQty: numeric('sap_qty', { precision: 18, scale: 3 }).default('0').notNull(),
    status: text().generatedAlwaysAs(sql`
CASE
    WHEN (sap_qty = advance_qty) THEN 'OK'::text
    WHEN (sap_qty > advance_qty) THEN 'OVER_SOLD'::text
    WHEN (sap_qty > (0)::numeric) THEN 'UNDER_SOLD'::text
    ELSE 'NOT_SOLD'::text
END`),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.cycleId],
      foreignColumns: [paymentCycleInRecon.id],
      name: 'sale_entry_cycle_id_fkey',
    }),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locationInOrg.id],
      name: 'sale_entry_location_id_fkey',
    }),
    foreignKey({
      columns: [table.mppId],
      foreignColumns: [mppInCatalog.id],
      name: 'sale_entry_mpp_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'sale_entry_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'sale_entry_product_id_fkey',
    }),
    primaryKey({
      columns: [table.cycleId, table.locationId, table.mppId, table.productId],
      name: 'sale_entry_pkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_sale_entry_nonneg', sql`(advance_qty >= (0)::numeric) AND (sap_qty >= (0)::numeric)`),
  ],
);

export const mppProductLedgerInRecon = recon.table(
  'mpp_product_ledger',
  {
    organizationId: uuid('organization_id').notNull(),
    mppId: uuid('mpp_id').notNull(),
    productId: uuid('product_id').notNull(),
    cycleId: uuid('cycle_id').notNull(),
    openingBalance: numeric('opening_balance', { precision: 18, scale: 3 }).default('0').notNull(),
    advanceQty: numeric('advance_qty', { precision: 18, scale: 3 }).default('0').notNull(),
    sapQty: numeric('sap_qty', { precision: 18, scale: 3 }).default('0').notNull(),
    closingBalance: numeric('closing_balance', { precision: 18, scale: 3 }).generatedAlwaysAs(
      sql`((opening_balance + advance_qty) - sap_qty)`,
    ),
    sourceRecordId: uuid('source_record_id'),
    computedAt: timestamp('computed_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_ledger_cycle').using('btree', table.cycleId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.cycleId],
      foreignColumns: [paymentCycleInRecon.id],
      name: 'mpp_product_ledger_cycle_id_fkey',
    }),
    foreignKey({
      columns: [table.mppId],
      foreignColumns: [mppInCatalog.id],
      name: 'mpp_product_ledger_mpp_id_fkey',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'mpp_product_ledger_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'mpp_product_ledger_product_id_fkey',
    }),
    foreignKey({
      columns: [table.sourceRecordId],
      foreignColumns: [reconciliationRecordInRecon.id],
      name: 'mpp_product_ledger_source_record_id_fkey',
    }),
    primaryKey({
      columns: [table.mppId, table.productId, table.cycleId],
      name: 'mpp_product_ledger_pkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const idempotencyRecordInIo = io.table(
  'idempotency_record',
  {
    organizationId: uuid('organization_id').notNull(),
    userId: uuid('user_id').notNull(),
    idemKey: uuid('idem_key').notNull(),
    operation: text().notNull(),
    requestHash: bytea('request_hash').notNull(),
    status: text().default('IN_PROGRESS').notNull(),
    response: jsonb(),
    httpStatus: integer('http_status'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' })
      .default(sql`(now() + '24:00:00'::interval)`)
      .notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_idem_expiry').using('btree', table.expiresAt.asc().nullsLast().op('timestamptz_ops')),
    primaryKey({
      columns: [table.organizationId, table.userId, table.idemKey],
      name: 'idempotency_record_pkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'ck_idem_status',
      sql`status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text, 'FAILED'::text])`,
    ),
  ],
);

export const stockBalanceInInventory = inventory.table(
  'stock_balance',
  {
    organizationId: uuid('organization_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    productId: uuid('product_id').notNull(),
    batchKey: uuid('batch_key')
      .default(sql`'00000000-0000-0000-0000-000000000000'`)
      .notNull(),
    qtyOnHand: numeric('qty_on_hand', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyReserved: numeric('qty_reserved', { precision: 18, scale: 3 }).default('0').notNull(),
    qtyAvailable: numeric('qty_available', { precision: 18, scale: 3 }).generatedAlwaysAs(
      sql`(qty_on_hand - qty_reserved)`,
    ),
    avgUnitCost: numeric('avg_unit_cost', { precision: 18, scale: 4 }),
    lastTxnId: uuid('last_txn_id'),
    lastTxnAt: timestamp('last_txn_at', { withTimezone: true, mode: 'string' }),
    version: integer().default(1).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    index('ix_balance_product').using('btree', table.productId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizationInOrg.id],
      name: 'stock_balance_organization_id_fkey',
    }),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [productInCatalog.id],
      name: 'stock_balance_product_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouseInOrg.id],
      name: 'stock_balance_warehouse_id_fkey',
    }),
    primaryKey({
      columns: [table.warehouseId, table.productId, table.batchKey],
      name: 'stock_balance_pkey',
    }),
    pgPolicy('p_org_isolation', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
      withCheck: sql`(organization_id = (NULLIF(current_setting('app.org_id'::text, true), ''::text))::uuid)`,
    }),
    check('ck_balance_nonneg', sql`qty_on_hand >= (0)::numeric`),
    check(
      'ck_balance_reserved',
      sql`(qty_reserved >= (0)::numeric) AND (qty_reserved <= qty_on_hand)`,
    ),
  ],
);
