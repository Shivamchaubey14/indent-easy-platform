import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/** A 256-bit random token, URL-safe (refresh and reset tokens, §30.1). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are stored only as SHA-256 hashes, so a database leak reveals no usable token. */
export function tokenHash(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

// AUTH-002: Argon2id, 19 MiB, 2 iterations, parallelism 1 (OWASP minimum). Raising these makes
// existing hashes "outdated", and they are upgraded the next time the user signs in.
const ARGON2 = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const PARAMS = `m=${ARGON2.memoryCost},t=${ARGON2.timeCost},p=${ARGON2.parallelism}`;

export const passwords = {
  hash: (password: string) => hash(password, ARGON2),
  verify: (stored: string, password: string) => verify(stored, password).catch(() => false),
  isOutdated: (stored: string) => !stored.startsWith('$argon2id$') || !stored.includes(PARAMS),
};

// Verifying against a real hash when the account doesn't exist keeps both paths equally slow, so
// response times don't reveal which e-mail addresses have accounts (AUTH-001).
let decoy: Promise<string> | undefined;
export async function spendVerifyTime(password: string): Promise<void> {
  decoy ??= passwords.hash(randomToken());
  await passwords.verify(await decoy, password);
}

/**
 * CSRF tokens for the cookie-authenticated auth endpoints (§30.1): a random value and its HMAC,
 * sent both as a readable cookie and as a header (signed double submit).
 */
export class CsrfTokens {
  private readonly secret: Buffer;

  constructor(secret: string | undefined) {
    this.secret = secret ? Buffer.from(secret) : randomBytes(32);
  }

  issue(): string {
    const nonce = randomBytes(16).toString('base64url');
    return `${nonce}.${this.sign(nonce)}`;
  }

  /** The header must equal the cookie, and the token must carry our signature. */
  valid(header: string | undefined, cookie: string | undefined): boolean {
    if (!header || !cookie || header.length !== cookie.length) return false;
    if (!timingSafeEqual(Buffer.from(header), Buffer.from(cookie))) return false;
    const [nonce, signature] = header.split('.');
    if (!nonce || !signature) return false;
    const expected = Buffer.from(this.sign(nonce));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private sign(nonce: string): string {
    return createHmac('sha256', this.secret).update(nonce).digest('base64url');
  }
}
