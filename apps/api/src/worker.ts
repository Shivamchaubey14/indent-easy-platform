/*
 * Worker process (`node dist/worker.js`): relays the outbox to BullMQ, runs the event consumers
 * and the scheduled maintenance jobs. Scale by running more copies: the relay claims rows with
 * SKIP LOCKED and each job is processed by one worker.
 */
import type { DomainEvent } from '@ie/events';
import { Queue, Worker, type Job } from 'bullmq';
import { Counter, Gauge } from 'prom-client';
import { CONSUMERS } from './events/consumers.js';
import { MAINTENANCE_JOBS } from './events/maintenance.js';
import { OutOfOrderError } from './events/ordering.js';
import { processEvent, recordDeadLetter } from './events/process.js';
import {
  MAINTENANCE_QUEUE,
  consumerQueue,
  deadLetterQueue,
  queueSettings,
  retryDelay,
} from './events/queues.js';
import { OutboxRelay, outboxLag } from './events/relay.js';
import { onShutdown, processLogger, readConfig } from './shared/bootstrap.js';
import { createPool } from './shared/database.js';
import { Health } from './shared/health.js';
import { createMetrics, startMetricsServer } from './shared/metrics.js';
import { createRedis } from './shared/redis.js';

const config = readConfig();
const logger = processLogger('worker', config);
const pool = createPool(config.database, logger);
const redis = createRedis(config.redis.url, logger);
redis.connect().catch(() => undefined);
const queues = queueSettings(config.redis.url);

const wanted = config.worker.consumers;
const unknown = wanted?.filter((name) => !CONSUMERS.some((c) => c.name === name)) ?? [];
if (unknown.length) {
  logger.fatal(
    { unknown, known: CONSUMERS.map((c) => c.name) },
    'WORKER_CONSUMERS names unknown consumers',
  );
  process.exit(1);
}
const active = CONSUMERS.filter((c) => !wanted || wanted.includes(c.name));

// --- Metrics -------------------------------------------------------------------------------------
const metrics = createMetrics();
const processed = new Counter({
  name: 'ie_events_processed_total',
  help: 'Events handled by consumers, by result',
  labelNames: ['consumer', 'result'] as const,
  registers: [metrics.registry],
});
const deadLettered = new Counter({
  name: 'ie_events_dead_lettered_total',
  help: 'Events that exhausted their retries',
  labelNames: ['consumer'] as const,
  registers: [metrics.registry],
});
new Gauge({
  name: 'ie_outbox_unpublished',
  help: 'Events committed but not yet published',
  registers: [metrics.registry],
  async collect() {
    this.set((await outboxLag(pool)).unpublished);
  },
});
new Gauge({
  name: 'ie_outbox_oldest_unpublished_seconds',
  help: 'Age of the oldest unpublished event',
  registers: [metrics.registry],
  async collect() {
    this.set((await outboxLag(pool)).oldestSeconds);
  },
});
const inspected = [...active.map((c) => consumerQueue(c.name)), MAINTENANCE_QUEUE].map(
  (name) => new Queue(name, { connection: queues.connection, prefix: queues.prefix }),
);
new Gauge({
  name: 'ie_queue_jobs',
  help: 'Jobs per queue and state',
  labelNames: ['queue', 'state'] as const,
  registers: [metrics.registry],
  async collect() {
    for (const queue of inspected) {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
      for (const [state, n] of Object.entries(counts)) this.set({ queue: queue.name, state }, n);
    }
  },
});

// --- Outbox relay --------------------------------------------------------------------------------
// Publishes for every consumer, not just the ones this worker runs: others may run elsewhere.
const relay = new OutboxRelay({ pool, listenUrl: config.database.url, queues, logger });

// --- Consumers -----------------------------------------------------------------------------------
const backoffStrategy = (attemptsMade: number) => retryDelay(attemptsMade);

const consumerWorkers = active.map((consumer) => {
  const dlq = new Queue(deadLetterQueue(consumer.name), {
    connection: queues.connection,
    prefix: queues.prefix,
  });
  const worker = new Worker<DomainEvent>(
    consumerQueue(consumer.name),
    async (job: Job<DomainEvent>) => {
      const result = await processEvent(pool, consumer, job.data, logger);
      processed.inc({ consumer: consumer.name, result });
      return result;
    },
    {
      connection: queues.connection,
      prefix: queues.prefix,
      concurrency: consumer.concurrency,
      settings: { backoffStrategy },
    },
  );
  worker.on('failed', (job, err) => {
    if (!job) return;
    const event = job.data;
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (!final) {
      const level = err instanceof OutOfOrderError ? 'info' : 'warn';
      logger[level](
        { err, consumer: consumer.name, eventId: event.eventId, attempt: job.attemptsMade },
        'event processing failed; will retry',
      );
      return;
    }
    processed.inc({ consumer: consumer.name, result: 'dead-lettered' });
    deadLettered.inc({ consumer: consumer.name });
    logger.error(
      {
        err,
        consumer: consumer.name,
        eventId: event.eventId,
        eventType: event.eventType,
        alert: 'DeadLetter',
      },
      'event moved to the dead-letter table after all retries',
    );
    void recordDeadLetter(pool, consumer.name, event, err.message, job.attemptsMade)
      .then(() => dlq.add(job.name, event, { jobId: event.eventId }))
      .catch((dlqErr: unknown) => logger.error({ err: dlqErr }, 'could not record dead letter'));
  });
  worker.on('error', (err) =>
    logger.warn({ err, consumer: consumer.name }, 'consumer worker error'),
  );
  return { worker, dlq };
});

// --- Maintenance ---------------------------------------------------------------------------------
const maintenanceWorker = new Worker(
  MAINTENANCE_QUEUE,
  async (job) => {
    const task = MAINTENANCE_JOBS.find((t) => t.name === job.name);
    if (!task) throw new Error(`unknown maintenance job ${job.name}`);
    const result = await task.run(pool, logger);
    logger.info({ job: job.name, ...result }, 'maintenance job done');
    return result;
  },
  { connection: queues.connection, prefix: queues.prefix, concurrency: 1 },
);
maintenanceWorker.on('failed', (job, err) =>
  logger.error({ err, job: job?.name }, 'maintenance job failed'),
);

// --- Health and lifecycle ------------------------------------------------------------------------
const health = new Health(
  {
    database: () => pool.query('SELECT 1'),
    redis: () => redis.ping(),
    relay: () =>
      relay.lastRunAt && Date.now() - relay.lastRunAt <= 10_000
        ? Promise.resolve()
        : Promise.reject(new Error('outbox relay has not completed a pass in 10 s')),
  },
  logger,
  500,
);
const opsServer = startMetricsServer(metrics, config.http.metricsPort, logger, health);

relay
  .start()
  .then(() => {
    health.markStarted();
    logger.info(
      { consumers: active.map((c) => c.name), metricsPort: config.http.metricsPort },
      'worker started',
    );
  })
  .catch((err: unknown) => {
    logger.fatal({ err }, 'could not start the outbox relay');
    process.exit(1);
  });

onShutdown(logger, async () => {
  health.startDraining();
  await relay.stop();
  // close() waits for jobs in progress to finish.
  await Promise.all(consumerWorkers.map(({ worker }) => worker.close()));
  await maintenanceWorker.close();
  await Promise.all([
    ...consumerWorkers.map(({ dlq }) => dlq.close()),
    ...inspected.map((q) => q.close()),
  ]);
  opsServer.close();
  await Promise.allSettled([pool.end(), redis.quit()]);
});
