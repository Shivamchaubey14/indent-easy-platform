import { describe, expect, it } from 'vitest';
import {
  changePasswordInputSchema,
  forgotPasswordInputSchema,
  loginInputSchema,
  newPasswordSchema,
} from './auth.js';

describe('login input', () => {
  it('accepts an e-mail address or an employee code, trimmed', () => {
    expect(loginInputSchema.parse({ identifier: '  store@shwetdhara.in ', password: 'x' })).toEqual(
      {
        identifier: 'store@shwetdhara.in',
        password: 'x',
      },
    );
    expect(loginInputSchema.parse({ identifier: 'EMP0042', password: 'x' }).identifier).toBe(
      'EMP0042',
    );
  });

  it.each([
    [{ identifier: '', password: 'x' }, ['identifier'], 'validation.required'],
    [{ identifier: 'a@b.in', password: '' }, ['password'], 'validation.required'],
  ])('rejects %j', (input, path, message) => {
    const result = loginInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path, message });
  });
});

describe('new password', () => {
  it('needs 12 to 128 characters, counting characters rather than bytes', () => {
    expect(newPasswordSchema.safeParse('short-pass1').error?.issues[0]?.message).toBe(
      'validation.passwordTooShort',
    );
    expect(newPasswordSchema.safeParse('x'.repeat(129)).error?.issues[0]?.message).toBe(
      'validation.passwordTooLong',
    );
    // 12 Devanagari characters are 36 bytes; the rule is about what the user typed.
    expect(newPasswordSchema.safeParse('दूधदूधदूधदूध').success).toBe(true);
  });

  it('has no composition rules', () => {
    expect(newPasswordSchema.safeParse('correct horse battery').success).toBe(true);
  });
});

describe('password forms', () => {
  it('normalises the e-mail address for a reset request', () => {
    expect(forgotPasswordInputSchema.parse({ email: ' Store@Shwetdhara.IN ' }).email).toBe(
      'store@shwetdhara.in',
    );
  });

  it('signs out other devices after a change unless asked not to', () => {
    const parsed = changePasswordInputSchema.parse({
      currentPassword: 'old',
      newPassword: 'a long enough password',
    });
    expect(parsed.revokeOtherSessions).toBe(true);
  });
});
