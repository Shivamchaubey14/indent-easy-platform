import type { Logger } from '../../../shared/logging.js';
import type { Redis } from '../../../shared/redis.js';

const PREFIX = 'ie:auth';

/**
 * Short-lived authentication state in Redis: request limits, failed-attempt counters and the
 * session deny-list (§30.1). If Redis is unreachable these fail open and log: the database still
 * holds lockouts and revoked sessions, so the effect is limited to one access-token lifetime.
 */
export class AuthGuards {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  /** Counts a request against a fixed window; `retryAfter` is in seconds. */
  async hit(
    key: string,
    rule: { limit: number; windowSeconds: number },
  ): Promise<{ allowed: boolean; retryAfter: number }> {
    try {
      const name = `${PREFIX}:rl:${key}`;
      const result = await this.redis
        .multi()
        .incr(name)
        .expire(name, rule.windowSeconds, 'NX')
        .ttl(name)
        .exec();
      const count = Number(result?.[0]?.[1] ?? 0);
      const ttl = Number(result?.[2]?.[1] ?? rule.windowSeconds);
      return { allowed: count <= rule.limit, retryAfter: Math.max(ttl, 1) };
    } catch (err) {
      this.logger.warn({ err, key }, 'rate limit check skipped: redis unavailable');
      return { allowed: true, retryAfter: 0 };
    }
  }

  /** Records a failed sign-in and returns how many happened in the current window. */
  async failure(userId: string, windowSeconds: number): Promise<number> {
    try {
      const name = `${PREFIX}:fail:${userId}`;
      const result = await this.redis.multi().incr(name).expire(name, windowSeconds, 'NX').exec();
      return Number(result?.[0]?.[1] ?? 1);
    } catch (err) {
      this.logger.warn({ err }, 'failed-attempt counter unavailable');
      return 1;
    }
  }

  async clearFailures(userId: string): Promise<void> {
    await this.redis.del(`${PREFIX}:fail:${userId}`).catch(() => undefined);
  }

  /** Rejects the sessions' access tokens at once instead of when they expire (AUTH-009). */
  async revoke(sessionIds: readonly string[], ttlSeconds: number): Promise<void> {
    if (sessionIds.length === 0) return;
    try {
      const multi = this.redis.multi();
      for (const sid of sessionIds) multi.set(`${PREFIX}:revoked:${sid}`, '1', 'EX', ttlSeconds);
      await multi.exec();
    } catch (err) {
      this.logger.warn({ err }, 'session deny-list unavailable; tokens expire naturally');
    }
  }

  async isRevoked(sessionId: string): Promise<boolean> {
    try {
      return (await this.redis.exists(`${PREFIX}:revoked:${sessionId}`)) === 1;
    } catch {
      return false;
    }
  }
}
