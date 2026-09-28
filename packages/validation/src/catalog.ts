import { z } from 'zod';
import { email, masterCode, mobile, optionalId, required } from './admin.js';
import { decimal, id, money, text } from './primitives.js';

/*
 * Catalogue master inputs (SRS §11.3, MST-001…009). Shared by the API and the admin console.
 * Messages are i18n keys.
 */

const optionalText = (max: number) => text(max).optional().nullable();

/** Product codes are longer than organisation codes and may carry dots and slashes (legacy SAP). */
export const productCode = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'validation.required')
  .max(40, 'validation.tooLong')
  .regex(/^[A-Z0-9][A-Z0-9._/-]{0,39}$/, 'validation.code');

/** 15-character GSTIN: state code, PAN, entity number, Z, check character. */
const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => (v === '' ? undefined : v))
  .refine(
    (v) => v === undefined || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v),
    'validation.gstin',
  );

const pan = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => (v === '' ? undefined : v))
  .refine((v) => v === undefined || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), 'validation.pan');

const expectedVersion = z.number().int().min(1).optional().nullable();

export const saveUomInputSchema = z.object({
  id: optionalId,
  code: masterCode,
  name: required(60),
  nameHi: optionalText(60),
  decimalsAllowed: z.number().int().min(0, 'validation.outOfRange').max(3, 'validation.outOfRange'),
});

export const saveUomConversionInputSchema = z
  .object({
    fromUomId: id,
    toUomId: id,
    productId: optionalId,
    factor: decimal({ scale: 6, min: 'positive' }),
  })
  .refine((c) => c.fromUomId !== c.toUomId, {
    path: ['toUomId'],
    message: 'validation.sameUom',
  });

export const saveProductCategoryInputSchema = z.object({
  id: optionalId,
  code: masterCode,
  name: required(120),
  parentId: optionalId,
  ownerUserId: optionalId,
  requiresInspection: z.boolean().default(false),
});

export const saveExternalSystemInputSchema = z.object({
  id: optionalId,
  code: masterCode,
  name: required(60),
  displayPriority: z
    .number()
    .int()
    .min(0, 'validation.outOfRange')
    .max(1000, 'validation.outOfRange'),
});

export const externalProductCodeSchema = z.object({
  system: masterCode,
  code: optionalText(40),
  name: required(200),
  isPrimary: z.boolean().default(true),
});

export const saveProductInputSchema = z
  .object({
    id: optionalId,
    expectedVersion,
    code: productCode,
    name: required(200),
    nameHi: optionalText(200),
    sizeLabel: optionalText(60),
    baseUomId: id,
    categoryId: optionalId,
    materialType: optionalText(60),
    hsnCode: z
      .string()
      .trim()
      .transform((v) => (v === '' ? undefined : v))
      .refine((v) => v === undefined || /^[0-9]{4,8}$/.test(v), 'validation.hsn')
      .optional()
      .nullable(),
    standardPrice: money.optional().nullable(),
    isStockItem: z.boolean(),
    isService: z.boolean(),
    batchTracked: z.boolean().default(false),
    serialTracked: z.boolean().default(false),
    reorderLevel: decimal({ scale: 3, min: 'nonNegative' }).optional().nullable(),
    ownerUserId: optionalId,
    externalCodes: z.array(externalProductCodeSchema).max(50).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  })
  .superRefine((p, ctx) => {
    // A service is never stocked (MST-001: `is_service` is explicit, not guessed from the name).
    if (p.isService && p.isStockItem) {
      ctx.addIssue({
        code: 'custom',
        path: ['isStockItem'],
        message: 'validation.serviceNotStock',
      });
    }
    const primaries = new Set<string>();
    const codes = new Set<string>();
    p.externalCodes?.forEach((c, i) => {
      if (c.isPrimary) {
        if (primaries.has(c.system)) {
          ctx.addIssue({
            code: 'custom',
            path: ['externalCodes', i, 'isPrimary'],
            message: 'validation.onePrimaryPerSystem',
          });
        }
        primaries.add(c.system);
      }
      if (c.code) {
        const key = `${c.system}\u0000${c.code}`;
        if (codes.has(key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['externalCodes', i, 'code'],
            message: 'validation.duplicate',
          });
        }
        codes.add(key);
      }
    });
  });

export const vendorContactPurposes = ['PO', 'ACCOUNTS', 'DISPATCH'] as const;

export const vendorContactSchema = z
  .object({
    id: optionalId,
    name: optionalText(120),
    email: email
      .optional()
      .nullable()
      .or(z.literal('').transform(() => undefined)),
    phone: mobile.optional().nullable(),
    purposes: z.array(z.enum(vendorContactPurposes)).min(1, 'validation.required'),
  })
  .refine((c) => Boolean(c.email) || Boolean(c.phone), {
    path: ['email'],
    message: 'validation.contactChannel',
  });

export const saveVendorInputSchema = z
  .object({
    id: optionalId,
    expectedVersion,
    code: masterCode
      .optional()
      .nullable()
      .or(z.literal('').transform(() => undefined)),
    name: required(200),
    legalName: optionalText(200),
    gstin: gstin.optional().nullable(),
    pan: pan.optional().nullable(),
    sapVendorCode: optionalText(20),
    paymentTermsDays: z
      .number()
      .int()
      .min(0, 'validation.outOfRange')
      .max(365, 'validation.outOfRange')
      .optional()
      .nullable(),
    address: optionalText(500),
    contacts: z.array(vendorContactSchema).max(20),
    status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).default('ACTIVE'),
  })
  .refine((v) => !v.gstin || !v.pan || v.gstin.slice(2, 12) === v.pan, {
    path: ['pan'],
    message: 'validation.panGstinMismatch',
  });

export const setVendorProductsInputSchema = z
  .object({
    vendorId: id,
    items: z
      .array(
        z.object({
          productId: id,
          priority: z
            .number()
            .int()
            .min(1, 'validation.outOfRange')
            .max(99, 'validation.outOfRange')
            .default(1),
          isPrimary: z.boolean().default(false),
          leadTimeDays: z
            .number()
            .int()
            .min(0, 'validation.outOfRange')
            .max(365, 'validation.outOfRange')
            .optional()
            .nullable(),
        }),
      )
      .max(2000),
  })
  .superRefine((input, ctx) => {
    const seen = new Set<string>();
    input.items.forEach((item, i) => {
      if (seen.has(item.productId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'productId'],
          message: 'validation.duplicate',
        });
      }
      seen.add(item.productId);
    });
  });

export const saveMppInputSchema = z.object({
  id: optionalId,
  expectedVersion,
  code: masterCode,
  name: required(120),
  bmcLocationId: id,
  sahayakName: optionalText(120),
  sahayakMobile: mobile.optional().nullable(),
  cycleBand: z.enum(['DAYS_1_10', 'DAYS_11_20', 'DAYS_21_31']).optional().nullable(),
  village: optionalText(120),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export type SaveUomFormInput = z.input<typeof saveUomInputSchema>;
export type SaveUomConversionFormInput = z.input<typeof saveUomConversionInputSchema>;
export type SaveProductCategoryFormInput = z.input<typeof saveProductCategoryInputSchema>;
export type SaveExternalSystemFormInput = z.input<typeof saveExternalSystemInputSchema>;
export type SaveProductFormInput = z.input<typeof saveProductInputSchema>;
export type SaveVendorFormInput = z.input<typeof saveVendorInputSchema>;
export type SaveMppFormInput = z.input<typeof saveMppInputSchema>;
