import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { statusesByTone, toneOf } from './status-map';

// Every status value the database accepts, read from the CHECK constraints in the baseline schema.
function databaseStatuses(): Set<string> {
  const sql = readFileSync(
    resolve(process.cwd(), '../../database/migrations/0000_baseline.sql'),
    'utf8',
  );
  const found = new Set<string>();
  for (const [, list] of sql.matchAll(/CHECK \(\w*status IN \(([^)]*)\)/g)) {
    for (const [, code] of list!.matchAll(/'([A-Z_]+)'/g)) found.add(code!);
  }
  return found;
}

describe('status map', () => {
  it('gives every status in the database a tone', () => {
    const statuses = databaseStatuses();
    expect(statuses.size).toBeGreaterThan(50);
    const mapped = new Set(Object.values(statusesByTone).flat());
    expect([...statuses].filter((s) => !mapped.has(s as never))).toEqual([]);
  });

  it('lists each status under exactly one tone', () => {
    const all = Object.values(statusesByTone).flat();
    expect(all.filter((s, i) => all.indexOf(s) !== i)).toEqual([]);
  });

  it('reads the tone of known and unknown codes', () => {
    expect(toneOf('APPROVED')).toBe('success');
    expect(toneOf('RETURNED')).toBe('warning');
    expect(toneOf('REJECTED')).toBe('danger');
    expect(toneOf('PENDING_APPROVAL')).toBe('info');
    expect(toneOf('SOMETHING_NEW')).toBe('neutral');
  });
});
