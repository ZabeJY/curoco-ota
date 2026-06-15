/**
 * Curoco — Database Initialization
 * Thread-safe singleton with proper error recovery
 */

import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

const DB_NAME = 'curoco.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let pendingInit: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  // Guard against concurrent initialization
  if (pendingInit) return pendingInit;

  pendingInit = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await runMigrations(db);
      dbInstance = db;
      return db;
    } catch (error) {
      // Reset on failure so next call can retry
      dbInstance = null;
      throw error;
    } finally {
      pendingInit = null;
    }
  })();

  return pendingInit;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}
