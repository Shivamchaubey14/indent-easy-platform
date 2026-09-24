import { Router } from 'express';
import type { Logger } from './logging.js';

export type HealthCheck = () => Promise<unknown>;

export interface CheckResult {
  status: 'ok' | 'fail';
  latencyMs: number;
}

export interface ReadinessReport {
  status: 'ok' | 'fail';
  checks: Record<string, CheckResult>;
}

/** Tracks process lifecycle and runs dependency checks for the Kubernetes probes (SRS §44.3). */
export class Health {
  private started = false;
  private draining = false;

  constructor(
    private readonly checks: Record<string, HealthCheck>,
    private readonly logger: Logger,
    private readonly timeoutMs = 200,
  ) {}

  markStarted(): void {
    this.started = true;
  }

  startDraining(): void {
    this.draining = true;
  }

  get isStarted(): boolean {
    return this.started;
  }

  async readiness(): Promise<ReadinessReport> {
    const entries = await Promise.all(
      Object.entries(this.checks).map(
        async ([name, check]) => [name, await this.run(name, check)] as const,
      ),
    );
    const checks: Record<string, CheckResult> = Object.fromEntries(entries);
    if (this.draining) checks['draining'] = { status: 'fail', latencyMs: 0 };
    const ok = Object.values(checks).every((c) => c.status === 'ok');
    return { status: ok ? 'ok' : 'fail', checks };
  }

  private async run(name: string, check: HealthCheck): Promise<CheckResult> {
    const started = performance.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        check(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`timed out after ${this.timeoutMs} ms`)),
            this.timeoutMs,
          );
        }),
      ]);
      return { status: 'ok', latencyMs: Math.round(performance.now() - started) };
    } catch (err) {
      // Details stay in the logs; probes are unauthenticated.
      this.logger.warn({ err, check: name }, 'readiness check failed');
      return { status: 'fail', latencyMs: Math.round(performance.now() - started) };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function healthRouter(health: Health): Router {
  const router = Router();
  router.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });
  router.get('/health/startup', (_req, res) => {
    res.status(health.isStarted ? 200 : 503).json({ status: health.isStarted ? 'ok' : 'fail' });
  });
  router.get('/health/ready', async (_req, res) => {
    const report = await health.readiness();
    res.status(report.status === 'ok' ? 200 : 503).json(report);
  });
  return router;
}
