import type { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfig } from '@ie/config';
import type { BucketName } from '../domain/files.js';

/** Object storage behind pre-signed URLs (SRS §35.1, adapter `ObjectStorage`, Appendix). */
export interface ObjectStorage {
  /** A URL the client PUTs the file to, with the headers it must send (type and checksum are signed). */
  presignPut(input: {
    bucket: BucketName;
    key: string;
    mimeType: string;
    sha256Base64: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(input: {
    bucket: BucketName;
    key: string;
    fileName: string;
    disposition: 'inline' | 'attachment';
    expiresInSeconds: number;
  }): Promise<string>;
  /** Size of the stored object, or null when there is none. */
  head(bucket: BucketName, key: string): Promise<{ sizeBytes: number } | null>;
  get(bucket: BucketName, key: string): Promise<Readable>;
  put(bucket: BucketName, key: string, body: Buffer, mimeType: string): Promise<void>;
  /** Moves an object to another bucket (copy, then delete the original). */
  move(from: BucketName, to: BucketName, key: string): Promise<void>;
}

type StorageConfig = AppConfig['storage'];

function client(config: StorageConfig, endpoint: string | undefined): S3Client {
  return new S3Client({
    region: config.region,
    ...(endpoint && { endpoint, forcePathStyle: true }),
    ...(config.accessKeyId &&
      config.secretAccessKey && {
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
    // Checksums only where we ask for them (the upload's SHA-256); MinIO and AWS both honour it.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

/** Content-Disposition with an ASCII fallback and the UTF-8 name (RFC 6266). */
function contentDisposition(disposition: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function s3Storage(config: StorageConfig): ObjectStorage {
  // Server-side calls use the internal endpoint; signed URLs are made for the public one.
  const internal = client(config, config.endpoint);
  const publicClient = client(config, config.publicEndpoint);
  const bucket = (name: BucketName) => config.buckets[name];

  return {
    async presignPut({ bucket: name, key, mimeType, sha256Base64, expiresInSeconds }) {
      const command = new PutObjectCommand({
        Bucket: bucket(name),
        Key: key,
        ContentType: mimeType,
        ChecksumSHA256: sha256Base64,
      });
      const url = await getSignedUrl(publicClient, command, {
        expiresIn: expiresInSeconds,
        // Sign these, so the upload is refused unless it carries exactly this type and checksum.
        signableHeaders: new Set(['content-type', 'x-amz-checksum-sha256']),
        unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
      });
      return {
        url,
        headers: { 'Content-Type': mimeType, 'x-amz-checksum-sha256': sha256Base64 },
      };
    },

    presignGet({ bucket: name, key, fileName, disposition, expiresInSeconds }) {
      return getSignedUrl(
        publicClient,
        new GetObjectCommand({
          Bucket: bucket(name),
          Key: key,
          ResponseContentDisposition: contentDisposition(disposition, fileName),
        }),
        { expiresIn: expiresInSeconds },
      );
    },

    async head(name, key) {
      try {
        const result = await internal.send(
          new HeadObjectCommand({ Bucket: bucket(name), Key: key }),
        );
        return { sizeBytes: result.ContentLength ?? 0 };
      } catch (err) {
        if (err instanceof NotFound || (err as { name?: string }).name === 'NotFound') return null;
        throw err;
      }
    },

    async get(name, key) {
      const result = await internal.send(new GetObjectCommand({ Bucket: bucket(name), Key: key }));
      return result.Body as Readable;
    },

    async put(name, key, body, mimeType) {
      await internal.send(
        new PutObjectCommand({ Bucket: bucket(name), Key: key, Body: body, ContentType: mimeType }),
      );
    },

    async move(from, to, key) {
      await internal.send(
        new CopyObjectCommand({
          Bucket: bucket(to),
          Key: key,
          CopySource: `${bucket(from)}/${key.split('/').map(encodeURIComponent).join('/')}`,
        }),
      );
      await internal.send(new DeleteObjectCommand({ Bucket: bucket(from), Key: key }));
    },
  };
}
