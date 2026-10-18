import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from './db';
import { getWeekKey } from './week';

/**
 * Development-only seed data. This script is hard-coded to `data-dev/` and
 * refuses to run against any other directory. It never touches `data/`.
 *
 * Run with: npm run seed:dev
 * The dev database is replaced with 40 characters, 15 nests, and random
 * current-week runs.
 */

const DEV_DATA_DIR = path.resolve(process.cwd(), 'data-dev');
const DEV_DB_PATH = path.join(DEV_DATA_DIR, 'app.db');
const PROD_DATA_DIR = path.resolve(process.cwd(), 'data');

const CHARACTER_COUNT = 40;
const NEST_COUNT = 15;
const COMPLETION_RATIOS = [0, 0.25, 0.5, 0.75, 1];

function assertDevDirectory(): void {
  if (path.basename(DEV_DATA_DIR) !== 'data-dev') {
    throw new Error(`Refusing to seed unexpected directory: ${DEV_DATA_DIR}`);
  }
  if (DEV_DATA_DIR === PROD_DATA_DIR) {
    throw new Error('Refusing to seed the production data directory.');
  }
}

function makeNames(prefix: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${prefix} ${String(index + 1).padStart(2, '0')}`,
  );
}

function shuffled<T>(items: readonly T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function seed(): void {
  assertDevDirectory();
  fs.mkdirSync(DEV_DATA_DIR, { recursive: true });

  const db = openDatabase(DEV_DB_PATH);

  try {
    const weekKey = getWeekKey(new Date());
    const completedAt = new Date().toISOString();
    const characterNames = makeNames('Character', CHARACTER_COUNT);
    const nestNames = makeNames('Nest', NEST_COUNT);

    const insertCharacter = db.prepare(
      'INSERT INTO characters (name) VALUES (?)',
    );
    const insertNest = db.prepare('INSERT INTO nests (name) VALUES (?)');
    const insertRun = db.prepare(
      `INSERT INTO runs (character_id, nest_id, week_key, completed_at)
       VALUES (?, ?, ?, ?)`,
    );

    const run = db.transaction(() => {
      db.exec('DELETE FROM runs; DELETE FROM characters; DELETE FROM nests;');

      const characterIds = characterNames.map((name) =>
        Number(insertCharacter.run(name).lastInsertRowid),
      );
      const nestIds = nestNames.map((name) =>
        Number(insertNest.run(name).lastInsertRowid),
      );

      let runCount = 0;
      for (const characterId of characterIds) {
        const ratio =
          COMPLETION_RATIOS[
            Math.floor(Math.random() * COMPLETION_RATIOS.length)
          ] ?? 0;
        const doneCount = Math.round(ratio * nestIds.length);

        for (const nestId of shuffled(nestIds).slice(0, doneCount)) {
          insertRun.run(characterId, nestId, weekKey, completedAt);
          runCount += 1;
        }
      }

      return runCount;
    });

    const runCount = run();
    console.log(
      `Seeded ${characterNames.length} characters, ${nestNames.length} nests, and ${runCount} runs for week ${weekKey}.`,
    );
    console.log(`Dev database: ${DEV_DB_PATH}`);
  } finally {
    db.close();
  }
}

try {
  seed();
} catch (error) {
  console.error('Dev seed failed:', error);
  process.exitCode = 1;
}
