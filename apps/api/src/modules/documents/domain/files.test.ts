import { describe, expect, it } from 'vitest';
import {
  bucketFor,
  contentMatchesType,
  hexToBase64,
  sanitiseFileName,
  storageKey,
  XLSX_MIME,
} from './files.js';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('contentMatchesType', () => {
  it('accepts files whose first bytes fit the declared type', () => {
    expect(contentMatchesType(XLSX_MIME, bytes(0x50, 0x4b, 0x03, 0x04, 0x14))).toBe(true);
    expect(contentMatchesType('application/pdf', new TextEncoder().encode('%PDF-1.7'))).toBe(true);
    expect(contentMatchesType('image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(contentMatchesType('text/csv', new TextEncoder().encode('code,name\nA1,फ़ीड\n'))).toBe(
      true,
    );
  });

  it('refuses a renamed executable, binary "CSV" and unknown types', () => {
    const exe = bytes(0x4d, 0x5a, 0x90, 0x00);
    expect(contentMatchesType(XLSX_MIME, exe)).toBe(false);
    expect(contentMatchesType('text/csv', exe)).toBe(false);
    expect(contentMatchesType('application/x-msdownload', exe)).toBe(false);
  });
});

describe('storage keys', () => {
  it('follow the documented layout with a cleaned file name', () => {
    expect(
      storageKey({
        organizationId: 'org',
        typeCode: 'IMPORT_FILE',
        documentId: 'doc',
        versionNo: 1,
        fileName: '..\\..\\etc/MPP list (Sep).xlsx',
        at: new Date('2026-09-28T20:00:00Z'),
      }),
    ).toBe('org/IMPORT_FILE/2026/09/doc/v1/MPP list _Sep_.xlsx');
  });

  it('never produce an empty or hidden name', () => {
    expect(sanitiseFileName('../.hidden')).toBe('hidden');
    expect(sanitiseFileName('\u0000\u0001')).toBe('__');
    expect(sanitiseFileName('')).toBe('file');
  });
});

describe('buckets and checksums', () => {
  it('keeps imports and exports apart from documents', () => {
    expect(bucketFor('IMPORT_FILE')).toBe('imports');
    expect(bucketFor('EXPORT_FILE')).toBe('exports');
    expect(bucketFor('POD')).toBe('documents');
  });

  it('converts the hex SHA-256 to the base64 S3 expects', () => {
    const empty = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(hexToBase64(empty)).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
  });
});
