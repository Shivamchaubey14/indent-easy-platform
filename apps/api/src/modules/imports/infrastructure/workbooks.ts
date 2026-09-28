import type { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { XLSX_MIME } from '../../documents/index.js';
import { type ImportColumn, MAX_ROWS, parseCsv, SheetError } from '../domain/sheet.js';

export interface RawRow {
  rowNumber: number;
  cells: unknown[];
}

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/**
 * The first worksheet's rows (XLSX, streamed) or the CSV's records. The old binary .xls format is
 * refused with a clear message: it cannot be read reliably, and Excel saves .xlsx by default.
 */
export async function readRawRows(stream: Readable, mimeType: string): Promise<RawRow[]> {
  if (mimeType === 'text/csv') {
    const records = parseCsv((await readAll(stream)).toString('utf8'));
    if (records.length > MAX_ROWS + 1) {
      throw new SheetError('TOO_MANY_ROWS', `A file may have at most ${MAX_ROWS} rows.`);
    }
    return records.map((cells, i) => ({ rowNumber: i + 1, cells }));
  }
  if (mimeType !== XLSX_MIME) {
    stream.destroy();
    throw new SheetError('UNSUPPORTED_FORMAT', 'Save the file as .xlsx (Excel Workbook) or .csv.');
  }
  // The whole workbook is loaded (files are at most 25 MB). ExcelJS 4.4's streaming reader fails
  // at random when a worksheet entry comes before workbook.xml in the ZIP, so it is not used.
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(new Uint8Array(await readAll(stream)).buffer);
  } catch (err) {
    throw new SheetError('UNREADABLE_FILE', 'The file could not be read as an Excel workbook.', {
      cause: err,
    });
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new SheetError('EMPTY_FILE', 'The file has no worksheet.');
  if (worksheet.actualRowCount > MAX_ROWS + 1) {
    throw new SheetError('TOO_MANY_ROWS', `A file may have at most ${MAX_ROWS} rows.`);
  }
  const rows: RawRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push({ rowNumber: row.number, cells: (row.values as unknown[]).slice(1) });
  });
  return rows;
}

function sheet(workbook: ExcelJS.Workbook, title: string, headers: string[]) {
  const worksheet = workbook.addWorksheet(title.slice(0, 31));
  worksheet.addRow(headers);
  const header = worksheet.getRow(1);
  header.font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  headers.forEach(
    (h, i) => (worksheet.getColumn(i + 1).width = Math.min(Math.max(h.length + 4, 12), 40)),
  );
  return worksheet;
}

/** The import template: the kind's headers with the current data under them. */
export async function writeTemplate(
  title: string,
  columns: readonly ImportColumn[],
  data: readonly Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = sheet(
    workbook,
    title,
    columns.map((c) => c.header),
  );
  for (const record of data) {
    worksheet.addRow(columns.map((c) => record[c.key] ?? null));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export interface ReportRow {
  rowIndex: number;
  values: Record<string, string | null>;
  outcome: string;
  problems: string;
}

/** The file's rows with what happened to each and why (downloadable error report, MST-004). */
export async function writeReport(
  title: string,
  columns: readonly ImportColumn[],
  rows: readonly ReportRow[],
  labels: { row: string; outcome: string; problems: string },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = sheet(workbook, title, [
    labels.row,
    labels.outcome,
    labels.problems,
    ...columns.map((c) => c.header),
  ]);
  for (const row of rows) {
    worksheet.addRow([
      row.rowIndex || null,
      row.outcome,
      row.problems,
      ...columns.map((c) => row.values[c.key] ?? null),
    ]);
  }
  worksheet.getColumn(3).width = 60;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
