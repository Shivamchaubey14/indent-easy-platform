import { describe, expect, it } from 'vitest';
import { localPasswordProblems, platformOf, refreshExpiry } from './policy.js';

describe('new password rules', () => {
  it('accepts a long passphrase with no special characters', () => {
    expect(localPasswordProblems('milk collection at dawn', ['store@shwetdhara.in'])).toEqual([]);
  });

  it('refuses short and overly long passwords', () => {
    expect(localPasswordProblems('short', [])).toEqual(['validation.passwordTooShort']);
    expect(localPasswordProblems('x'.repeat(129), [])).toEqual(['validation.passwordTooLong']);
  });

  it('refuses passwords built from the user’s e-mail or employee code', () => {
    expect(localPasswordProblems('ramesh.kumar2026!', ['ramesh.kumar@shwetdhara.in'])).toEqual([
      'validation.passwordPersonal',
    ]);
    expect(localPasswordProblems('my code is EMP0042!!', ['a@b.in', 'EMP0042'])).toEqual([
      'validation.passwordPersonal',
    ]);
  });
});

describe('sessions', () => {
  it('tells mobile clients from web browsers', () => {
    expect(platformOf('mobile')).toBe('mobile');
    expect(platformOf('mobile-android')).toBe('mobile');
    expect(platformOf('web')).toBe('web');
    expect(platformOf(undefined)).toBe('web');
  });

  it('never lets a refresh token outlive its session', () => {
    const now = new Date('2026-09-26T10:00:00Z');
    const end = new Date('2026-09-26T10:30:00Z');
    expect(refreshExpiry(now, 3600, end)).toEqual(end);
    expect(refreshExpiry(now, 600, end)).toEqual(new Date('2026-09-26T10:10:00Z'));
  });
});
