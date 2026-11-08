import * as SQLite from 'expo-sqlite';
import type { SqlBindValue, SqlConnection, SqlDatabaseOpener } from './sqlConnection';

/**
 * Production opener wrapping expo-sqlite. Every connection must still receive
 * PRAGMA key before private reads — inheritance across connections is not assumed.
 */
export function createExpoSqlOpener(): SqlDatabaseOpener {
  return {
    async open(name) {
      const db = await SQLite.openDatabaseAsync(name);
      return adaptExpoDatabase(db);
    },
    async delete(name) {
      await SQLite.deleteDatabaseAsync(name);
    },
    async exists(name) {
      // expo-sqlite does not expose exists; presence is tracked separately via
      // DatabasePresence so a lost key cannot be mistaken for first launch.
      void name;
      return false;
    },
  };
}

export function adaptExpoDatabase(db: SQLite.SQLiteDatabase): SqlConnection {
  const adapt = (target: SQLite.SQLiteDatabase): SqlConnection => ({
    execAsync: (source) => target.execAsync(source),
    runAsync: async (source, ...params) => {
      const result = await target.runAsync(source, ...params);
      return { changes: result.changes };
    },
    getFirstAsync: <T>(source: string, ...params: SqlBindValue[]) =>
      target.getFirstAsync<T>(source, ...params),
    getAllAsync: <T>(source: string, ...params: SqlBindValue[]) =>
      target.getAllAsync<T>(source, ...params),
    withExclusiveTransactionAsync: async (task) => {
      // Prefer same-connection BEGIN/COMMIT so SQLCipher keeps the session key.
      // Nested expo exclusive transactions have produced NOTADB on Android.
      const adapted = adapt(target);
      await adapted.execAsync('BEGIN IMMEDIATE');
      try {
        await task(adapted);
        await adapted.execAsync('COMMIT');
      } catch (error) {
        await adapted.execAsync('ROLLBACK').catch(() => undefined);
        throw error;
      }
    },
    serializeAsync: () => target.serializeAsync(),
    closeAsync: () => target.closeAsync(),
  });
  return adapt(db);
}
