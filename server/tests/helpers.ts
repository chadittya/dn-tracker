import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import request from 'supertest';
import { BackupService } from '../src/backup';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db';

/** Wednesday 2026-10-21 12:00 WIB; active week_key is 2026-10-17. */
export const FIXED_NOW = new Date('2026-10-21T05:00:00.000Z');

export interface TestContext {
  db: Database.Database;
  dir: string;
  backupDir: string;
  backupService: BackupService;
  app: Express;
  now: { current: Date };
  close: () => void;
}

export function makeTempDir(prefix = 'dn-tracker-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

export function createTestContext(options?: {
  fileBacked?: boolean;
  now?: Date;
}): TestContext {
  const dir = makeTempDir();
  const now = { current: options?.now ?? FIXED_NOW };
  const dbPath = options?.fileBacked
    ? path.join(dir, 'app.db')
    : ':memory:';
  const db = openDatabase(dbPath);
  const backupDir = path.join(dir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const backupService = new BackupService(db, backupDir, () => now.current);
  const app = createApp({
    db,
    backupService,
    backupDir,
    now: () => now.current,
  });

  return {
    db,
    dir,
    backupDir,
    backupService,
    app,
    now,
    close: () => {
      db.close();
      removeTempDir(dir);
    },
  };
}

export interface StateSnapshot {
  weekKey: string;
  characters: Array<{ id: number; name: string }>;
  nests: Array<{ id: number; name: string }>;
  runs: Array<{ characterId: number; nestId: number; weekKey: string }>;
}

export async function fetchState(app: Express): Promise<StateSnapshot> {
  const response = await request(app).get('/api/state').expect(200);
  return {
    weekKey: response.body.weekKey,
    characters: response.body.characters,
    nests: response.body.nests,
    runs: response.body.runs,
  };
}
