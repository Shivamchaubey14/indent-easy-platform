import type { AppConfig } from '@ie/config';
import type { RequestHandler } from 'express';
import type { Pool } from '../../shared/database.js';
import type { Logger } from '../../shared/logging.js';
import type { Redis } from '../../shared/redis.js';
import { AuthService } from './application/auth-service.js';
import { AccessTokens } from './infrastructure/access-tokens.js';
import { AuthGuards } from './infrastructure/guards.js';
import {
  type BreachedPasswords,
  type Mailer,
  noBreachCheck,
  pwnedPasswords,
  smtpMailer,
} from './infrastructure/outside.js';
import { PostgresIdentity } from './infrastructure/postgres-identity.js';
import { CsrfTokens } from './infrastructure/secrets.js';
import { authenticate } from './interface/authenticate.js';
import { type AuthOperationId, authHandlers } from './interface/rest.js';

export { AuthService } from './application/auth-service.js';
export { requirePrincipal } from './interface/authenticate.js';
export type { AuthOperationId } from './interface/rest.js';
export type { Mailer, MailMessage } from './infrastructure/outside.js';
export { passwords } from './infrastructure/secrets.js';
export { localPasswordProblems } from './domain/policy.js';
export { PostgresIdentity } from './infrastructure/postgres-identity.js';

export interface IdentityOptions {
  config: AppConfig;
  pool: Pool;
  redis: Redis;
  logger: Logger;
  /** Overrides for tests. */
  mailer?: Mailer;
  breached?: BreachedPasswords;
  now?: () => Date;
}

export interface Identity {
  service: AuthService;
  /** Express middleware that verifies bearer tokens (see interface/authenticate.ts). */
  authenticate: RequestHandler;
  handlers: Record<AuthOperationId, RequestHandler>;
}

/** Wires the identity module: sign-in service, token middleware and REST handlers. */
export async function createIdentity(options: IdentityOptions): Promise<Identity> {
  const { config, pool, redis, logger } = options;
  const tokens = await AccessTokens.create(
    config.auth.jwtSigningKeys,
    config.auth.accessTtlSeconds,
    logger,
  );
  const guards = new AuthGuards(redis, logger);
  const service = new AuthService({
    store: new PostgresIdentity(pool),
    tokens,
    guards,
    mailer: options.mailer ?? smtpMailer(config.mail),
    breached:
      options.breached ??
      (config.auth.breachCheck === 'hibp' ? pwnedPasswords(logger) : noBreachCheck),
    logger,
    publicBaseUrl: config.http.publicBaseUrl,
    ...(options.now && { now: options.now }),
  });
  return {
    service,
    authenticate: authenticate(tokens, guards),
    handlers: authHandlers({
      service,
      tokens,
      csrf: new CsrfTokens(config.auth.csrfSecret),
      secureCookies: config.http.publicBaseUrl.startsWith('https://'),
    }),
  };
}
