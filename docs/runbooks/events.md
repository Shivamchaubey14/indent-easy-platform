# Runbook: domain events, worker and scheduler

Every business change records a **domain event** in the same database transaction as the change
(SRS §22). The worker delivers events to consumers such as notifications, documents, search and
integrations. The scheduler registers recurring maintenance.

```text
command ─ one transaction ─► business rows + audit + events.outbox
                                               │ NOTIFY outbox_new (+ 1 s poll)
worker: outbox relay ──► BullMQ queue per consumer (events.<consumer>) ──► consumer
                                                     │ all retries failed
                                                     └► events.dead_letter + events.<consumer>.dlq
scheduler (leader) ──► maintenance schedules ──► worker runs them
```

## Guarantees

| Property | How |
|---|---|
| An event exists if and only if the change committed | `appendEvent(client, …)` writes to `events.outbox` inside the business transaction |
| Every consumer gets every event it subscribes to, at least once | The relay marks a row published only after every queue accepted it; rows are claimed with `FOR UPDATE SKIP LOCKED`, so several workers can run |
| Each consumer applies an event once | Inbox `events.processed_event (consumer, event_id)`, claimed in the consumer's own transaction |
| Ordered consumers apply an aggregate's events in version order | `events.consumer_position`: the next version is processed, an older one is skipped, a gap is deferred and retried |
| Failures are retried, then parked | 5 s, 30 s, 2 min, 10 min, 30 min (±20% jitter), then `events.dead_letter` plus an `alert: DeadLetter` log line |

## Writing events

```ts
await withOrgContext(pool, organizationId, async (client) => {
  // ...business writes...
  await appendEvent(client, {
    eventType: 'IndentSubmitted',
    organizationId,
    aggregateType: 'Indent',
    aggregateId: indent.id,
    aggregateVersion: indent.version,
    actor: { type: 'USER', id: userId },
    payload: { /* typed by the event contract */ },
  });
});
```

The payload is typed from `packages/events/schema/event-contracts.schema.json`, and validated again
at runtime: an event that breaks its contract throws, and the whole transaction rolls back. The
request and correlation IDs are copied from the current request automatically.

## Adding a consumer

Add it to `CONSUMERS` in `apps/api/src/events/consumers.ts`:

```ts
{
  name: 'notifications',     // never rename: it keys the queue, inbox and dead letters
  events: ['IndentSubmitted', 'ApprovalTaskCreated'],
  ordered: false,            // true only if it must apply an aggregate's events in order
  concurrency: 4,
  async handle(event, { client, logger }) {
    // Use `client` for database writes: they commit together with the inbox record.
  },
}
```

- Handlers must be **idempotent in their external effects**, such as sending an SMS: the inbox
  prevents double processing, but a crash after the SMS was sent and before commit means one
  retry. Use a provider dedupe key.
- **Ordered consumers added later** start with no position. An aggregate whose history began
  earlier is deferred until its position is backfilled; backfill before enabling one.
- To run only some consumers in a worker deployment, set `WORKER_CONSUMERS=event-log,notifications`.

## Scheduled maintenance

| Job | When (Asia/Kolkata) | What |
|---|---|---|
| `outbox-prune` | 02:30 daily | Delete outbox rows published more than 7 days ago |
| `inbox-prune` | 02:45 daily | Delete consumer inbox rows older than 30 days |
| `outbox-lag-check` | every minute | `alert: OutboxLagging` if an event has waited more than 5 minutes to be published |

Jobs are defined in `apps/api/src/events/maintenance.ts`. The scheduler leader registers them in
BullMQ and removes any that no longer exist; the worker runs them. Only one scheduler leads at a
time, through a Redis lock (`ie:scheduler:leader`) renewed every 5 s:
- **A leader that stops normally** releases the lock, and a standby takes over at its next check,
  within 5 s.
- **A leader that crashes** leaves its lock to expire, so takeover takes up to 15 s. Measured on
  the laptop: about 15 s after a hard kill.

## Running locally

```sh
pnpm infra:up && pnpm db:migrate
pnpm worker:dev        # relay + consumers + maintenance; metrics and health on METRICS_PORT
pnpm scheduler:dev     # use another METRICS_PORT if the worker is running too
pnpm test:integration  # event pipeline tests need PostgreSQL and Redis
```

## Watching it

| Signal | Where |
|---|---|
| `ie_outbox_unpublished`, `ie_outbox_oldest_unpublished_seconds` | Worker metrics (`:9464/metrics`) |
| `ie_events_processed_total{consumer,result}` | `processed`, `duplicate`, `skipped`, `dead-lettered` |
| `ie_events_dead_lettered_total{consumer}` | Should stay at 0; every increase logs `alert: DeadLetter` |
| `ie_queue_jobs{queue,state}` | Waiting, active, delayed and failed jobs per queue |
| `ie_scheduler_leader` | 1 on exactly one scheduler |
| Worker `/health/ready` | Database, Redis, and a relay pass within the last 10 s |

## Dead letters

`events.dead_letter` holds the full event, the last error and the attempt count. The admin replay
operation (`replayDeadLetter`, SRS §22.2) arrives with the admin console. Until then, fix the
cause, then ask a developer to re-enqueue the event from the row.
