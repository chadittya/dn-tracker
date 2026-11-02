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
        'engraving_values',
        'character_engraving',
        'cards',
        'character_cards',
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
        'idx_character_engraving_value_id',
        'idx_character_cards_card_id',
      ]),
    );
    db.close();
  });

  it('seeds every engraving value row', () => {
    type Grade = 'rare' | 'epic' | 'unique' | 'legend';
    type Series = Record<Grade, number[]>;
    interface Table {
      category: string;
      first: Series;
      second: Series | null;
    }

    const FULL: Series = {
      rare: [20, 22, 24, 26, 28, 30],
      epic: [40, 44, 48, 52, 56, 60],
      unique: [100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140],
      legend: [160, 164, 168, 172, 176, 180, 184, 188, 192, 196, 200],
    };
    const HALF: Series = {
      rare: [10, 11, 12, 13, 14, 15],
      epic: [20, 22, 24, 26, 28, 30],
      unique: [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70],
      legend: [80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100],
    };
    const CRIT: Series = { ...FULL, epic: [40, 50, 60, 70, 80, 90] };
    const tables: Table[] = [
      { category: 'weapon', first: FULL, second: null },
      { category: 'armor', first: FULL, second: null },
      { category: 'accessory', first: HALF, second: FULL },
      { category: 'wtd', first: HALF, second: CRIT },
    ];
    const grades: Grade[] = ['rare', 'epic', 'unique', 'legend'];

    const expected: Array<{
      id: number;
      category: string;
      grade: Grade;
      firstStatValue: number;
      secondStatValue: number | null;
    }> = [];
    let nextId = 1;

    for (const table of tables) {
      for (const grade of grades) {
        const first = table.first[grade];
        const second = table.second?.[grade] ?? null;
        for (let index = 0; index < first.length; index += 1) {
          expected.push({
            id: nextId,
            category: table.category,
            grade,
            firstStatValue: first[index]!,
            secondStatValue: second === null ? null : second[index]!,
          });
          nextId += 1;
        }
      }
    }

    const db = openDatabase(tempDbPath());
    const rows = db
      .prepare(
        `SELECT id, category, grade,
                first_stat_value AS firstStatValue,
                second_stat_value AS secondStatValue
           FROM engraving_values
          ORDER BY id`,
      )
      .all();

    expect(rows).toHaveLength(136);
    expect(rows).toEqual(expected);
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
    expect(db.pragma('user_version', { simple: true })).toBe(
      LATEST_SCHEMA_VERSION,
    );
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
        'engraving_values',
        'character_engraving',
        'cards',
        'character_cards',
      ]),
    );
    db.close();
  });

  it('upgrades a version 2 database and keeps heraldry data', () => {
    const dbPath = tempDbPath();
    const raw = new Database(dbPath);
    migrations[0]!.up(raw);
    migrations[1]!.up(raw);
    raw.pragma('user_version = 2');

    raw
      .prepare('INSERT INTO characters (id, name, created_at) VALUES (1, ?, ?)')
      .run('Raven', '2026-01-01T00:00:00.000Z');
    raw.prepare('INSERT INTO plate_levels (value) VALUES (30)').run();
    raw
      .prepare(
        'INSERT INTO plates (id, name, created_at) VALUES (1, ?, ?)',
      )
      .run('Bear', '2026-01-02T00:00:00.000Z');
    raw
      .prepare(
        `INSERT INTO character_heraldry
           (character_id, slot, plate_id, level, rarity, has_third_stat)
         VALUES (1, 1, 1, 30, 'epic', 1)`,
      )
      .run();
    raw.close();

    const db = openDatabase(dbPath);
    expect(db.pragma('user_version', { simple: true })).toBe(
      LATEST_SCHEMA_VERSION,
    );
    expect(
      db
        .prepare(
          `SELECT character_id AS characterId, slot, plate_id AS plateId,
                  level, rarity, has_third_stat AS hasThirdStat
             FROM character_heraldry`,
        )
        .all(),
    ).toEqual([
      {
        characterId: 1,
        slot: 1,
        plateId: 1,
        level: 30,
        rarity: 'epic',
        hasThirdStat: 1,
      },
    ]);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM engraving_values').get(),
    ).toEqual({ count: 136 });
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM character_engraving').get(),
    ).toEqual({ count: 0 });
    db.close();
  });

  it('upgrades a version 3 database and keeps engraving data', () => {
    const dbPath = tempDbPath();
    const raw = new Database(dbPath);
    migrations[0]!.up(raw);
    migrations[1]!.up(raw);
    migrations[2]!.up(raw);
    raw.pragma('user_version = 3');

    raw
      .prepare('INSERT INTO characters (id, name, created_at) VALUES (1, ?, ?)')
      .run('Raven', '2026-01-01T00:00:00.000Z');
    raw
      .prepare(
        `INSERT INTO character_engraving
           (character_id, slot, value_id, third_stat_name, third_stat_value)
         VALUES (1, 1, 1, 'Critical Damage', 125)`,
      )
      .run();
    raw.close();

    const db = openDatabase(dbPath);
    expect(db.pragma('user_version', { simple: true })).toBe(4);
    expect(
      db
        .prepare(
          `SELECT character_id AS characterId, slot, value_id AS valueId,
                  third_stat_name AS thirdStatName,
                  third_stat_value AS thirdStatValue
             FROM character_engraving`,
        )
        .all(),
    ).toEqual([
      {
        characterId: 1,
        slot: 1,
        valueId: 1,
        thirdStatName: 'Critical Damage',
        thirdStatValue: 125,
      },
    ]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM cards').get()).toEqual({
      count: 0,
    });
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM character_cards').get(),
    ).toEqual({ count: 0 });
    db.close();
  });

  it('enforces card constraints and cascades', () => {
    const db = openDatabase(tempDbPath());
    const characterId = Number(
      db.prepare('INSERT INTO characters (name) VALUES (?)').run('Raven')
        .lastInsertRowid,
    );
    const cardId = Number(
      db.prepare('INSERT INTO cards (name) VALUES (?)').run('Red Dragon')
        .lastInsertRowid,
    );

    const createdAt = db
      .prepare('SELECT created_at AS createdAt FROM cards WHERE id = ?')
      .get(cardId) as { createdAt: string };
    expect(createdAt.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const insertCard = (grade: string) =>
      db
        .prepare(
          'INSERT INTO character_cards (character_id, card_id, grade) VALUES (?, ?, ?)',
        )
        .run(characterId, cardId, grade);

    insertCard('magic');
    expect(() => insertCard('legend')).toThrow(/UNIQUE constraint/);
    expect(() => insertCard('invalid')).toThrow(/CHECK/);
    expect(() =>
      db.prepare('INSERT INTO cards (name) VALUES (?)').run('red dragon'),
    ).toThrow(/UNIQUE/);

    db.prepare('DELETE FROM cards WHERE id = ?').run(cardId);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM character_cards').get(),
    ).toEqual({ count: 0 });

    const secondCardId = Number(
      db.prepare('INSERT INTO cards (name) VALUES (?)').run('Gold Dragon')
        .lastInsertRowid,
    );
    db.prepare(
      'INSERT INTO character_cards (character_id, card_id, grade) VALUES (?, ?, ?)',
    ).run(characterId, secondCardId, 'rare');
    db.prepare('DELETE FROM characters WHERE id = ?').run(characterId);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM character_cards').get(),
    ).toEqual({ count: 0 });
    db.close();
  });

  it('enforces engraving constraints, restrict, and cascade', () => {
    const db = openDatabase(tempDbPath());
    const characterId = Number(
      db.prepare('INSERT INTO characters (name) VALUES (?)').run('Raven')
        .lastInsertRowid,
    );

    const insertSlot = (
      slot: number,
      valueId: number,
      name: string | null = null,
      value: number | null = null,
    ) =>
      db
        .prepare(
          `INSERT INTO character_engraving
             (character_id, slot, value_id, third_stat_name, third_stat_value)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(characterId, slot, valueId, name, value);

    insertSlot(1, 1, 'Critical Damage', 125);
    expect(() => insertSlot(1, 2)).toThrow(/UNIQUE constraint/);
    expect(() => insertSlot(0, 1)).toThrow(/CHECK/);
    expect(() => insertSlot(2, 1, '   ', 125)).toThrow(/CHECK/);
    expect(() => insertSlot(2, 1, 'Name', null)).toThrow(/CHECK/);

    expect(() =>
      db.prepare('DELETE FROM engraving_values WHERE id = 1').run(),
    ).toThrow(/FOREIGN KEY/);

    expect(() =>
      db
        .prepare(
          `INSERT INTO engraving_values
             (category, grade, first_stat_value, second_stat_value)
           VALUES ('weapon', 'rare', 20, NULL)`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
    expect(() =>
      db
        .prepare(
          `INSERT INTO engraving_values
             (category, grade, first_stat_value, second_stat_value)
           VALUES ('weapon', 'rare', 222, 10)`,
        )
        .run(),
    ).toThrow(/CHECK/);
    expect(() =>
      db
        .prepare(
          `INSERT INTO engraving_values
             (category, grade, first_stat_value, second_stat_value)
           VALUES ('accessory', 'rare', 222, NULL)`,
        )
        .run(),
    ).toThrow(/CHECK/);

    db.prepare('DELETE FROM characters WHERE id = ?').run(characterId);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM character_engraving').get(),
    ).toEqual({ count: 0 });
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
