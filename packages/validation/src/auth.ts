import { z } from 'zod';

/**
 * Sign-in form (REST POST /api/v1/auth/login). Only shape is checked here: password strength is
 * enforced when a password is set, never at login, so existing users are never locked out by a
 * rule change.
 */
export const loginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'validation.required')
    .max(254, 'validation.tooLong')
    .pipe(z.email({ message: 'validation.email' })),
  password: z.string().min(1, 'validation.required').max(256, 'validation.tooLong'),
});

export type LoginInput = z.input<typeof loginInputSchema>;
