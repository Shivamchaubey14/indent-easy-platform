/*
 * Rules about uploaded files that need no I/O (SRS §35, SEC-007): what a file really is (by its
 * first bytes, not its name or declared type), where it is stored, and in which bucket.
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Signatures of the types the document types allow. */
const SIGNATURES: readonly { mime: readonly string[]; bytes: readonly number[] }[] = [
  // XLSX (and DOCX) are ZIP containers.
  { mime: [XLSX_MIME, 'application/zip'], bytes: [0x50, 0x4b, 0x03, 0x04] },
  // XLS: the OLE2 compound file header.
  { mime: ['application/vnd.ms-excel'], bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  { mime: ['application/pdf'], bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { mime: ['image/png'], bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: ['image/jpeg'], bytes: [0xff, 0xd8, 0xff] },
];

const startsWith = (head: Uint8Array, bytes: readonly number[]) =>
  head.length >= bytes.length && bytes.every((b, i) => head[i] === b);

/** CSV has no signature: accept text only (no NUL bytes, and valid UTF-8 or plain Latin text). */
function looksLikeText(head: Uint8Array): boolean {
  if (head.includes(0)) return false;
  try {
    // stream: the head may end in the middle of a character; only real errors throw.
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the file's first bytes (at least the first 512) fit the declared type. A mismatch means
 * the name or type lies, e.g. an executable renamed to .xlsx, and the upload is quarantined.
 */
export function contentMatchesType(mime: string, head: Uint8Array): boolean {
  if (mime === 'text/csv') return looksLikeText(head);
  const signature = SIGNATURES.find((s) => s.mime.includes(mime));
  return signature ? startsWith(head, signature.bytes) : false;
}

/** A file name safe for an object key and a download header: no paths, controls or odd characters. */
export function sanitiseFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .trim()
    .slice(-120);
  return cleaned || 'file';
}

/** `{org}/{docType}/{yyyy}/{mm}/{documentId}/v{n}/{sanitisedFileName}` (SRS §35.1). */
export function storageKey(input: {
  organizationId: string;
  typeCode: string;
  documentId: string;
  versionNo: number;
  fileName: string;
  at: Date;
}): string {
  const yyyy = String(input.at.getUTCFullYear());
  const mm = String(input.at.getUTCMonth() + 1).padStart(2, '0');
  return [
    input.organizationId,
    input.typeCode,
    yyyy,
    mm,
    input.documentId,
    `v${input.versionNo}`,
    sanitiseFileName(input.fileName),
  ].join('/');
}

export type BucketName = 'documents' | 'imports' | 'exports' | 'quarantine';

/** Import and export files have their own buckets with their own lifecycle (SRS §35.1). */
export function bucketFor(typeCode: string): BucketName {
  if (typeCode === 'IMPORT_FILE') return 'imports';
  if (typeCode === 'EXPORT_FILE') return 'exports';
  return 'documents';
}

/** SHA-256 as the contract writes it (hex) → as S3 checksums want it (base64). */
export const hexToBase64 = (hex: string) => Buffer.from(hex, 'hex').toString('base64');
