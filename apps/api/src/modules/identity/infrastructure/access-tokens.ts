import { randomUUID } from 'node:crypto';
import {
  type CryptoKey,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  importPKCS8,
  type JSONWebKeySet,
  jwtVerify,
  SignJWT,
} from 'jose';
import type { Principal } from '../../../shared/context.js';
import type { Logger } from '../../../shared/logging.js';

const ALG = 'ES256';
const ISSUER = 'indent-easy';
const AUDIENCE = 'indent-easy-api';

interface SigningKey {
  kid: string;
  privateKey: CryptoKey;
}

function pem(pkcs8Base64: string): string {
  const lines = pkcs8Base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
}

/**
 * Access tokens (SRS §30.1): short-lived ES256 JWTs carrying user, organisation, session and roles
 * version. The first configured key signs; every key verifies and is published in the JWKS, so keys
 * can be rotated without logging anyone out.
 */
export class AccessTokens {
  private constructor(
    private readonly signer: SigningKey,
    private readonly publicSet: JSONWebKeySet,
    readonly ttlSeconds: number,
  ) {}

  static async create(
    keys: readonly { kid: string; pkcs8: string }[] | undefined,
    ttlSeconds: number,
    logger: Logger,
  ): Promise<AccessTokens> {
    let signing: SigningKey[];
    if (keys?.length) {
      signing = await Promise.all(
        keys.map(async ({ kid, pkcs8 }) => ({
          kid,
          privateKey: await importPKCS8(pem(pkcs8), ALG, { extractable: true }),
        })),
      );
    } else {
      // Local development only: configuration refuses to start staging/prod without keys.
      logger.warn('JWT_SIGNING_KEYS is not set; using a temporary key (tokens end on restart)');
      const { privateKey } = await generateKeyPair(ALG, { extractable: true });
      signing = [{ kid: 'ephemeral', privateKey }];
    }
    const publicKeys = await Promise.all(
      signing.map(async ({ kid, privateKey }) => {
        const { kty, crv, x, y } = await exportJWK(privateKey);
        return { kty, crv, x, y, kid, alg: ALG, use: 'sig' } as const;
      }),
    );
    return new AccessTokens(signing[0]!, { keys: [...publicKeys] }, ttlSeconds);
  }

  sign(principal: Principal): Promise<string> {
    return new SignJWT({
      org: principal.organizationId,
      sid: principal.sessionId,
      rv: principal.rolesVersion,
      amr: ['pwd'],
      ...(principal.mustChangePassword && { mcp: true }),
    })
      .setProtectedHeader({ alg: ALG, kid: this.signer.kid, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(principal.userId)
      .setJti(randomUUID())
      .setIssuedAt()
      .setNotBefore('0s')
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.signer.privateKey);
  }

  /** Verifies signature, issuer, audience and expiry; throws on anything invalid. */
  async verify(token: string): Promise<Principal> {
    const { payload } = await jwtVerify(token, createLocalJWKSet(this.publicSet), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
    });
    const { sub, org, sid, rv, mcp } = payload;
    if (
      typeof sub !== 'string' ||
      typeof org !== 'string' ||
      typeof sid !== 'string' ||
      typeof rv !== 'number'
    ) {
      throw new Error('access token is missing required claims');
    }
    return {
      userId: sub,
      organizationId: org,
      sessionId: sid,
      rolesVersion: rv,
      mustChangePassword: mcp === true,
    };
  }

  /** Public keys for `/.well-known/jwks.json`. */
  jwks(): JSONWebKeySet {
    return this.publicSet;
  }
}
