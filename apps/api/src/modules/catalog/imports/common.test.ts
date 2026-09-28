import { describe, expect, it } from 'vitest';
import { cycleBandOf, INVALID, mobileE164, parseFlag, parseWhole, statusOf } from './common.js';

describe('import value parsing', () => {
  it('stores Indian mobile numbers as E.164', () => {
    expect(mobileE164('98765 43210')).toBe('+919876543210');
    expect(mobileE164('09876543210')).toBe('+919876543210');
    expect(mobileE164('919876543210')).toBe('+919876543210');
    expect(mobileE164('+44 20 7946 0958')).toBe('+442079460958');
    expect(mobileE164('12345')).toBe(INVALID);
    expect(mobileE164(null)).toBeNull();
  });

  it('reads the legacy cycle bands', () => {
    expect(cycleBandOf('1-10')).toBe('DAYS_1_10');
    expect(cycleBandOf('11 - 20')).toBe('DAYS_11_20');
    expect(cycleBandOf('21–31')).toBe('DAYS_21_31');
    expect(cycleBandOf('DAYS_1_10')).toBe('DAYS_1_10');
    expect(cycleBandOf('1-15')).toBe(INVALID);
  });

  it('reads flags, whole numbers and statuses', () => {
    expect(parseFlag('Yes', false)).toBe(true);
    expect(parseFlag('n', true)).toBe(false);
    expect(parseFlag(null, true)).toBe(true);
    expect(parseFlag('maybe', false)).toBe(INVALID);
    expect(parseWhole('3', 1, 99)).toBe(3);
    expect(parseWhole('3.0', 1, 99)).toBe(3);
    expect(parseWhole('3.5', 1, 99)).toBe(INVALID);
    expect(parseWhole('0', 1, 99)).toBe(INVALID);
    expect(statusOf('inactive', 'ACTIVE')).toBe('INACTIVE');
    expect(statusOf(null, 'INACTIVE')).toBe('INACTIVE');
  });
});
