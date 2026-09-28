import { describe, expect, it } from 'vitest';
import { cellText, mapHeaders, parseCsv, SheetError, toRows } from './sheet.js';

const columns = [
  { key: 'code', header: 'MPP Code', aliases: ['mpp_code'], required: true },
  { key: 'name', header: 'MPP Name', required: true },
  { key: 'village', header: 'Village' },
];

describe('cell text', () => {
  it('keeps the digits of numeric codes and normalises text like the legacy engine', () => {
    expect(cellText(3600006)).toBe('3600006');
    expect(cellText(12345678901234)).toBe('12345678901234');
    expect(cellText(2.5)).toBe('2.5');
    expect(cellText('  Pashu\u00a0  Aahar \n')).toBe('Pashu Aahar');
    expect(cellText('ＡＢＣ１２３')).toBe('ABC123'); // full-width → NFKC
    expect(cellText('   ')).toBeNull();
  });

  it('reads rich text, formulas, hyperlinks and dates', () => {
    expect(cellText({ richText: [{ text: 'Cattle ' }, { text: 'feed' }] })).toBe('Cattle feed');
    expect(cellText({ formula: 'A1&B1', result: 'N-77' })).toBe('N-77');
    expect(cellText({ text: 'ND123', hyperlink: 'http://x' })).toBe('ND123');
    expect(cellText(new Date('2026-09-28T00:00:00Z'))).toBe('2026-09-28');
    expect(cellText({ error: '#REF!' })).toBeNull();
  });
});

describe('headers', () => {
  it('matches headers loosely and by alias', () => {
    const positions = mapHeaders(['MPP_CODE', 'mpp name', 'Extra', 'village '], columns);
    expect([...positions.entries()]).toEqual([
      [0, 'code'],
      [1, 'name'],
      [3, 'village'],
    ]);
  });

  it('refuses a file without a required column', () => {
    expect(() => mapHeaders(['MPP Code', 'Village'], columns)).toThrow(SheetError);
    expect(() => mapHeaders(['MPP Code', 'Village'], columns)).toThrow('MPP Name');
  });
});

describe('rows', () => {
  it('skips blank rows, keeps spreadsheet row numbers and gives every column a value', () => {
    const rows = toRows(
      [
        { rowNumber: 1, cells: ['MPP Code', 'MPP Name'] },
        { rowNumber: 2, cells: ['M1', 'Bakewar'] },
        { rowNumber: 3, cells: [null, '  '] },
        { rowNumber: 4, cells: ['M2', 'Jaswantnagar'] },
      ],
      columns,
    );
    expect(rows).toEqual([
      { rowIndex: 2, values: { code: 'M1', name: 'Bakewar', village: null } },
      { rowIndex: 4, values: { code: 'M2', name: 'Jaswantnagar', village: null } },
    ]);
  });
});

describe('CSV', () => {
  it('handles quotes, doubled quotes, commas and newlines inside fields, and a BOM', () => {
    expect(parseCsv('\uFEFFcode,name\r\nM1,"Bakewar, Etawah"\n"M2","Say ""hi""\nthere"\n')).toEqual(
      [
        ['code', 'name'],
        ['M1', 'Bakewar, Etawah'],
        ['M2', 'Say "hi"\nthere'],
      ],
    );
  });
});
