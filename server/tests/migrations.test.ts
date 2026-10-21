import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LATEST_SCHEMA_VERSION,
  migrate,
  migrations,
} from '../src/migrations';
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
      expect.arrayContaining([
        'characters',
        'nests',
        'runs',
        'plate_levels',
        'plates',
        'character_heraldry',
      ]),
    );

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((index) => index.name);
    expect(indexNames).toEqual(
      expect.arrayContaining([
        'idx_runs_week_key',
        'idx_runs_nest_id',
        'idx_character_heraldry_plate_id',
        'idx_character_heraldry_level',
      ]),
    );
    db.close();
  });

  it('upgrades a version 1 database without losing data', () => {
    const dbPath = tempDbPath();
    const raw = new Database(dbPath);
    migrations[0]!.up(raw);
    raw.pragma('user_version = 1');

    raw
      .prepare(
        'INSERT INTO characters (id, name, created_at) VALUES (1, ?, ?)',
      )
      .run('Raven', '2026-01-01T00:00:00.000Z');
    raw
      .prepare('INSERT INTO nests (id, name, created_at) VALUES (2, ?, ?)')
      .run('Abyss', '2026-01-02T00:00:00.000Z');
    raw
      .prepare(
        'INSERT INTO runs (character_id, nest_id, week_key) VALUES (1, 2, ?)',
      )
      .run('2026-10-17');
    raw.close();

    const db = openDatabase(dbPath);
    expect(db.pragma('user_version', { simple: true })).toBe(2);
    expect(db.prepare('SELECT id, name FROM characters').all()).toEqual([
      { id: 1, name: 'Raven' },
    ]);
    expect(db.prepare('SELECT id, name FROM nests').all()).toEqual([
      { id: 2, name: 'Abyss' },
    ]);
    expect(
      db
        .prepare(
          'SELECT character_id AS characterId, nest_id AS nestId, week_key AS weekKey FROM runs',
        )
        .all(),
    ).toEqual([{ characterId: 1, nestId: 2, weekKey: '2026-10-17' }]);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'plate_levels',
        'plates',
        'character_heraldry',
      ]),
    );
    db.close();
  });

  it('cascades heraldry deletes and restricts levels in use', () => {
    const db = openDatabase(tempDbPath());

    const insertCharacter = () =>
      Number(
        db.prepare('INSERT INTO characters (name) VALUES (?)').run('A')
          .lastInsertRowid,
      );
    const insertPlate = (name: string) =>
      Number(
        db.prepare('INSERT INTO plates (name) VALUES (?)').run(name)
          .lastInsertRowid,
      );
    const insertSlot = (
      characterId: number,
      plateId: number,
      slot = 1,
    ) => {
      db.prepare(
        `INSERT INTO character_heraldry
           (character_id, slot, plate_id, level, rarity, has_third_stat)
         VALUES (?, ?, ?, 30, 'epic', 1)`,
      ).run(characterId, slot, plateId);
    };

    db.prepare('INSERT INTO plate_levels (value) VALUES (30)').run();

    const characterId = insertCharacter();
    const plateId = insertPlate('Bear');
    insertSlot(characterId, plateId);

    const unusedPlate = insertPlate('Owl');
    expect(() =>
      db
        .prepare(
          `INSERT INTO character_heraldry
             (character_id, slot, plate_id, level, rarity, has_third_stat)
           VALUES (?, 0, ?, 30, 'epic', 1)`,
        )
        .run(characterId, unusedPlate),
    ).toThrow(/CHECK/);

    db.prepare('DELETE FROM characters WHERE id = ?').run(characterId);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM character_heraldry').get(),
    ).toEqual({ count: 0 });

    const secondCharacter = insertCharacter();
    const secondPlate = insertPlate('Wolf');
    insertSlot(secondCharacter, secondPlate);

    db.prepare('DELETE FROM plates WHERE id = ?').run(secondPlate);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM character_heraldry').get(),
    ).toEqual({ count: 0 });

    const thirdPlate = insertPlate('Eagle');
    insertSlot(secondCharacter, thirdPlate);
    expect(() =>
      db.prepare('DELETE FROM plate_levels WHERE value = 30').run(),
    ).toThrow(/FOREIGN KEY/);

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
