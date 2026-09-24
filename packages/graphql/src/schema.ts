import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Absolute path of the SDL contract shipped with this package. */
export const schemaPath = fileURLToPath(new URL('../schema/schema.graphql', import.meta.url));

let cached: string | undefined;

/** The GraphQL contract as SDL text, read once and cached. */
export function loadTypeDefs(): string {
  cached ??= readFileSync(schemaPath, 'utf8');
  return cached;
}
