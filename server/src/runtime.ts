import fs from 'node:fs/promises';
import type Database from 'better-sqlite3';
import type { AppConfig } from './config';
import { openDatabase } from './db';
import {
  BACKUP_INTERVAL_MS,
  BackupService,
  listBackups,
  needsStartupBackup,
} from './backup';

export interface Runtime {
  db: Database.Database;
  backupService: BackupService;
  stop: () => void;
}

/**
 * Opens the DB, runs the conditional startup backup, and starts the 24h
 * automatic backup timer. Shared by the dev and production entry points.
 */
export async function startRuntime(
  config: AppConfig,
  now: () => Date = () => new Date(),
): Promise<Runtime> {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.mkdir(config.backupDir, { recursive: true });

  const db = openDatabase(config.dbPath);
  const backupService = new BackupService(db, config.backupDir, now);

  try {
    const appBackups = await listBackups(config.backupDir, 'app');
    if (needsStartupBackup(appBackups, now())) {
      const backup = await backupService.create('app');
      console.log(`Startup backup created: ${backup.filename}`);
    } else {
      console.log('Startup backup skipped: newest backup is under 24h old.');
    }
  } catch (error) {
    console.error('Startup backup failed (server will keep running):', error);
  }

  const timer = setInterval(() => {
    backupService
      .create('app')
      .then((backup) => console.log(`Automatic backup created: ${backup.filename}`))
      .catch((error) => console.error('Automatic backup failed:', error));
  }, BACKUP_INTERVAL_MS);
  timer.unref();

  let stopped = false;
  return {
    db,
    backupService,
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      db.close();
    },
  };
}
