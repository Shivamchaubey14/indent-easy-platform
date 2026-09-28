import { z } from 'zod';

/*
 * File uploads (SRS §35.2; POST /api/v1/files/upload-intents). The client hashes the file, asks
 * for an upload URL, PUTs the file there, then confirms. Messages are i18n keys.
 */

export const uploadIntentSchema = z.object({
  documentType: z
    .string()
    .trim()
    .regex(/^[A-Z_]{2,40}$/, 'validation.code'),
  fileName: z.string().trim().min(1, 'validation.required').max(255, 'validation.tooLong'),
  mimeType: z.string().trim().toLowerCase().min(3, 'validation.required').max(127),
  sizeBytes: z
    .number()
    .int()
    .min(1, 'validation.fileEmpty')
    .max(104_857_600, 'validation.fileTooLarge'),
  sha256: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[0-9a-f]{64}$/, 'validation.checksum'),
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(128).optional(),
  existingDocumentId: z.string().max(128).optional(),
  multipart: z.boolean().default(false),
});

export type UploadIntentInput = z.output<typeof uploadIntentSchema>;
