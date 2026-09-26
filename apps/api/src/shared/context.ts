import { AsyncLocalStorage } from 'node:async_hooks';

export type Locale = 'en' | 'hi';

/** The authenticated caller, from a verified access token (SRS §30.1). */
export interface Principal {
  userId: string;
  organizationId: string;
  sessionId: string;
  rolesVersion: number;
  /** Set until the user replaces a temporary or reset password (AUTH-013). */
  mustChangePassword: boolean;
}

/** Per-request values that every log line, error and outbox row carries (SRS §26.1, §47.2). */
export interface RequestContext {
  requestId: string;
  correlationId: string;
  clientName: string | undefined;
  clientVersion: string | undefined;
  locale: Locale;
  ip: string | undefined;
  userAgent: string | undefined;
  /** Filled in by the authentication middleware when the request carries a valid token. */
  principal?: Principal;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}
