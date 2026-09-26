import { describe, expect, it } from 'vitest';
import { uuidv7, uuidv7Time } from './uuid.js';

describe('uuidv7', () => {
  it('produces RFC 9562 version 7 UUIDs', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('encodes the creation time', () => {
    const at = Date.UTC(2026, 8, 25, 6, 0, 0);
    expect(uuidv7Time(uuidv7(at))).toBe(at);
  });

  it('sorts by creation time across milliseconds', () => {
    const ids = [3, 1, 2].map((offset) => uuidv7(1_790_000_000_000 + offset));
    expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('is unique', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => uuidv7(1_790_000_000_000)));
    expect(ids.size).toBe(10_000);
  });
});
