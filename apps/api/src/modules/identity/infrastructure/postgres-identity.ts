import { currentContext } from '../../../shared/context.js';
import { type Pool, type PoolClient, withOrgContext } from '../../../shared/database.js';
import type { AccountStatus, Platform } from '../domain/policy.js';
import { tokenHash } from './secrets.js';

export interface Account {
  id: string;
  organizationId: string;
  email: string;
  employeeCode: string | null;
  displayName: string;
  locale: 'en' | 'hi';
  status: AccountStatus;
  passwordHash: string | null;
  mustChangePassword: boolean;
  lockedUntil: Date | null;
  rolesVersion: number;
}

export interface NewSession {
  id: string;
  userId: string;
  platform: Platform;
  deviceName: string | undefined;
  clientVersion: string | undefined;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  refresh: { familyId: string; token: string; expiresAt: Date };
}

export type RotateResult =
  | { outcome: 'ok'; account: Account; sessionId: string; refreshExpiresAt: Date }
  | { outcome: 'unknown' | 'expired' | 'revoked' | 'inactive' }
  | { outcome: 'reused'; sessionId: string; userId: string; organizationId: string };

const ACCOUNT_COLUMNS = `
  id, organization_id, email, employee_code, display_name, preferred_locale, status,
  password_hash, must_change_password, locked_until, roles_version`;

interface AccountRow {
  id: string;
  organization_id: string;
  email: string;
  employee_code: string | null;
  display_name: string;
  preferred_locale: string;
  status: AccountStatus;
  password_hash: string | null;
  must_change_password: boolean;
  locked_until: Date | null;
  roles_version: number;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    employeeCode: row.employee_code,
    displayName: row.display_name,
    locale: row.preferred_locale === 'HI' ? 'hi' : 'en',
    status: row.status,
    passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password,
    lockedUntil: row.locked_until,
    rolesVersion: row.roles_version,
  };
}

async function inTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function loadAccount(
  client: PoolClient,
  organizationId: string,
  userId: string,
): Promise<Account | null> {
  const { rows } = await client.query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM identity.app_user WHERE id = $1 AND organization_id = $2`,
    [userId, organizationId],
  );
  return rows[0] ? toAccount(rows[0]) : null;
}

async function revokeSessions(
  client: PoolClient,
  where: string,
  params: unknown[],
  reason: string,
): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(
    `UPDATE identity.session SET revoked_at = now(), revoke_reason = $${params.length + 1}
     WHERE revoked_at IS NULL AND ${where} RETURNING id`,
    [...params, reason],
  );
  return rows.map((r) => r.id);
}

/**
 * Identity persistence. Sessions, refresh and reset tokens carry no organisation column (they hang
 * off a user), so they are read without an organisation context; anything about the user itself
 * goes through withOrgContext so row-level security applies.
 */
export class PostgresIdentity {
  constructor(private readonly pool: Pool) {}

  /** The one account an identifier belongs to, or null (none, or ambiguous). */
  async findLoginAccount(
    identifier: string,
  ): Promise<{ userId: string; organizationId: string } | null> {
    const { rows } = await this.pool.query<{ user_id: string; organization_id: string }>(
      'SELECT user_id, organization_id FROM identity.find_login_account($1)',
      [identifier],
    );
    return rows.length === 1 && rows[0]
      ? { userId: rows[0].user_id, organizationId: rows[0].organization_id }
      : null;
  }

  account(organizationId: string, userId: string): Promise<Account | null> {
    return withOrgContext(this.pool, organizationId, (client) =>
      loadAccount(client, organizationId, userId),
    );
  }

  async recordFailedLogin(account: Account, lockUntil: Date | null): Promise<void> {
    await withOrgContext(this.pool, account.organizationId, (client) =>
      client.query(
        `UPDATE identity.app_user
         SET failed_attempts = failed_attempts + 1, locked_until = COALESCE($2, locked_until)
         WHERE id = $1`,
        [account.id, lockUntil],
      ),
    );
  }

  /** Clears failure state, upgrades an outdated hash and opens the session with its first token. */
  async completeLogin(account: Account, session: NewSession, rehash: string | null): Promise<void> {
    const context = currentContext();
    await withOrgContext(this.pool, account.organizationId, async (client) => {
      await client.query(
        `UPDATE identity.app_user
         SET failed_attempts = 0, locked_until = NULL, last_login_at = now(),
             password_hash = COALESCE($2, password_hash)
         WHERE id = $1`,
        [account.id, rehash],
      );
      await client.query(
        `INSERT INTO identity.session
           (id, user_id, device_name, platform, client_version, ip, user_agent,
            idle_expires_at, absolute_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          session.id,
          session.userId,
          session.deviceName ?? null,
          session.platform,
          session.clientVersion ?? null,
          context?.ip ?? null,
          context?.userAgent ?? null,
          session.idleExpiresAt,
          session.absoluteExpiresAt,
        ],
      );
      await client.query(
        `INSERT INTO identity.refresh_token (session_id, family_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [
          session.id,
          session.refresh.familyId,
          tokenHash(session.refresh.token),
          session.refresh.expiresAt,
        ],
      );
    });
  }

  /**
   * Swaps a refresh token for a new one in the same family (AUTH-006). A token that was already
   * used means it was copied: the whole session is revoked.
   */
  rotateRefreshToken(
    token: string,
    next: { token: string; idleSeconds: number },
    now: Date,
  ): Promise<RotateResult> {
    return inTransaction(this.pool, async (client): Promise<RotateResult> => {
      const { rows } = await client.query<{
        id: string;
        family_id: string;
        used_at: Date | null;
        expires_at: Date;
        session_id: string;
        user_id: string;
        revoked_at: Date | null;
        absolute_expires_at: Date;
      }>(
        `SELECT rt.id, rt.family_id, rt.used_at, rt.expires_at,
                s.id AS session_id, s.user_id, s.revoked_at, s.absolute_expires_at
         FROM identity.refresh_token rt JOIN identity.session s ON s.id = rt.session_id
         WHERE rt.token_hash = $1
         FOR UPDATE OF rt, s`,
        [tokenHash(token)],
      );
      const row = rows[0];
      if (!row) return { outcome: 'unknown' };
      if (row.revoked_at) return { outcome: 'revoked' };

      const organization = await client.query<{ org: string | null }>(
        'SELECT identity.user_organization($1) AS org',
        [row.user_id],
      );
      const organizationId = organization.rows[0]?.org;
      if (!organizationId) return { outcome: 'unknown' };

      if (row.used_at) {
        await revokeSessions(client, 'id = $1', [row.session_id], 'REFRESH_REUSE');
        return {
          outcome: 'reused',
          sessionId: row.session_id,
          userId: row.user_id,
          organizationId,
        };
      }
      if (row.expires_at <= now || row.absolute_expires_at <= now) return { outcome: 'expired' };

      await client.query("SELECT set_config('app.org_id', $1, true)", [organizationId]);
      const account = await loadAccount(client, organizationId, row.user_id);
      if (!account || account.status !== 'ACTIVE') {
        await revokeSessions(client, 'id = $1', [row.session_id], 'ACCOUNT_INACTIVE');
        return { outcome: 'inactive' };
      }

      const expiresAt = new Date(
        Math.min(now.getTime() + next.idleSeconds * 1000, row.absolute_expires_at.getTime()),
      );
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO identity.refresh_token (session_id, family_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [row.session_id, row.family_id, tokenHash(next.token), expiresAt],
      );
      await client.query(
        'UPDATE identity.refresh_token SET used_at = $2, replaced_by_id = $3 WHERE id = $1',
        [row.id, now, inserted.rows[0]?.id],
      );
      await client.query(
        `UPDATE identity.session SET last_seen_at = $2, idle_expires_at = $3 WHERE id = $1`,
        [row.session_id, now, expiresAt],
      );
      return { outcome: 'ok', account, sessionId: row.session_id, refreshExpiresAt: expiresAt };
    });
  }

  revokeSession(sessionId: string, reason: string): Promise<string[]> {
    return inTransaction(this.pool, (client) =>
      revokeSessions(client, 'id = $1', [sessionId], reason),
    );
  }

  /** Revokes every open session of a user, optionally keeping one (the caller's). */
  revokeAllSessions(userId: string, reason: string, keep?: string): Promise<string[]> {
    return inTransaction(this.pool, (client) =>
      keep
        ? revokeSessions(client, 'user_id = $1 AND id <> $2', [userId, keep], reason)
        : revokeSessions(client, 'user_id = $1', [userId], reason),
    );
  }

  /** Stores a new reset token; any earlier unused one stops working. */
  async createResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await client.query(
        'UPDATE identity.password_reset_token SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
        [userId],
      );
      await client.query(
        `INSERT INTO identity.password_reset_token (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash(token), expiresAt],
      );
    });
  }

  /** The user a reset token belongs to, if it is unused and unexpired. Does not consume it. */
  async resetTokenOwner(
    token: string,
    now: Date,
  ): Promise<{ userId: string; organizationId: string } | null> {
    const { rows } = await this.pool.query<{ user_id: string; org: string | null }>(
      `SELECT user_id, identity.user_organization(user_id) AS org
       FROM identity.password_reset_token
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2`,
      [tokenHash(token), now],
    );
    const row = rows[0];
    return row?.org ? { userId: row.user_id, organizationId: row.org } : null;
  }

  /**
   * Sets a new password. With a reset token, the token is consumed in the same transaction (null
   * if someone else used it first). All sessions are revoked except `keepSession`.
   */
  setPassword(input: {
    account: Account;
    passwordHash: string;
    resetToken?: string;
    now: Date;
    revokeSessions: boolean;
    keepSession?: string;
    reason: string;
  }): Promise<string[] | null> {
    const { account } = input;
    return withOrgContext(this.pool, account.organizationId, async (client) => {
      if (input.resetToken) {
        const used = await client.query(
          `UPDATE identity.password_reset_token SET used_at = $2
           WHERE token_hash = $1 AND user_id = $3 AND used_at IS NULL AND expires_at > $2`,
          [tokenHash(input.resetToken), input.now, account.id],
        );
        if (used.rowCount !== 1) return null;
      }
      await client.query(
        `UPDATE identity.app_user
         SET password_hash = $2, password_changed_at = $3, must_change_password = false,
             failed_attempts = 0, locked_until = NULL,
             status = CASE WHEN status = 'INVITED' THEN 'ACTIVE' ELSE status END,
             updated_at = $3, updated_by = $1, version = version + 1
         WHERE id = $1`,
        [account.id, input.passwordHash, input.now],
      );
      if (!input.revokeSessions) return [];
      return input.keepSession
        ? revokeSessions(
            client,
            'user_id = $1 AND id <> $2',
            [account.id, input.keepSession],
            input.reason,
          )
        : revokeSessions(client, 'user_id = $1', [account.id], input.reason);
    });
  }

  /**
   * Creates an active account with a password. Used by the `create-user` command to set up the
   * first administrator; user management through the admin console arrives later in Phase 1.
   */
  async createAccount(input: {
    organizationId: string;
    email: string;
    displayName: string;
    employeeCode?: string | undefined;
    passwordHash: string;
    mustChangePassword: boolean;
  }): Promise<string> {
    const { rows } = await withOrgContext(this.pool, input.organizationId, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO identity.app_user
           (organization_id, email, display_name, employee_code, status, password_hash,
            password_changed_at, must_change_password)
         VALUES ($1, lower($2), $3, $4, 'ACTIVE', $5, now(), $6)
         RETURNING id`,
        [
          input.organizationId,
          input.email,
          input.displayName,
          input.employeeCode ?? null,
          input.passwordHash,
          input.mustChangePassword,
        ],
      ),
    );
    return rows[0]!.id;
  }

  /** Security events (§33) and the sign-in history. Never blocks the request on failure. */
  async securityEvent(event: {
    type: string;
    outcome: 'SUCCESS' | 'FAILURE';
    organizationId?: string | undefined;
    userId?: string | undefined;
    identifier?: string | undefined;
    details?: Record<string, unknown>;
    login?: 'SUCCESS' | 'FAILURE' | 'LOCKED';
  }): Promise<void> {
    const context = currentContext();
    await this.pool.query(
      `INSERT INTO audit.security_event
         (organization_id, type, user_id, email_hash, ip, user_agent, outcome, details, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        event.organizationId ?? null,
        event.type,
        event.userId ?? null,
        event.identifier ? tokenHash(event.identifier.trim().toLowerCase()) : null,
        context?.ip ?? null,
        context?.userAgent ?? null,
        event.outcome,
        event.details ?? null,
        context?.requestId ?? null,
      ],
    );
    if (event.login) {
      await this.pool.query(
        `INSERT INTO audit.login_event (user_id, outcome, method, ip, device)
         VALUES ($1, $2, 'PASSWORD', $3, $4)`,
        [event.userId ?? null, event.login, context?.ip ?? null, context?.clientName ?? null],
      );
    }
  }
}
