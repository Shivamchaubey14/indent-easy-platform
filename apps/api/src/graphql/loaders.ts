/*
 * Per-request memoisation and batching for resolvers. A list of 20 products asking for their
 * vendors should cost one query, not twenty.
 */

const requestScoped = new WeakMap<object, Map<string, unknown>>();

/** One value per request (per GraphQL context) and key, created on first use. */
export function perRequest<T>(ctx: object, key: string, create: () => T): T {
  let values = requestScoped.get(ctx);
  if (!values) {
    values = new Map();
    requestScoped.set(ctx, values);
  }
  if (!values.has(key)) values.set(key, create());
  return values.get(key) as T;
}

/**
 * Collects the keys asked for while the current execution step runs, then loads them with one
 * call. Each key is loaded once per loader; keep a loader per request (see `perRequest`).
 */
export function batchLoader<V>(
  load: (keys: string[]) => Promise<Map<string, V>>,
): (key: string) => Promise<V | undefined> {
  const settled = new Map<string, Promise<V | undefined>>();
  let pending: {
    key: string;
    resolve: (v: V | undefined) => void;
    reject: (e: unknown) => void;
  }[] = [];
  const flush = () => {
    const batch = pending;
    pending = [];
    load([...new Set(batch.map((p) => p.key))]).then(
      (values) => batch.forEach((p) => p.resolve(values.get(p.key))),
      (err: unknown) => batch.forEach((p) => p.reject(err)),
    );
  };
  return (key) => {
    let result = settled.get(key);
    if (!result) {
      result = new Promise((resolve, reject) => {
        if (pending.length === 0) setImmediate(flush);
        pending.push({ key, resolve, reject });
      });
      settled.set(key, result);
    }
    return result;
  };
}
