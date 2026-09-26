import { z } from 'zod';
import { id, text } from './primitives.js';

/*
 * Administration inputs (SRS §11.2, USR-001…005). Shared by the API and the admin console, so a
 * form shows the same messages the server would return. Messages are i18n keys.
 */

const required = (max: number) =>
  z.string().trim().min(1, 'validation.required').max(max, 'validation.tooLong');

/** Upper-case codes such as BMC-01 or STORE_USER; typed in any case, stored upper-case. */
const code = (pattern: RegExp) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'validation.required')
    .max(40, 'validation.tooLong')
    .regex(pattern, 'validation.code');

export const locationCode = code(/^[A-Z0-9][A-Z0-9_-]{0,19}$/);
export const masterCode = code(/^[A-Z0-9][A-Z0-9_-]{0,19}$/);
export const roleCode = code(/^[A-Z][A-Z0-9_]{1,39}$/);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'validation.required')
  .max(254, 'validation.tooLong')
  .pipe(z.email({ message: 'validation.email' }));

/** Indian or international mobile in E.164 (+919876543210); blank means none. */
const mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => v === '' || /^\+[1-9][0-9]{7,14}$/.test(v), 'validation.mobile')
  .transform((v) => (v === '' ? undefined : v));

const optionalId = z
  .string()
  .trim()
  .max(128)
  .transform((v) => (v === '' ? undefined : v))
  .optional()
  .nullable();

const isoDate = z.iso.date({ message: 'validation.date' }).optional().nullable();

export const roleAssignmentSchema = z
  .object({
    roleId: id,
    scopeLocationIds: z.array(id).max(500).optional(),
    scopeDepartmentIds: z.array(id).max(100).optional(),
    scopeCategoryIds: z.array(id).max(200).optional(),
    validFrom: isoDate,
    validTo: isoDate,
  })
  .refine((a) => !a.validFrom || !a.validTo || a.validTo >= a.validFrom, {
    path: ['validTo'],
    message: 'validation.dateOrder',
  });

const userProfile = {
  displayName: required(120),
  mobile: mobile.optional(),
  employeeCode: text(32).optional(),
  designationId: optionalId,
  departmentId: optionalId,
  additionalLocationIds: z.array(id).max(100).optional(),
  deliveryPointCode: text(32).optional(),
  preferredLocale: z.enum(['EN', 'HI']).optional(),
  reportsToId: optionalId,
};

export const createUserInputSchema = z.object({
  email,
  ...userProfile,
  primaryLocationId: id,
  roles: z.array(roleAssignmentSchema).max(20),
  sendInvite: z.boolean().default(true),
});

export const updateUserInputSchema = z.object({
  id,
  expectedVersion: z.number().int().min(1),
  ...userProfile,
  displayName: required(120).optional(),
  primaryLocationId: id.optional(),
  status: z.enum(['ACTIVE', 'LOCKED', 'DISABLED', 'INVITED']).optional(),
});

export const setUserRolesInputSchema = z.object({
  userId: id,
  expectedVersion: z.number().int().min(1),
  roles: z.array(roleAssignmentSchema).max(20),
});

export const saveRoleInputSchema = z.object({
  id: optionalId,
  code: roleCode,
  name: required(80),
  description: text(300).optional().nullable(),
  permissions: z.array(z.string().regex(/^[a-z_]+:[a-z_]+$/)).max(200),
});

export const saveLocationInputSchema = z.object({
  id: optionalId,
  code: locationCode,
  name: required(120),
  nameHi: text(120).optional().nullable(),
  type: z.enum(['HEAD_OFFICE', 'BMC', 'MCC', 'PLANT', 'WAREHOUSE', 'OTHER']),
  sapPlantCode: text(20).optional().nullable(),
  address: text(500).optional().nullable(),
  excludedFromCrossView: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const saveMasterInputSchema = z.object({
  id: optionalId,
  code: masterCode,
  name: required(120),
});

export type CreateUserFormInput = z.input<typeof createUserInputSchema>;
export type UpdateUserFormInput = z.input<typeof updateUserInputSchema>;
export type SaveRoleFormInput = z.input<typeof saveRoleInputSchema>;
export type SaveLocationFormInput = z.input<typeof saveLocationInputSchema>;
export type SaveMasterFormInput = z.input<typeof saveMasterInputSchema>;
