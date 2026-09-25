import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export interface BuildInfo {
  version: string;
  commit: string;
  graphqlSchemaHash: string;
  builtAt: string;
  minMobileVersion?: string;
}

const packageVersion = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

/** The running version: APP_VERSION from the image, else package.json. */
export function appVersion(env: NodeJS.ProcessEnv = process.env): string {
  return env['APP_VERSION'] ?? packageVersion;
}

/** Build metadata for GET /api/v1/version. CI sets GIT_COMMIT and BUILD_TIME in the image. */
export function buildInfo(typeDefs: string, env: NodeJS.ProcessEnv = process.env): BuildInfo {
  return {
    version: appVersion(env),
    commit: env['GIT_COMMIT'] ?? 'local',
    graphqlSchemaHash: createHash('sha256').update(typeDefs).digest('hex'),
    builtAt: env['BUILD_TIME'] ?? new Date().toISOString(),
    ...(env['MIN_MOBILE_VERSION'] && { minMobileVersion: env['MIN_MOBILE_VERSION'] }),
  };
}
