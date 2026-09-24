import { describe, expect, it } from 'vitest';
import { businessDate } from './time.js';

describe('businessDate', () => {
  it('rolls over at midnight IST, not UTC', () => {
    expect(businessDate(new Date('2026-09-24T18:29:59Z'))).toBe('2026-09-24');
    expect(businessDate(new Date('2026-09-24T18:30:00Z'))).toBe('2026-09-25');
  });
});
