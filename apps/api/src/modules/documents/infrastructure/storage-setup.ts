import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketVersioningCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { AppConfig } from '@ie/config';

/** Days an object is kept after upload (SRS §35.1). Documents and quarantine are kept. */
export const RETENTION_DAYS = { imports: 90, exports: 7 } as const;

export interface StorageSetupResult {
  created: string[];
  existing: string[];
}

/**
 * Creates the four buckets if missing, turns on versioning for documents and sets the expiry of
 * import and export files. Idempotent: run on every deploy (the `storage-setup` job) and locally
 * by `pnpm storage:setup`.
 */
export async function setUpStorage(config: AppConfig['storage']): Promise<StorageSetupResult> {
  const s3 = new S3Client({
    region: config.region,
    ...(config.endpoint && { endpoint: config.endpoint, forcePathStyle: true }),
    ...(config.accessKeyId &&
      config.secretAccessKey && {
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      }),
  });
  const result: StorageSetupResult = { created: [], existing: [] };
  try {
    for (const bucket of Object.values(config.buckets)) {
      const exists = await s3
        .send(new HeadBucketCommand({ Bucket: bucket }))
        .then(() => true)
        .catch((err: { $metadata?: { httpStatusCode?: number } }) => {
          if (err.$metadata?.httpStatusCode === 404) return false;
          throw err;
        });
      if (exists) result.existing.push(bucket);
      else {
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        result.created.push(bucket);
      }
    }
    await s3.send(
      new PutBucketVersioningCommand({
        Bucket: config.buckets.documents,
        VersioningConfiguration: { Status: 'Enabled' },
      }),
    );
    for (const [name, days] of Object.entries(RETENTION_DAYS) as [
      keyof typeof RETENTION_DAYS,
      number,
    ][]) {
      await s3.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: config.buckets[name],
          LifecycleConfiguration: {
            Rules: [
              {
                ID: `expire-after-${days}-days`,
                Status: 'Enabled',
                Filter: { Prefix: '' },
                Expiration: { Days: days },
              },
            ],
          },
        }),
      );
    }
    return result;
  } finally {
    s3.destroy();
  }
}
