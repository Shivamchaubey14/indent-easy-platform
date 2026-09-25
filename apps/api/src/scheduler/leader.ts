import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { Logger } from '../shared/logging.js';

// Extend the lock only if we still hold it (atomic compare-and-extend).
const RENEW = `if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end`;
// Release only our own lock.
const RELEASE = `if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1]) else return 0 end`;

/**
 * One scheduler at a time does scheduled work (SRS §15.1). Leadership is a Redis key with a
 * time-to-live, taken with SET NX and renewed well before it expires. If the leader dies, its key
 * expires and another instance takes over within `ttlMs`.
 */
export class LeaderLock {
  readonly id = randomUUID();
  private leader = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly key = 'ie:scheduler:leader',
    private readonly ttlMs = 15_000,
    private readonly onChange: (leader: boolean) => void = () => undefined,
  ) {}

  get isLeader(): boolean {
    return this.leader;
  }

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), Math.floor(this.ttlMs / 3));
  }

  /** One election round: renew if leading, otherwise try to become leader. */
  async tick(): Promise<void> {
    try {
      const held = this.leader
        ? (await this.redis.eval(RENEW, 1, this.key, this.id, String(this.ttlMs))) === 1
        : (await this.redis.set(this.key, this.id, 'PX', this.ttlMs, 'NX')) === 'OK';
      this.update(held);
    } catch (err) {
      // Without Redis we can't prove leadership; step down rather than risk two leaders.
      this.logger.warn({ err }, 'leader lock check failed');
      this.update(false);
    }
  }

  private update(held: boolean): void {
    if (held === this.leader) return;
    this.leader = held;
    this.logger.info(
      { instance: this.id },
      held ? 'became scheduler leader' : 'no longer scheduler leader',
    );
    this.onChange(held);
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    if (this.leader) await this.redis.eval(RELEASE, 1, this.key, this.id).catch(() => undefined);
    this.update(false);
  }
}
