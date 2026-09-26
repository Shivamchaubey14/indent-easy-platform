import { z } from 'zod';

/** Password length limits (SRS AUTH-003, NIST SP 800-63B). Counted in characters, not bytes. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const characters = (value: string) => [...value].length;

/**
 * Sign-in form (REST POST /api/v1/auth/login). Only shape is checked here: password strength is
 * enforced when a password is set, never at login, so existing users are never locked out by a
 * rule change.
 */
export const loginInputSchema = z.object({
  /** E-mail address or employee code. */
  identifier: z.string().trim().min(1, 'validation.required').max(254, 'validation.tooLong'),
  password: z.string().min(1, 'validation.required').max(256, 'validation.tooLong'),
  deviceName: z.string().trim().max(100, 'validation.tooLong').optional(),
});

export type LoginInput = z.input<typeof loginInputSchema>;

/**
 * A password being set (reset, change, first sign-in). Length only: no composition rules and no
 * forced rotation (AUTH-003). Breached-password and personal-information checks need the server.
 */
export const newPasswordSchema = z
  .string()
  .refine((v) => characters(v) >= PASSWORD_MIN_LENGTH, 'validation.passwordTooShort')
  .refine((v) => characters(v) <= PASSWORD_MAX_LENGTH, 'validation.passwordTooLong');

export const forgotPasswordInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'validation.required')
    .max(254, 'validation.tooLong')
    .pipe(z.email({ message: 'validation.email' })),
});

export const resetPasswordInputSchema = z.object({
  token: z.string().min(1, 'validation.required').max(200, 'validation.tooLong'),
  newPassword: newPasswordSchema,
});

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, 'validation.required').max(256, 'validation.tooLong'),
  newPassword: newPasswordSchema,
  revokeOtherSessions: z.boolean().default(true),
});

export type ForgotPasswordInput = z.input<typeof forgotPasswordInputSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordInputSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordInputSchema>;
