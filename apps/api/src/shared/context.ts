import { AsyncLocalStorage } from 'node:async_hooks';

export type Locale = 'en' | 'hi';

/** Per-request values that every log line, error and outbox row carries (SRS §26.1, §47.2). */
export interface RequestContext {
  requestId: string;
  correlationId: string;
  clientName: string | undefined;
  clientVersion: string | undefined;
  locale: Locale;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}
