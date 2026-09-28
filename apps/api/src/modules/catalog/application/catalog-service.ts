import type { UserError } from '@ie/graphql';
import {
  saveExternalSystemInputSchema,
  saveMppInputSchema,
  saveProductCategoryInputSchema,
  saveProductInputSchema,
  saveUomConversionInputSchema,
  saveUomInputSchema,
  saveVendorInputSchema,
  setVendorProductsInputSchema,
  toUserErrors,
} from '@ie/validation';
import { type Grants, authorize } from '../../../shared/authorization/index.js';
import {
  DuplicateValue,
  type PostgresCatalog,
  RecordNotFound,
  RuleViolation,
  UnknownReference,
  VersionConflict,
} from '../infrastructure/postgres-catalog.js';

export type CatalogResult = { ok: true; id: string } | { ok: false; userErrors: UserError[] };

/** Who is acting: their organisation and grants. */
export interface Actor {
  organizationId: string;
  grants: Grants;
}

const failed = (...userErrors: UserError[]): CatalogResult => ({ ok: false, userErrors });
const fieldError = (
  field: string[],
  message: string,
  code: UserError['code'] = 'VALIDATION_FAILED',
): UserError => ({ code, message, field: ['input', ...field], details: null });

/** Runs a store command, turning its known refusals into user errors. */
async function saving(work: () => Promise<string>): Promise<CatalogResult> {
  try {
    return { ok: true, id: await work() };
  } catch (err) {
    if (err instanceof DuplicateValue)
      return failed(fieldError(err.field, err.messageKey, 'CONFLICT'));
    if (err instanceof UnknownReference) {
      return failed(fieldError(err.field, 'validation.notFound', 'NOT_FOUND'));
    }
    if (err instanceof RuleViolation) return failed(fieldError(err.field, err.messageKey));
    if (err instanceof VersionConflict) {
      return failed(
        fieldError(['expectedVersion'], 'validation.versionConflict', 'VERSION_CONFLICT'),
      );
    }
    if (err instanceof RecordNotFound) {
      return failed(fieldError(['id'], 'validation.notFound', 'NOT_FOUND'));
    }
    throw err;
  }
}

/**
 * Catalogue masters (SRS §11.3). The contract's `@auth` checks the base permission of each
 * mutation; this adds the finer ones: creating needs `:create`, retiring needs `:deactivate`,
 * external codes need `product:map_external`, and MPPs are managed per BMC scope.
 */
export class CatalogService {
  constructor(private readonly store: PostgresCatalog) {}

  saveUom(actor: Actor, raw: unknown): Promise<CatalogResult> {
    const parsed = saveUomInputSchema.safeParse(raw);
    if (!parsed.success) return Promise.resolve(failed(...toUserErrors(parsed.error)));
    const input = parsed.data;
    return saving(() =>
      this.store.saveUom(actor.organizationId, input.id ?? null, {
        code: input.code,
        name: input.name,
        nameHi: input.nameHi ?? null,
        decimalsAllowed: input.decimalsAllowed,
      }),
    );
  }

  saveConversion(actor: Actor, raw: unknown): Promise<CatalogResult> {
    const parsed = saveUomConversionInputSchema.safeParse(raw);
    if (!parsed.success) return Promise.resolve(failed(...toUserErrors(parsed.error)));
    const input = parsed.data;
    return saving(() =>
      this.store.saveConversion(actor.organizationId, {
        fromUomId: input.fromUomId,
        toUomId: input.toUomId,
        productId: input.productId ?? null,
        factor: input.factor,
      }),
    );
  }

  async deleteConversion(actor: Actor, id: string): Promise<CatalogResult> {
    return saving(async () => {
      await this.store.deleteConversion(actor.organizationId, id);
      return id;
    });
  }

  saveCategory(actor: Actor, raw: unknown): Promise<CatalogResult> {
    const parsed = saveProductCategoryInputSchema.safeParse(raw);
    if (!parsed.success) return Promise.resolve(failed(...toUserErrors(parsed.error)));
    const input = parsed.data;
    return saving(() =>
      this.store.saveCategory(actor.organizationId, input.id ?? null, {
        code: input.code,
        name: input.name,
        parentId: input.parentId ?? null,
        ownerUserId: input.ownerUserId ?? null,
        requiresInspection: input.requiresInspection,
      }),
    );
  }

  saveExternalSystem(actor: Actor, raw: unknown): Promise<CatalogResult> {
    const parsed = saveExternalSystemInputSchema.safeParse(raw);
    if (!parsed.success) return Promise.resolve(failed(...toUserErrors(parsed.error)));
    const input = parsed.data;
    return saving(() =>
      this.store.saveExternalSystem(actor.organizationId, input.id ?? null, {
        code: input.code,
        name: input.name,
        displayPriority: input.displayPriority,
      }),
    );
  }

  async saveProduct(actor: Actor, raw: unknown): Promise<CatalogResult> {
    const parsed = saveProductInputSchema.safeParse(raw);
    if (!parsed.success) return failed(...toUserErrors(parsed.error));
    const input = parsed.data;
    const org = actor.organizationId;
    if (!input.id) authorize(actor.grants, 'product:create');
    if (input.externalCodes) authorize(actor.grants, 'product:map_external');
    if (input.status === 'INACTIVE') {
      const [current] = input.id ? await this.store.products(org, [input.id]) : [];
      if (!current || current.status !== 'INACTIVE') authorize(actor.grants, 'product:deactivate');
    }
    return saving(() =>
      this.store.saveProduct(org, {
        id: input.id ?? null,
        expectedVersion: input.expectedVersion ?? null,
        fields: {
          code: input.code,
          name: input.name,
          nameHi: input.nameHi ?? null,
          sizeLabel: input.sizeLabel ?? null,
          baseUomId: input.baseUomId,
          categoryId: input.categoryId ?? null,
          materialType: input.materialType ?? null,
          hsnCode: input.hsnCode ?? null,
          standardPrice: input.standardPrice ?? '0',
          isStockItem: input.isStockItem,
          isService: input.isService,
          batchTracked: input.batchTracked,
          serialTracked: input.serialTracked,
          reorderLevel: input.reorderLevel ?? null,
          ownerUserId: input.ownerUserId ?? null,
          status: input.status,
        },
        externalCodes:
          input.externalCodes?.map((c) => ({
            system: c.system,
            code: c.code ?? null,
            name: c.name,
            isPrimary: c.isPrimary,
          })) ?? null,
      }),
    );
  }

  async saveVendor(actor: Actor, raw: unknown): Promise<CatalogResult> {
    const parsed = saveVendorInputSchema.safeParse(raw);
    if (!parsed.success) return failed(...toUserErrors(parsed.error));
    const input = parsed.data;
    const org = actor.organizationId;
    if (!input.id) authorize(actor.grants, 'vendor:create');
    if (input.status !== 'ACTIVE') {
      const [current] = input.id ? await this.store.vendors(org, [input.id]) : [];
      if (!current || current.status !== input.status) authorize(actor.grants, 'vendor:deactivate');
    }
    return saving(() =>
      this.store.saveVendor(org, {
        id: input.id ?? null,
        expectedVersion: input.expectedVersion ?? null,
        fields: {
          code: input.code ?? null,
          name: input.name,
          legalName: input.legalName ?? null,
          gstin: input.gstin ?? null,
          pan: input.pan ?? null,
          sapVendorCode: input.sapVendorCode ?? null,
          paymentTermsDays: input.paymentTermsDays ?? null,
          address: input.address ?? null,
          status: input.status,
        },
        contacts: input.contacts.map((c) => ({
          id: c.id ?? null,
          name: c.name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          purposes: c.purposes,
        })),
      }),
    );
  }

  setVendorProducts(actor: Actor, raw: unknown): Promise<CatalogResult> {
    const parsed = setVendorProductsInputSchema.safeParse(raw);
    if (!parsed.success) return Promise.resolve(failed(...toUserErrors(parsed.error)));
    const input = parsed.data;
    return saving(async () => {
      await this.store.setVendorProducts(
        actor.organizationId,
        input.vendorId,
        input.items.map((i) => ({
          productId: i.productId,
          priority: i.priority,
          isPrimary: i.isPrimary,
          leadTimeDays: i.leadTimeDays ?? null,
        })),
      );
      return input.vendorId;
    });
  }

  saveMpp(actor: Actor, raw: unknown): Promise<CatalogResult> {
    const parsed = saveMppInputSchema.safeParse(raw);
    if (!parsed.success) return Promise.resolve(failed(...toUserErrors(parsed.error)));
    const input = parsed.data;
    const mayManageAt = (locationId: string) =>
      actor.grants.canAccess('mpp:manage', { locationId });
    if (!mayManageAt(input.bmcLocationId)) {
      return Promise.resolve(
        failed(fieldError(['bmcLocationId'], 'validation.notFound', 'NOT_FOUND')),
      );
    }
    return saving(() =>
      this.store.saveMpp(actor.organizationId, {
        id: input.id ?? null,
        expectedVersion: input.expectedVersion ?? null,
        mayManageAt,
        fields: {
          code: input.code,
          name: input.name,
          bmcLocationId: input.bmcLocationId,
          sahayakName: input.sahayakName ?? null,
          sahayakMobile: input.sahayakMobile ?? null,
          cycleBand: input.cycleBand ?? null,
          village: input.village ?? null,
          status: input.status,
        },
      }),
    );
  }
}
