import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BackupService,
  createBackup,
  listBackups,
  needsStartupBackup,
  parseBackupFilename,
} from '../src/backup';
import { createTestContext } from './helpers';
import type { TestContext } from './helpers';

let context: TestContext;

afterEach(() => {
  context?.close();
});

const base = new Date('2026-10-21T05:00:00.000Z');

function setup(): TestContext {
  context = createTestContext({ fileBacked: true });
  context.db.prepare('INSERT INTO characters (name) VALUES (?)').run('Raven');
  return context;
}

describe('automatic backups', () => {
  it('creates a valid, openable SQLite backup', async () => {
    setup();
    const backup = await createBackup(context.db, context.backupDir, 'app', base);

    expect(backup.filename).toMatch(/^app-\d{8}-\d{6}\.db$/);
    expect(fs.existsSync(path.join(context.backupDir, backup.filename))).toBe(
      true,
    );

    const copy = new Database(path.join(context.backupDir, backup.filename), {
      readonly: true,
    });
    expect(copy.prepare('SELECT name FROM characters').all()).toEqual([
      { name: 'Raven' },
    ]);
    copy.close();
  });

  it('prunes to the newest 14 app backups', async () => {
    setup();

    for (let index = 0; index < 15; index += 1) {
      await createBackup(
        context.db,
        context.backupDir,
        'app',
        new Date(base.getTime() + index * 1000),
      );
    }

    const backups = await listBackups(context.backupDir, 'app');
    expect(backups).toHaveLength(14);

    const names = backups.map((backup) => backup.filename);
    const newest = names[0]!;
    const expectedNewest = `app-${'20261021'}-${'120014'}.db`;
    expect(newest).toBe(expectedNewest);
    expect(names).not.toContain(`app-${'20261021'}-${'120000'}.db`);
  });

  it('prunes app and pre-import backups independently', async () => {
    setup();

    for (let index = 0; index < 16; index += 1) {
      await createBackup(
        context.db,
        context.backupDir,
        'app',
        new Date(base.getTime() + index * 1000),
      );
    }
    for (let index = 0; index < 7; index += 1) {
      await createBackup(
        context.db,
        context.backupDir,
        'preimport',
        new Date(base.getTime() + index * 1000),
      );
    }

    expect(await listBackups(context.backupDir, 'app')).toHaveLength(14);
    expect(await listBackups(context.backupDir, 'preimport')).toHaveLength(5);
    expect(await listBackups(context.backupDir)).toHaveLength(19);
  });

  it('handles same-second filename collisions', async () => {
    setup();

    const first = await createBackup(context.db, context.backupDir, 'app', base);
    const second = await createBackup(context.db, context.backupDir, 'app', base);

    expect(first.filename).not.toBe(second.filename);
    expect(second.filename).toMatch(/^app-\d{8}-\d{6}-1\.db$/);
    expect(parseBackupFilename(first.filename)?.kind).toBe('app');
    expect(parseBackupFilename(second.filename)?.kind).toBe('app');
  });

  it('serializes concurrent BackupService calls without coalescing them', async () => {
    setup();
    const service = new BackupService(
      context.db,
      context.backupDir,
      () => base,
    );

    const results = await Promise.all([
      service.create('app'),
      service.create('app'),
      service.create('preimport'),
    ]);

    const filenames = new Set(results.map((result) => result.filename));
    expect(filenames.size).toBe(3);
    expect(await listBackups(context.backupDir, 'app')).toHaveLength(2);
    expect(await listBackups(context.backupDir, 'preimport')).toHaveLength(1);
  });

  it('lists both backup kinds newest first', async () => {
    setup();
    await createBackup(context.db, context.backupDir, 'app', base);
    await createBackup(
      context.db,
      context.backupDir,
      'preimport',
      new Date(base.getTime() + 1000),
    );

    const backups = await listBackups(context.backupDir);
    expect(backups).toHaveLength(2);
    expect(backups[0]!.kind).toBe('preimport');
    expect(backups[1]!.kind).toBe('app');
    expect(backups[0]!.createdAt).toBe('2026-10-21T05:00:01.000Z');
  });

  it('ignores temp and unrelated files', async () => {
    setup();
    fs.writeFileSync(
      path.join(context.backupDir, 'app-20261020-120000.db.tmp'),
      'partial',
    );
    fs.writeFileSync(path.join(context.backupDir, 'notes.txt'), 'hello');

    await createBackup(context.db, context.backupDir, 'app', base);
    const backups = await listBackups(context.backupDir);
    expect(backups.map((backup) => backup.filename)).toEqual([
      expect.stringMatching(/^app-20261021-120000\.db$/),
    ]);
    expect(
      fs.existsSync(path.join(context.backupDir, 'app-20261020-120000.db.tmp')),
    ).toBe(true);
  });
});

describe('startup backup decision', () => {
  it('requires a backup when none exist', () => {
    expect(needsStartupBackup([], base)).toBe(true);
  });

  it('skips when the newest app backup is under 24h old', () => {
    expect(
      needsStartupBackup(
        [
          {
            filename: 'app-20261021-120000.db',
            kind: 'app',
            createdAt: new Date(base.getTime() - 23 * 60 * 60 * 1000).toISOString(),
            sizeBytes: 1,
          },
        ],
        base,
      ),
    ).toBe(false);
  });

  it('creates a backup when the newest is 24h old or older', () => {
    expect(
      needsStartupBackup(
        [
          {
            filename: 'app-20261020-120000.db',
            kind: 'app',
            createdAt: new Date(base.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            sizeBytes: 1,
          },
        ],
        base,
      ),
    ).toBe(true);
  });
});
