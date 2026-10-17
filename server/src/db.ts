import Database from 'better-sqlite3';
import { migrate } from './migrations';

export function openDatabase(filename: string): Database.Database {
  const db = new Database(filename);

  try {
    // Foreign keys are per-connection and must be enabled before any transaction.
    db.pragma('foreign_keys = ON');
    // WAL is a file-mode setting; in-memory databases simply stay in memory mode.
    db.pragma('journal_mode = WAL');

    migrate(db);
    db.pragma('foreign_keys = ON');

    return db;
  } catch (error) {
    // Never leak an open connection when startup validation fails.
    db.close();
    throw error;
  }
}
