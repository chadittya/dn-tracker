import type Database from 'better-sqlite3';
import {
  ENGRAVING_CATEGORIES,
  ENGRAVING_GRADES,
} from './engraving';
import type { EngravingCategory, EngravingGrade } from './engraving';

/**
 * These values are frozen for migration 3. Never edit them after the
 * migration ships: existing databases have already been seeded, and changing
 * this data would make fresh installs diverge from upgraded ones.
 */
type GradeSeries = Record<EngravingGrade, readonly number[]>;

interface SeedTable {
  category: EngravingCategory;
  first: GradeSeries;
  second: GradeSeries | null;
}

const FULL: GradeSeries = {
  rare: [20, 22, 24, 26, 28, 30],
  epic: [40, 44, 48, 52, 56, 60],
  unique: [100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140],
  legend: [160, 164, 168, 172, 176, 180, 184, 188, 192, 196, 200],
};

const HALF: GradeSeries = {
  rare: [10, 11, 12, 13, 14, 15],
  epic: [20, 22, 24, 26, 28, 30],
  unique: [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70],
  legend: [80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100],
};

const CRIT: GradeSeries = {
  ...FULL,
  epic: [40, 50, 60, 70, 80, 90],
};

const SEED_TABLES: readonly SeedTable[] = [
  { category: 'weapon', first: FULL, second: null },
  { category: 'armor', first: FULL, second: null },
  { category: 'accessory', first: HALF, second: FULL },
  { category: 'wtd', first: HALF, second: CRIT },
];

const EXPECTED_GRADE_COUNTS: Record<EngravingGrade, number> = {
  rare: 6,
  epic: 6,
  unique: 11,
  legend: 11,
};

function assertSeedShape(): void {
  if (SEED_TABLES.length !== ENGRAVING_CATEGORIES.length) {
    throw new Error('Engraving seed must define every category.');
  }

  let total = 0;

  for (const table of SEED_TABLES) {
    for (const grade of ENGRAVING_GRADES) {
      const first = table.first[grade];
      const second = table.second?.[grade];

      if (first.length !== EXPECTED_GRADE_COUNTS[grade]) {
        throw new Error(
          `Engraving seed ${table.category}/${grade} must have ${EXPECTED_GRADE_COUNTS[grade]} rows.`,
        );
      }
      if (second && second.length !== first.length) {
        throw new Error(
          `Engraving seed ${table.category}/${grade} has mismatched paired arrays.`,
        );
      }

      total += first.length;
    }
  }

  if (total !== 136) {
    throw new Error(`Engraving seed must contain 136 rows, got ${total}.`);
  }

  const accessoryEpic = SEED_TABLES.find(
    (table) => table.category === 'accessory',
  );
  if (
    accessoryEpic?.first.epic[4] !== 28 ||
    accessoryEpic.second?.epic[4] !== 56
  ) {
    throw new Error('Engraving seed accessory Epic 28/56 is missing.');
  }

  const wtdEpic = SEED_TABLES.find((table) => table.category === 'wtd');
  if (wtdEpic?.first.epic[3] !== 26 || wtdEpic.second?.epic[3] !== 70) {
    throw new Error('Engraving seed W/T/D Epic 26/70 is missing.');
  }
}

export function seedEngravingValues(db: Database.Database): void {
  assertSeedShape();

  const insert = db.prepare(
    `INSERT INTO engraving_values
       (category, grade, first_stat_value, second_stat_value)
     VALUES (?, ?, ?, ?)`,
  );

  for (const table of SEED_TABLES) {
    for (const grade of ENGRAVING_GRADES) {
      const first = table.first[grade];
      const second = table.second?.[grade] ?? null;

      for (let index = 0; index < first.length; index += 1) {
        insert.run(
          table.category,
          grade,
          first[index],
          second === null ? null : second[index],
        );
      }
    }
  }
}
