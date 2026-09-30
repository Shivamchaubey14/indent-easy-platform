import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/*
 * Reads a mysqldump of the legacy database (SRS §52.1, M0/M1) without translating MySQL DDL: the
 * CREATE TABLE statements give each table's column order, and every INSERT row becomes a plain
 * object of column → value (strings, numbers or null), to be staged as jsonb.
 */

export type Cell = string | number | null;
export type LegacyRow = Record<string, Cell>;

/** Never staged: WhatsApp is retired and its data is not migrated (DEC-001); Django internals. */
export const SKIPPED_TABLES = new Set([
  'main_app_whatsapplog',
  'main_app_messagequeue',
  'main_app_enhancedmessagequeue',
  'main_app_messagedeliverylog',
]);
const skipped = (table: string) =>
  SKIPPED_TABLES.has(table.toLowerCase()) ||
  /^(auth|django|admin)_/i.test(table) ||
  table.toLowerCase() === 'main_app_message';

const ESCAPES: Record<string, string> = {
  '0': '\0',
  b: '\b',
  n: '\n',
  r: '\r',
  t: '\t',
  Z: '\x1a',
};

/**
 * Parses the VALUES part of an INSERT: `(1,'a',NULL),(2,'b\'c',3.5)` → rows of cells. Handles
 * MySQL string escapes, NULL, numbers and _binary/hex literals (kept as text).
 */
export function parseValues(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    while (i < n && text[i] !== '(') i++;
    if (i >= n) break;
    i++; // (
    const row: Cell[] = [];
    for (;;) {
      while (text[i] === ' ') i++;
      if (text.startsWith('_binary ', i)) i += 8;
      if (text[i] === "'") {
        i++;
        let value = '';
        for (;;) {
          const ch = text[i];
          if (ch === undefined) throw new Error('unterminated string in INSERT');
          if (ch === '\\') {
            const next = text[i + 1]!;
            value += ESCAPES[next] ?? next;
            i += 2;
          } else if (ch === "'" && text[i + 1] === "'") {
            value += "'";
            i += 2;
          } else if (ch === "'") {
            i++;
            break;
          } else {
            value += ch;
            i++;
          }
        }
        row.push(value);
      } else {
        let j = i;
        while (j < n && text[j] !== ',' && text[j] !== ')') j++;
        const raw = text.slice(i, j).trim();
        i = j;
        if (raw.toUpperCase() === 'NULL') row.push(null);
        else if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(raw)) {
          // Big integers stay text so no digit is lost.
          row.push(Number.isSafeInteger(Number(raw)) || raw.includes('.') ? Number(raw) : raw);
        } else row.push(raw);
      }
      while (text[i] === ' ') i++;
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === ')') {
        i++;
        break;
      }
      throw new Error(`unexpected character ${JSON.stringify(text[i])} in INSERT`);
    }
    rows.push(row);
  }
  return rows;
}

/** Streams a dump and calls `onRows` with each table's rows (batches, in file order). */
export async function readDump(
  path: string,
  onRows: (table: string, rows: LegacyRow[]) => Promise<void>,
): Promise<{ tables: Map<string, number>; skipped: string[] }> {
  const columns = new Map<string, string[]>();
  const counts = new Map<string, number>();
  const skippedTables = new Set<string>();
  let creating: { table: string; cols: string[] } | null = null;

  const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    const create = /^CREATE TABLE (?:IF NOT EXISTS )?`([^`]+)`/i.exec(line);
    if (create) {
      creating = { table: create[1]!, cols: [] };
      continue;
    }
    if (creating) {
      const col = /^\s*`([^`]+)`\s/.exec(line);
      if (col) creating.cols.push(col[1]!);
      if (/^\)/.test(line.trim())) {
        columns.set(creating.table, creating.cols);
        creating = null;
      }
      continue;
    }
    const insert = /^INSERT INTO `([^`]+)`\s*(\(([^)]*)\))?\s*VALUES\s*/i.exec(line);
    if (!insert) continue;
    const table = insert[1]!;
    if (skipped(table)) {
      skippedTables.add(table);
      continue;
    }
    const names = insert[3]
      ? insert[3].split(',').map((c) => c.trim().replace(/`/g, ''))
      : columns.get(table);
    if (!names) throw new Error(`INSERT into ${table} before its CREATE TABLE`);
    const body = line.slice(insert[0].length).replace(/;\s*$/, '');
    const rows = parseValues(body).map((cells) => {
      if (cells.length !== names.length) {
        throw new Error(`${table}: ${cells.length} values for ${names.length} columns`);
      }
      const row: LegacyRow = Object.fromEntries(names.map((name, i) => [name, cells[i]!]));
      return row;
    });
    counts.set(table, (counts.get(table) ?? 0) + rows.length);
    await onRows(table, rows);
  }
  return { tables: counts, skipped: [...skippedTables] };
}
