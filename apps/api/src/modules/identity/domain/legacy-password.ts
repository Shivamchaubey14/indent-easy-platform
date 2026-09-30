import { pbkdf2, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/*
 * Passwords migrated from the legacy Django app (OQ-025, decided: verify and re-hash). A legacy
 * hash is only accepted while the organisation's `legacy_hash_login` flag is on; after one
 * successful sign-in it is replaced by Argon2id like any outdated hash.
 *
 * Django's default hasher: pbkdf2_sha256$<iterations>$<salt>$<base64 of the 32-byte key>.
 * Other Django hashers (bcrypt, argon2, sha1…) are not accepted; the migration report lists them.
 */

const derive = promisify(pbkdf2);
const PREFIX = 'pbkdf2_sha256$';
/** Refuse absurd costs that would tie up the server (Django uses up to ~1,000,000). */
const MAX_ITERATIONS = 2_000_000;

export const isLegacyHash = (stored: string) => stored.startsWith(PREFIX);

export async function verifyLegacyPassword(stored: string, password: string): Promise<boolean> {
  const [algorithm, iterationsText, salt, encoded] = stored.split('$');
  const iterations = Number(iterationsText);
  if (
    algorithm !== 'pbkdf2_sha256' ||
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    iterations > MAX_ITERATIONS ||
    !salt ||
    !encoded
  ) {
    return false;
  }
  const expected = Buffer.from(encoded, 'base64');
  if (expected.length !== 32) return false;
  const actual = await derive(password, salt, iterations, 32, 'sha256');
  return timingSafeEqual(actual, expected);
}
