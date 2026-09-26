import { randomUUID } from 'node:crypto';
import type { Principal } from '../../../shared/context.js';
import { ApiError } from '../../../shared/errors.js';
import type { Logger } from '../../../shared/logging.js';
import {
  AUTH_POLICY,
  localPasswordProblems,
  type PasswordProblem,
  type Platform,
  refreshExpiry,
} from '../domain/policy.js';
import type { AccessTokens } from '../infrastructure/access-tokens.js';
import type { AuthGuards } from '../infrastructure/guards.js';
import type { BreachedPasswords, Mailer } from '../infrastructure/outside.js';
import type { Account, PostgresIdentity } from '../infrastructure/postgres-identity.js';
import { passwords, randomToken, spendVerifyTime } from '../infrastructure/secrets.js';
import { resetPasswordMail } from './messages.js';

export interface AuthDependencies {
  store: PostgresIdentity;
  tokens: AccessTokens;
  guards: AuthGuards;
  mailer: Mailer;
  breached: BreachedPasswords;
  logger: Logger;
  /** Where users open links from e-mails (the web app). */
  publicBaseUrl: string;
  now?: () => Date;
}

export interface ClientInfo {
  platform: Platform;
  ip: string | undefined;
  clientVersion: string | undefined;
}

export interface Tokens {
  accessToken: string;
  expiresIn: number;
  sessionId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  mustChangePassword: boolean;
}

const invalidCredentials = () =>
  new ApiError('AUTH_INVALID_CREDENTIALS', 'The e-mail address or password is incorrect.');
const sessionEnded = () =>
  new ApiError('AUTH_TOKEN_EXPIRED', 'Your session has ended. Please sign in again.');
const tooMany = (retryAfter: number) =>
  new ApiError('RATE_LIMITED', 'Too many attempts. Please wait and try again.', { retryAfter });

function principalOf(account: Account, sessionId: string): Principal {
  return {
    userId: account.id,
    organizationId: account.organizationId,
    sessionId,
    rolesVersion: account.rolesVersion,
    mustChangePassword: account.mustChangePassword,
  };
}

/** Sign-in, token refresh, sign-out and passwords (SRS §11.1, §30). */
export class AuthService {
  private readonly now: () => Date;

  constructor(private readonly deps: AuthDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  get accessTtlSeconds(): number {
    return this.deps.tokens.ttlSeconds;
  }

  async login(
    input: { identifier: string; password: string; deviceName?: string | undefined },
    client: ClientInfo,
  ): Promise<Tokens> {
    const { store, guards } = this.deps;
    const { lockout } = AUTH_POLICY;
    const limit = await guards.hit(`login:ip:${client.ip}`, AUTH_POLICY.rateLimits.loginPerIp);
    if (!limit.allowed) throw tooMany(limit.retryAfter);

    const match = await store.findLoginAccount(input.identifier);
    const account = match ? await store.account(match.organizationId, match.userId) : null;
    if (!account) {
      await spendVerifyTime(input.password);
      await this.event({
        type: 'LOGIN_FAILED',
        identifier: input.identifier,
        login: 'FAILURE',
        details: { reason: 'UNKNOWN_ACCOUNT' },
      });
      throw invalidCredentials();
    }

    const now = this.now();
    if (account.lockedUntil && account.lockedUntil > now) {
      await this.event({ type: 'LOGIN_BLOCKED', account, login: 'LOCKED' });
      throw this.locked(account.lockedUntil, now);
    }

    const valid = account.passwordHash
      ? await passwords.verify(account.passwordHash, input.password)
      : (await spendVerifyTime(input.password), false);
    if (!valid) {
      const failures = await guards.failure(account.id, lockout.windowSeconds);
      const lockUntil =
        failures >= lockout.maxFailures
          ? new Date(now.getTime() + lockout.lockSeconds * 1000)
          : null;
      await store.recordFailedLogin(account, lockUntil);
      await this.event({ type: 'LOGIN_FAILED', account, login: 'FAILURE', details: { failures } });
      if (lockUntil) await this.event({ type: 'ACCOUNT_LOCKED', account });
      throw invalidCredentials();
    }

    // Status is checked only after the password, so it reveals nothing to someone guessing.
    if (account.status === 'DISABLED') {
      await this.event({ type: 'LOGIN_BLOCKED', account, details: { reason: 'DISABLED' } });
      throw new ApiError('AUTH_ACCOUNT_DISABLED', 'This account has been disabled.');
    }
    if (account.status === 'LOCKED') {
      await this.event({ type: 'LOGIN_BLOCKED', account, login: 'LOCKED' });
      throw new ApiError(
        'AUTH_ACCOUNT_LOCKED',
        'This account is locked. Contact an administrator.',
      );
    }

    const rehash =
      account.passwordHash && passwords.isOutdated(account.passwordHash)
        ? await passwords.hash(input.password)
        : null;
    const policy = AUTH_POLICY.session[client.platform];
    const absoluteExpiresAt = new Date(now.getTime() + policy.absoluteSeconds * 1000);
    const refreshExpiresAt = refreshExpiry(now, policy.idleSeconds, absoluteExpiresAt);
    const sessionId = randomUUID();
    const refreshToken = randomToken();
    await store.completeLogin(
      account,
      {
        id: sessionId,
        userId: account.id,
        platform: client.platform,
        deviceName: input.deviceName,
        clientVersion: client.clientVersion,
        idleExpiresAt: refreshExpiresAt,
        absoluteExpiresAt,
        refresh: { familyId: randomUUID(), token: refreshToken, expiresAt: refreshExpiresAt },
      },
      rehash,
    );
    await guards.clearFailures(account.id);
    await this.event({
      type: 'LOGIN_SUCCEEDED',
      account,
      login: 'SUCCESS',
      details: { sessionId },
    });

    return {
      accessToken: await this.deps.tokens.sign(principalOf(account, sessionId)),
      expiresIn: this.accessTtlSeconds,
      sessionId,
      refreshToken,
      refreshExpiresAt,
      mustChangePassword: account.mustChangePassword,
    };
  }

  async refresh(refreshToken: string, client: ClientInfo): Promise<Tokens> {
    const next = randomToken();
    const result = await this.deps.store.rotateRefreshToken(
      refreshToken,
      { token: next, idleSeconds: AUTH_POLICY.session[client.platform].idleSeconds },
      this.now(),
    );
    if (result.outcome === 'reused') {
      await this.deps.guards.revoke([result.sessionId], this.accessTtlSeconds);
      await this.event({
        type: 'REFRESH_REUSE_DETECTED',
        userId: result.userId,
        organizationId: result.organizationId,
        details: { sessionId: result.sessionId },
      });
      throw sessionEnded();
    }
    if (result.outcome !== 'ok') throw sessionEnded();
    return {
      accessToken: await this.deps.tokens.sign(principalOf(result.account, result.sessionId)),
      expiresIn: this.accessTtlSeconds,
      sessionId: result.sessionId,
      refreshToken: next,
      refreshExpiresAt: result.refreshExpiresAt,
      mustChangePassword: result.account.mustChangePassword,
    };
  }

  async logout(principal: Principal): Promise<void> {
    const revoked = await this.deps.store.revokeSession(principal.sessionId, 'LOGOUT');
    await this.deps.guards.revoke(revoked, this.accessTtlSeconds);
    await this.event({ type: 'LOGOUT', principal });
  }

  async logoutAll(principal: Principal): Promise<number> {
    const revoked = await this.deps.store.revokeAllSessions(principal.userId, 'LOGOUT_ALL');
    await this.deps.guards.revoke(revoked, this.accessTtlSeconds);
    await this.event({ type: 'LOGOUT_ALL', principal, details: { sessions: revoked.length } });
    return revoked.length;
  }

  /**
   * Sends a reset link if the address belongs to an account that may sign in. The caller always
   * gets the same answer, and the e-mail goes out in the background so timing reveals nothing
   * either (AUTH-012).
   */
  async forgotPassword(email: string, client: ClientInfo): Promise<void> {
    const { store, guards } = this.deps;
    const limit = await guards.hit(`forgot:ip:${client.ip}`, AUTH_POLICY.rateLimits.forgotPerIp);
    if (!limit.allowed) throw tooMany(limit.retryAfter);

    const match = await store.findLoginAccount(email);
    const account = match ? await store.account(match.organizationId, match.userId) : null;
    if (!account || account.email.toLowerCase() !== email || account.status === 'DISABLED') {
      await this.event({ type: 'PASSWORD_RESET_REQUESTED', identifier: email, outcome: 'FAILURE' });
      return;
    }
    const perAccount = await guards.hit(
      `forgot:user:${account.id}`,
      AUTH_POLICY.rateLimits.forgotPerAccount,
    );
    if (!perAccount.allowed) return;

    const token = randomToken();
    await store.createResetToken(
      account.id,
      token,
      new Date(this.now().getTime() + AUTH_POLICY.resetTokenSeconds * 1000),
    );
    await this.event({ type: 'PASSWORD_RESET_REQUESTED', account });
    const link = `${this.deps.publicBaseUrl.replace(/\/+$/, '')}/reset-password#token=${token}`;
    void this.deps.mailer
      .send(resetPasswordMail(account, link, AUTH_POLICY.resetTokenSeconds / 60))
      .catch((err: unknown) => this.deps.logger.error({ err }, 'password reset e-mail failed'));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { store } = this.deps;
    const now = this.now();
    const owner = await store.resetTokenOwner(token, now);
    const account = owner ? await store.account(owner.organizationId, owner.userId) : null;
    if (!account || account.status === 'DISABLED') throw this.resetLinkInvalid();

    await this.checkNewPassword(account, newPassword);
    const revoked = await store.setPassword({
      account,
      passwordHash: await passwords.hash(newPassword),
      resetToken: token,
      now,
      revokeSessions: true,
      reason: 'PASSWORD_RESET',
    });
    if (!revoked) throw this.resetLinkInvalid();
    await this.deps.guards.revoke(revoked, this.accessTtlSeconds);
    await this.deps.guards.clearFailures(account.id);
    await this.event({ type: 'PASSWORD_RESET_COMPLETED', account });
  }

  async changePassword(
    principal: Principal,
    input: { currentPassword: string; newPassword: string; revokeOtherSessions: boolean },
  ): Promise<void> {
    const { store, guards } = this.deps;
    const limit = await guards.hit(
      `change:user:${principal.userId}`,
      AUTH_POLICY.rateLimits.changePerUser,
    );
    if (!limit.allowed) throw tooMany(limit.retryAfter);

    const account = await store.account(principal.organizationId, principal.userId);
    if (!account?.passwordHash) throw sessionEnded();
    if (!(await passwords.verify(account.passwordHash, input.currentPassword))) {
      await this.event({ type: 'PASSWORD_CHANGE_FAILED', principal });
      throw fieldError('currentPassword', 'validation.passwordIncorrect');
    }
    if (input.newPassword === input.currentPassword) {
      throw fieldError('newPassword', 'validation.passwordUnchanged');
    }
    await this.checkNewPassword(account, input.newPassword);
    const revoked = await store.setPassword({
      account,
      passwordHash: await passwords.hash(input.newPassword),
      now: this.now(),
      revokeSessions: input.revokeOtherSessions,
      keepSession: principal.sessionId,
      reason: 'PASSWORD_CHANGED',
    });
    await guards.revoke(revoked ?? [], this.accessTtlSeconds);
    await this.event({
      type: 'PASSWORD_CHANGED',
      principal,
      details: { otherSessionsRevoked: revoked?.length ?? 0 },
    });
  }

  private async checkNewPassword(account: Account, password: string): Promise<void> {
    const problems: PasswordProblem[] = localPasswordProblems(password, [
      account.email,
      account.employeeCode,
    ]);
    if (problems.length === 0 && (await this.deps.breached.isBreached(password))) {
      problems.push('validation.passwordBreached');
    }
    if (problems[0]) throw fieldError('newPassword', problems[0]);
  }

  private locked(until: Date, now: Date): ApiError {
    const retryAfter = Math.ceil((until.getTime() - now.getTime()) / 1000);
    return new ApiError('AUTH_ACCOUNT_LOCKED', 'Too many failed attempts. Try again later.', {
      retryAfter,
    });
  }

  private resetLinkInvalid(): ApiError {
    return new ApiError('AUTH_TOKEN_EXPIRED', 'This reset link has expired or was already used.', {
      reason: 'RESET_LINK_INVALID',
    });
  }

  private async event(event: {
    type: string;
    account?: Account;
    principal?: Principal;
    userId?: string;
    organizationId?: string;
    identifier?: string;
    outcome?: 'SUCCESS' | 'FAILURE';
    login?: 'SUCCESS' | 'FAILURE' | 'LOCKED';
    details?: Record<string, unknown>;
  }): Promise<void> {
    const failed = /FAILED|BLOCKED|LOCKED|REUSE/.test(event.type);
    try {
      await this.deps.store.securityEvent({
        type: event.type,
        outcome: event.outcome ?? (failed ? 'FAILURE' : 'SUCCESS'),
        organizationId:
          event.account?.organizationId ?? event.principal?.organizationId ?? event.organizationId,
        userId: event.account?.id ?? event.principal?.userId ?? event.userId,
        identifier: event.identifier,
        ...(event.details && { details: event.details }),
        ...(event.login && { login: event.login }),
      });
    } catch (err) {
      this.deps.logger.error({ err, type: event.type }, 'security event could not be recorded');
    }
  }
}

/** A validation problem on one field; the message is an i18n key the clients translate. */
export function fieldError(field: string, message: string): ApiError {
  return new ApiError('VALIDATION_FAILED', 'Check the highlighted field.', {
    fieldErrors: { [field]: [message] },
  });
}
