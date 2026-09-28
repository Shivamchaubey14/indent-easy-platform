/*
 * Turning an uploaded spreadsheet into rows of text keyed by column (SRS OP-12). Cells are
 * normalised the way the legacy reconciliation engine did: Unicode NFKC, whitespace collapsed,
 * blanks as null. Numbers keep their digits (SAP codes arrive as numbers from Excel).
 */

export interface ImportColumn {
  key: string;
  /** Header written in the template. */
  header: string;
  /** Other headers accepted for this column (e.g. the legacy template's). */
  aliases?: readonly string[];
  required?: boolean;
}

export interface SheetRow {
  /** Row number as the user sees it in the spreadsheet (header is row 1). */
  rowIndex: number;
  values: Record<string, string | null>;
}

export class SheetError extends Error {
  constructor(
    readonly rule: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SheetError';
  }
}

export const MAX_ROWS = 100_000;

/** Compare headers loosely: case, spaces, underscores and hyphens don't matter. */
export const headerKey = (header: string) =>
  header
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s_\-/]+/g, ' ')
    .trim();

/** Legacy `normalize_string`: NFKC, whitespace runs to one space, trimmed; blank → null. */
export function normaliseText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
}

/** An ExcelJS cell value (or a CSV field) as text. */
export function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return normaliseText(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // Whole numbers without exponent or grouping: 3600006, not 3.600006e6 or 3,600,006.
    return normaliseText(
      Number.isInteger(value)
        ? value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 })
        : String(value),
    );
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const cell = value as {
      richText?: { text: string }[];
      text?: unknown;
      result?: unknown;
      error?: unknown;
    };
    if (cell.richText) return normaliseText(cell.richText.map((r) => r.text).join(''));
    if ('result' in cell) return cellText(cell.result);
    if (cell.text !== undefined) return cellText(cell.text);
    if (cell.error) return null;
  }
  return null;
}

/**
 * Maps the header row to column keys. Unknown headers are ignored; a missing required column
 * refuses the whole file, naming what is missing.
 */
export function mapHeaders(
  headers: readonly (string | null)[],
  columns: readonly ImportColumn[],
): Map<number, string> {
  const byHeader = new Map<string, string>();
  for (const column of columns) {
    for (const name of [column.header, ...(column.aliases ?? [])]) {
      byHeader.set(headerKey(name), column.key);
    }
  }
  const positions = new Map<number, string>();
  headers.forEach((header, index) => {
    const key = header ? byHeader.get(headerKey(header)) : undefined;
    if (key && ![...positions.values()].includes(key)) positions.set(index, key);
  });
  const found = new Set(positions.values());
  const missing = columns.filter((c) => c.required && !found.has(c.key)).map((c) => c.header);
  if (missing.length > 0) {
    throw new SheetError('COLUMNS_MISSING', `Missing columns: ${missing.join(', ')}`);
  }
  return positions;
}

/** Builds rows from raw cell arrays (index 0 = header row); blank rows are skipped. */
export function toRows(
  raw: readonly { rowNumber: number; cells: readonly unknown[] }[],
  columns: readonly ImportColumn[],
): SheetRow[] {
  const [header, ...body] = raw;
  if (!header) throw new SheetError('EMPTY_FILE', 'The file has no header row.');
  const positions = mapHeaders(
    header.cells.map((c) => cellText(c)),
    columns,
  );
  const rows: SheetRow[] = [];
  for (const line of body) {
    // Every column has a value (null when absent from the file), so kinds never see undefined.
    const values: Record<string, string | null> = Object.fromEntries(
      columns.map((c) => [c.key, null]),
    );
    let blank = true;
    for (const [index, key] of positions) {
      const text = cellText(line.cells[index]);
      values[key] = text;
      if (text !== null) blank = false;
    }
    if (blank) continue;
    rows.push({ rowIndex: line.rowNumber, values });
    if (rows.length > MAX_ROWS) {
      throw new SheetError('TOO_MANY_ROWS', `A file may have at most ${MAX_ROWS} rows.`);
    }
  }
  return rows;
}

/** Splits CSV text into records (RFC 4180: quotes, doubled quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}
