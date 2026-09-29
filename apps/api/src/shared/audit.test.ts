import { describe, expect, it } from 'vitest';
import { canonical } from './audit.js';

describe('audit canonical form', () => {
  it('sorts keys and drops undefined, so equal records hash equally', () => {
    expect(canonical({ b: 1, a: { d: [1, undefined], c: 'x' }, e: undefined })).toBe(
      canonical({ a: { c: 'x', d: [1, null] }, b: 1 }),
    );
  });

  it('hashes dates as the ISO string the jsonb column stores, not as {}', () => {
    const at = new Date('2026-09-26T06:40:33.459Z');
    expect(canonical({ lockedUntil: at })).toBe('{"lockedUntil":"2026-09-26T06:40:33.459Z"}');
    expect(canonical({ lockedUntil: at })).toBe(
      canonical(JSON.parse(JSON.stringify({ lockedUntil: at }))),
    );
  });
});
