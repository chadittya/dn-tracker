import fs from 'node:fs/promises';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { WIB_OFFSET_MS } from './week';

export type BackupKind = 'app' | 'preimport';

export interface BackupInfo {
  filename: string;
  kind: BackupKind;
  createdAt: string;
  sizeBytes: number;
}

export const APP_BACKUP_RETENTION = 14;
export const PREIMPORT_BACKUP_RETENTION = 5;
export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const FILE_PATTERN =
  /^(app|preimport)-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(\d+))?\.db$/;

interface ParsedBackup {
  kind: BackupKind;
  createdAtMs: number;
  sortKey: number;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function formatStamp(now: Date): string {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}${pad(shifted.getUTCDate())}` +
    `-${pad(shifted.getUTCHours())}${pad(shifted.getUTCMinutes())}${pad(shifted.getUTCSeconds())}`
  );
}

export function parseBackupFilename(filename: string): ParsedBackup | null {
  const match = FILE_PATTERN.exec(filename);
  if (!match) return null;

  const kind = match[1] as BackupKind;
  const year = Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  const hour = Number(match[5]);
  const minute = Number(match[6]);
  const second = Number(match[7]);
  const suffix = match[8] ? Number(match[8]) : 0;

  const createdAtMs =
    Date.UTC(year, month - 1, day, hour, minute, second) - WIB_OFFSET_MS;

  if (!Number.isFinite(createdAtMs)) return null;

  return {
    kind,
    createdAtMs,
    sortKey: createdAtMs * 1000 + suffix,
  };
}

export function retentionFor(kind: BackupKind): number {
  return kind === 'app' ? APP_BACKUP_RETENTION : PREIMPORT_BACKUP_RETENTION;
}

async function listFiles(backupDir: string): Promise<string[]> {
  try {
    return await fs.readdir(backupDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function listBackups(
  backupDir: string,
  kind?: BackupKind,
): Promise<BackupInfo[]> {
  const files = await listFiles(backupDir);
  const entries: Array<{ info: BackupInfo; sortKey: number }> = [];

  for (const filename of files) {
    const parsed = parseBackupFilename(filename);
    if (!parsed) continue;
    if (kind && parsed.kind !== kind) continue;

    let sizeBytes: number;
    try {
      sizeBytes = (await fs.stat(path.join(backupDir, filename))).size;
    } catch {
      continue;
    }

    entries.push({
      info: {
        filename,
        kind: parsed.kind,
        createdAt: new Date(parsed.createdAtMs).toISOString(),
        sizeBytes,
      },
      sortKey: parsed.sortKey,
    });
  }

  entries.sort((a, b) => b.sortKey - a.sortKey);
  return entries.map((entry) => entry.info);
}

async function prune(
  backupDir: string,
  kind: BackupKind,
  retention: number,
): Promise<void> {
  const backups = await listBackups(backupDir, kind);

  for (const backup of backups.slice(retention)) {
    try {
      await fs.unlink(path.join(backupDir, backup.filename));
    } catch (error) {
      console.error(`Could not prune backup ${backup.filename}:`, error);
    }
  }
}

async function nextFreeFilename(
  backupDir: string,
  kind: BackupKind,
  now: Date,
): Promise<string> {
  const stamp = formatStamp(now);

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const filename =
      suffix === 0
        ? `${kind}-${stamp}.db`
        : `${kind}-${stamp}-${suffix}.db`;

    try {
      await fs.access(path.join(backupDir, filename));
    } catch {
      return filename;
    }
  }

  throw new Error('Could not find a free backup filename.');
}

export async function createBackup(
  db: Database.Database,
  backupDir: string,
  kind: BackupKind,
  now: Date,
): Promise<BackupInfo> {
  await fs.mkdir(backupDir, { recursive: true });

  const filename = await nextFreeFilename(backupDir, kind, now);
  const finalPath = path.join(backupDir, filename);
  const tempPath = `${finalPath}.tmp`;

  try {
    // A stale temp file from an interrupted run must not block the backup.
    await fs.unlink(tempPath).catch(() => undefined);
    // SQLite's online backup is consistent even while the DB is in use.
    await db.backup(tempPath);
    await fs.rename(tempPath, finalPath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }

  await prune(backupDir, kind, retentionFor(kind));

  const stat = await fs.stat(finalPath);
  const parsed = parseBackupFilename(filename);
  if (!parsed) throw new Error(`Invalid backup filename generated: ${filename}`);

  return {
    filename,
    kind,
    createdAt: new Date(parsed.createdAtMs).toISOString(),
    sizeBytes: stat.size,
  };
}

export class BackupService {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly db: Database.Database,
    private readonly backupDir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Serializes backup work. Every call creates its own file (import backups
   * must never be coalesced with the scheduled backup).
   */
  create(kind: BackupKind): Promise<BackupInfo> {
    const task = this.queue.then(() =>
      createBackup(this.db, this.backupDir, kind, this.now()),
    );
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }
}

export function needsStartupBackup(
  appBackups: BackupInfo[],
  now: Date,
): boolean {
  const newest = appBackups[0];
  if (!newest) return true;
  return now.getTime() - Date.parse(newest.createdAt) >= BACKUP_INTERVAL_MS;
}
