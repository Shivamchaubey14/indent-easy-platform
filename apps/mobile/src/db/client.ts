import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';
import migrations from './migrations/migrations';
import * as schema from './schema';

const sqlite = openDatabaseSync('indent-easy.db');
export const db = drizzle(sqlite, { schema });

/** Applies pending migrations once at start-up; the app waits for `success` before rendering. */
export function useLocalDatabase(): { success: boolean; error?: Error } {
  return useMigrations(db, migrations);
}
