import { ConfigError, loadConfig, type AppConfig } from '@ie/config';
import { createLogger, type Logger } from './logging.js';
import { appVersion } from './version.js';

/** Loads configuration or exits with every problem listed (values are never printed). */
export function readConfig(): AppConfig {
  try {
    return loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      // No logger exists yet: configuration is what a logger is built from.
      // eslint-disable-next-line no-console
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

/** The logger every process (api, worker, scheduler) starts with. */
export function processLogger(service: string, config: AppConfig): Logger {
  return createLogger({
    level: process.env['LOG_LEVEL'] ?? (config.nodeEnv === 'production' ? 'info' : 'debug'),
    service,
    env: config.appEnv,
    version: appVersion(),
    pretty: config.nodeEnv === 'development',
  });
}

/**
 * Runs `stop` once on SIGTERM/SIGINT, then exits. A hard deadline makes sure a stuck
 * shutdown can't hang forever.
 */
export function onShutdown(logger: Logger, stop: () => Promise<void>, graceMs = 30_000): void {
  let stopping = false;
  const handle = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'shutting down');
    setTimeout(() => {
      logger.error('graceful shutdown timed out');
      process.exit(1);
    }, graceMs).unref();
    stop()
      .then(() => {
        logger.info('shutdown complete');
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error({ err }, 'error during shutdown');
        process.exit(1);
      });
  };
  process.on('SIGTERM', () => handle('SIGTERM'));
  process.on('SIGINT', () => handle('SIGINT'));
  process.on('unhandledRejection', (reason) =>
    logger.error({ err: reason }, 'unhandled promise rejection'),
  );
}
