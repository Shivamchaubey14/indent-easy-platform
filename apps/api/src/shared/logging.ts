import { pino, type Logger } from 'pino';
import { currentContext } from './context.js';

export type { Logger };

export interface LoggerOptions {
  level?: string;
  service: string;
  env: string;
  version: string;
  pretty?: boolean;
}

/** JSON logs to stdout, with request correlation fields added from the active request context. */
export function createLogger({
  level = 'info',
  service,
  env,
  version,
  pretty,
}: LoggerOptions): Logger {
  return pino({
    level,
    base: { service, env, version },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'token',
        'refreshToken',
        '*.password',
        '*.token',
        '*.refreshToken',
      ],
      censor: '[redacted]',
    },
    mixin() {
      const context = currentContext();
      return context ? { requestId: context.requestId, correlationId: context.correlationId } : {};
    },
    ...(pretty && {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service,env,version' },
      },
    }),
  });
}
