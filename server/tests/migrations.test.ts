import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate, LATEST_SCHEMA_VERSION } from '../src/migrations';
import { openDatabase } from '../src/db';
import { makeTempDir, removeTempDir } from './helpers';

const tempDirs: string[] = [];

function tempDbPath(): string {
  const dir = makeTempDir();
  tempDirs.push(dir);
  return path.join(dir, 'app.db');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    removeTempDir(dir);
  }
});

describe('migrations', () => {
  it('migrates a fresh database to the latest version', () => {
    const db = openDatabase(tempDbPath());
    expect(db.pragma('user_version', { simple: true })).toBe(
      LATEST_SCHEMA_VERSION,
    );
    db.close();
  });

  it('is idempotent and preserves data', () => {
    const dbPath = tempDbPath();

    const first = openDatabase(dbPath);
    first.prepare('INSERT INTO characters (name) VALUES (?)').run('Raven');
    expect(() => migrate(first)).not.toThrow();
    expect(first.pragma('user_version', { simple: true })).toBe(
      LATEST_SCHEMA_VERSION,
    );
    first.close();

    const reopened = openDatabase(dbPath);
    expect(reopened.pragma('user_version', { simple: true })).toBe(
      LATEST_SCHEMA_VERSION,
    );
    const rows = reopened.prepare('SELECT name FROM characters').all();
    expect(rows).toEqual([{ name: 'Raven' }]);
    expect(() => migrate(reopened)).not.toThrow();
    reopened.close();
  });

  it('enables foreign keys on every connection', () => {
    const db = openDatabase(tempDbPath());
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.close();
  });

  it('refuses a database newer than the app supports', () => {
    const dbPath = tempDbPath();
    const raw = new Database(dbPath);
    raw.pragma(`user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    raw.close();

    expect(() => openDatabase(dbPath)).toThrow(/newer than this app supports/);
  });

  it('creates the expected tables and indexes', () => {
    const db = openDatabase(tempDbPath());
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((table) => table.name);
    expect(names).toEqual(
      expect.arrayContaining(['characters', 'nests', 'runs']),
    );

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((index) => index.name);
    expect(indexNames).toEqual(
      expect.arrayContaining(['idx_runs_week_key', 'idx_runs_nest_id']),
    );
    db.close();
  });

  it('rejects duplicate names case-insensitively', () => {
    const db = openDatabase(tempDbPath());
    db.prepare('INSERT INTO characters (name) VALUES (?)').run('Alpha');
    expect(() =>
      db.prepare('INSERT INTO characters (name) VALUES (?)').run('alpha'),
    ).toThrow(/UNIQUE/);
    db.close();
  });

  it('cascades deletes through foreign keys', () => {
    const db = openDatabase(tempDbPath());
    const characterId = Number(
      db.prepare('INSERT INTO characters (name) VALUES (?)').run('A')
        .lastInsertRowid,
    );
    const nestId = Number(
      db.prepare('INSERT INTO nests (name) VALUES (?)').run('N')
        .lastInsertRowid,
    );
    db.prepare(
      'INSERT INTO runs (character_id, nest_id, week_key) VALUES (?, ?, ?)',
    ).run(characterId, nestId, '2026-10-17');

    db.prepare('DELETE FROM characters WHERE id = ?').run(characterId);
    expect(db.prepare('SELECT COUNT(*) AS count FROM runs').get()).toEqual({
      count: 0,
    });
    db.close();
  });
});
