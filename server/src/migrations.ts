import type Database from 'better-sqlite3';
import { seedEngravingValues } from './engravingSeed';

interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE characters (
          id          INTEGER PRIMARY KEY,
          name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
          created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE TABLE nests (
          id          INTEGER PRIMARY KEY,
          name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
          created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE TABLE runs (
          character_id  INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
          nest_id       INTEGER NOT NULL REFERENCES nests(id) ON DELETE CASCADE,
          week_key      TEXT NOT NULL,
          completed_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          PRIMARY KEY (character_id, nest_id, week_key)
        );

        CREATE INDEX idx_runs_week_key ON runs(week_key);
        CREATE INDEX idx_runs_nest_id ON runs(nest_id);
      `);
    },
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`
        CREATE TABLE plate_levels (
          value INTEGER NOT NULL UNIQUE CHECK (value > 0)
        );

        CREATE TABLE plates (
          id          INTEGER PRIMARY KEY,
          name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
          created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE TABLE character_heraldry (
          character_id    INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
          slot            INTEGER NOT NULL CHECK (slot >= 1),
          plate_id        INTEGER NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
          level           INTEGER NOT NULL REFERENCES plate_levels(value) ON DELETE RESTRICT,
          rarity          TEXT NOT NULL CHECK (rarity IN ('rare', 'epic')),
          has_third_stat  INTEGER NOT NULL DEFAULT 0 CHECK (has_third_stat IN (0, 1)),
          PRIMARY KEY (character_id, slot),
          UNIQUE (character_id, plate_id)
        );

        CREATE INDEX idx_character_heraldry_plate_id ON character_heraldry(plate_id);
        CREATE INDEX idx_character_heraldry_level ON character_heraldry(level);
      `);
    },
  },
  {
    version: 3,
    up: (db) => {
      db.exec(`
        CREATE TABLE engraving_values (
          id                 INTEGER PRIMARY KEY,
          category           TEXT NOT NULL
                             CHECK (category IN ('weapon', 'armor', 'accessory', 'wtd')),
          grade              TEXT NOT NULL
                             CHECK (grade IN ('rare', 'epic', 'unique', 'legend')),
          first_stat_value   INTEGER NOT NULL CHECK (first_stat_value > 0),
          second_stat_value  INTEGER,
          UNIQUE (category, grade, first_stat_value),
          CHECK (
            (category IN ('weapon', 'armor') AND second_stat_value IS NULL)
            OR
            (category IN ('accessory', 'wtd')
              AND second_stat_value IS NOT NULL
              AND second_stat_value > 0)
          )
        );

        CREATE TABLE character_engraving (
          character_id      INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
          slot              INTEGER NOT NULL CHECK (slot >= 1),
          value_id          INTEGER NOT NULL REFERENCES engraving_values(id) ON DELETE RESTRICT,
          third_stat_name   TEXT,
          third_stat_value  INTEGER,
          PRIMARY KEY (character_id, slot),
          CHECK (
            (third_stat_name IS NULL AND third_stat_value IS NULL)
            OR (third_stat_name IS NOT NULL
              AND length(trim(third_stat_name)) BETWEEN 1 AND 50
              AND third_stat_value IS NOT NULL
              AND third_stat_value > 0)
          )
        );

        CREATE INDEX idx_character_engraving_value_id
          ON character_engraving(value_id);
      `);

      seedEngravingValues(db);
    },
  },
  {
    version: 4,
    up: (db) => {
      db.exec(`
        CREATE TABLE cards (
          id          INTEGER PRIMARY KEY,
          name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
          created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE TABLE character_cards (
          character_id  INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
          card_id       INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
          grade         TEXT NOT NULL
                        CHECK (grade IN ('magic', 'rare', 'epic', 'unique', 'legend')),
          PRIMARY KEY (character_id, card_id)
        );

        CREATE INDEX idx_character_cards_card_id ON character_cards(card_id);
      `);
    },
  },
];

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]!.version;

function assertContiguous(): void {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error('Migrations must be ordered and contiguous starting at 1.');
    }
  });
}

export function migrate(db: Database.Database): void {
  assertContiguous();

  const current = db.pragma('user_version', { simple: true }) as number;

  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${current} is newer than this app supports (${LATEST_SCHEMA_VERSION}).`,
    );
  }

  for (const migration of migrations) {
    if (migration.version <= current) continue;

    const run = db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    });

    run();
  }
}
