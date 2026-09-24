import { customType } from 'drizzle-orm/pg-core';

/** Case-insensitive text (e-mail addresses). Compared case-insensitively by PostgreSQL. */
export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

/** Raw bytes: token and request hashes. */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/**
 * Full-text search vector. Always a generated column here, so it is never written; reads return
 * PostgreSQL's text form, which search queries do not need to parse.
 */
export const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});
