import { describe, expect, it } from 'vitest';
import { loginInputSchema } from './auth.js';

describe('login input', () => {
  it('normalises the e-mail address', () => {
    expect(loginInputSchema.parse({ email: '  Store.User@Shwetdhara.IN ', password: 'x' })).toEqual(
      {
        email: 'store.user@shwetdhara.in',
        password: 'x',
      },
    );
  });

  it.each([
    [{ email: '', password: 'x' }, ['email'], 'validation.required'],
    [{ email: 'not-an-email', password: 'x' }, ['email'], 'validation.email'],
    [{ email: 'a@b.in', password: '' }, ['password'], 'validation.required'],
  ])('rejects %j', (input, path, message) => {
    const result = loginInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path, message });
  });
});
