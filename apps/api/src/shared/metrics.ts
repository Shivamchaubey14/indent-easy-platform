import { createServer, type Server } from 'node:http';
import type { RequestHandler } from 'express';
import { Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { currentContext } from './context.js';
import type { Health } from './health.js';
import type { Logger } from './logging.js';

export interface Metrics {
  registry: Registry;
  httpDuration: Histogram<'method' | 'route' | 'status_code'>;
}

export function createMetrics(): Metrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  const httpDuration = new Histogram({
    name: 'http_server_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5],
    registers: [registry],
  });
  return { registry, httpDuration };
}

/**
 * Records duration per route and writes one access-log line per request. Health probes are
 * logged at debug level so they don't drown out real traffic.
 */
export function accessLog(logger: Logger, metrics: Metrics): RequestHandler {
  return (req, res, next) => {
    const started = performance.now();
    const context = currentContext();
    res.on('finish', () => {
      const durationMs = Math.round(performance.now() - started);
      // Use the matched route pattern, never the raw path, to keep label cardinality bounded.
      const route = req.route?.path
        ? `${req.baseUrl}${String(req.route.path)}`
        : req.baseUrl || 'unmatched';
      metrics.httpDuration.observe(
        { method: req.method, route, status_code: String(res.statusCode) },
        durationMs / 1000,
      );
      const level = req.path.startsWith('/health/') ? 'debug' : 'info';
      logger[level](
        {
          requestId: context?.requestId,
          correlationId: context?.correlationId,
          clientName: context?.clientName,
          clientVersion: context?.clientVersion,
          method: req.method,
          route,
          statusCode: res.statusCode,
          durationMs,
        },
        'request completed',
      );
    });
    next();
  };
}

/**
 * Prometheus scrape endpoint on its own port, reachable only inside the cluster. Processes
 * without a public HTTP port (worker, scheduler) also answer their health probes here.
 */
export function startMetricsServer(
  metrics: Metrics,
  port: number,
  logger: Logger,
  health?: Health,
): Server {
  const server = createServer((req, res) => {
    if (health && (req.url === '/health/live' || req.url === '/health/ready')) {
      const json = (status: number, body: unknown) =>
        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (req.url === '/health/live') {
        json(200, { status: 'ok' });
        return;
      }
      health
        .readiness()
        .then((report) => json(report.status === 'ok' ? 200 : 503, report))
        .catch(() => json(503, { status: 'fail' }));
      return;
    }
    if (req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    metrics.registry
      .metrics()
      .then((body) =>
        res.writeHead(200, { 'Content-Type': metrics.registry.contentType }).end(body),
      )
      .catch((err: unknown) => {
        logger.error({ err }, 'metrics collection failed');
        res.writeHead(500).end();
      });
  });
  server.listen(port);
  return server;
}
