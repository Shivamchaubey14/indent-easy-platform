import { describe, expect, it } from 'vitest';
import { isLegacyHash, verifyLegacyPassword } from './legacy-password.js';

// Made with Python's hashlib.pbkdf2_hmac, i.e. exactly what Django's PBKDF2PasswordHasher stores.
const DJANGO = 'pbkdf2_sha256$720000$Xq3vLr9TzP1kWm2A$/FvjMnCFmb1LtowosKShV0aFa/XajHfsu9zo5QLD8fM=';

describe('legacy Django passwords', () => {
  it('recognises the Django PBKDF2 format and nothing else', () => {
    expect(isLegacyHash(DJANGO)).toBe(true);
    expect(isLegacyHash('$argon2id$v=19$m=19456,t=2,p=1$abc$def')).toBe(false);
    expect(isLegacyHash('bcrypt_sha256$$2b$12$abc')).toBe(false);
  });

  it('accepts the right password and refuses a wrong one', async () => {
    expect(await verifyLegacyPassword(DJANGO, 'bmc store 2025')).toBe(true);
    expect(await verifyLegacyPassword(DJANGO, 'bmc store 2026')).toBe(false);
  });

  it('refuses malformed hashes and absurd iteration counts without throwing', async () => {
    expect(await verifyLegacyPassword('pbkdf2_sha256$abc$salt$hash', 'x')).toBe(false);
    expect(await verifyLegacyPassword('pbkdf2_sha256$10$salt$c2hvcnQ=', 'x')).toBe(false);
    expect(await verifyLegacyPassword(`pbkdf2_sha256$999999999$salt$${'A'.repeat(44)}`, 'x')).toBe(
      false,
    );
  });
});
