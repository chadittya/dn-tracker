import type Database from 'better-sqlite3';

interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
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
