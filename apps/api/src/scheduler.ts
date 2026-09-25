/*
 * Scheduler process (`node dist/scheduler.js`): the leader registers the maintenance schedules
 * in BullMQ; the worker processes run them. Run one or two copies; only the leader acts.
 */
import { Queue } from 'bullmq';
import { Gauge } from 'prom-client';
import { MAINTENANCE_JOBS } from './events/maintenance.js';
import { MAINTENANCE_QUEUE, queueSettings } from './events/queues.js';
import { LeaderLock } from './scheduler/leader.js';
import { onShutdown, processLogger, readConfig } from './shared/bootstrap.js';
import { Health } from './shared/health.js';
import { createMetrics, startMetricsServer } from './shared/metrics.js';
import { createRedis } from './shared/redis.js';

const config = readConfig();
const logger = processLogger('scheduler', config);
const redis = createRedis(config.redis.url, logger);
const queues = queueSettings(config.redis.url);
const maintenance = new Queue(MAINTENANCE_QUEUE, {
  connection: queues.connection,
  prefix: queues.prefix,
});

const metrics = createMetrics();
const leaderGauge = new Gauge({
  name: 'ie_scheduler_leader',
  help: '1 while this instance is the scheduler leader',
  registers: [metrics.registry],
});

/**
 * Makes BullMQ's schedules match MAINTENANCE_JOBS exactly: adds or updates each one and
 * removes schedules for jobs that no longer exist. Idempotent.
 */
async function syncSchedules(): Promise<void> {
  for (const job of MAINTENANCE_JOBS) {
    const repeat =
      'pattern' in job.schedule
        ? { pattern: job.schedule.pattern, tz: config.timezone }
        : { every: job.schedule.every };
    await maintenance.upsertJobScheduler(job.name, repeat, {
      name: job.name,
      opts: { removeOnComplete: 100, removeOnFail: 500 },
    });
  }
  const wanted = new Set(MAINTENANCE_JOBS.map((j) => j.name));
  for (const existing of await maintenance.getJobSchedulers()) {
    if (existing.key && !wanted.has(existing.key))
      await maintenance.removeJobScheduler(existing.key);
  }
  logger.info({ jobs: [...wanted] }, 'maintenance schedules registered');
}

const lock = new LeaderLock(redis, logger, 'ie:scheduler:leader', 15_000, (leader) => {
  leaderGauge.set(leader ? 1 : 0);
  if (leader) {
    syncSchedules().catch((err: unknown) => logger.error({ err }, 'could not register schedules'));
  }
});

// A standby scheduler is healthy too: readiness only needs Redis.
const health = new Health({ redis: () => redis.ping() }, logger, 500);
const opsServer = startMetricsServer(metrics, config.http.metricsPort, logger, health);

redis
  .connect()
  .catch(() => undefined)
  .finally(() => {
    lock.start();
    health.markStarted();
    logger.info({ instance: lock.id, metricsPort: config.http.metricsPort }, 'scheduler started');
  });

onShutdown(logger, async () => {
  health.startDraining();
  await lock.stop();
  await maintenance.close();
  opsServer.close();
  await redis.quit().catch(() => undefined);
});
