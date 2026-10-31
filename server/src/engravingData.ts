import type Database from 'better-sqlite3';
import { buildEngravingState } from './engraving';
import type {
  CharacterEngravingRow,
  EngravingCategory,
  EngravingGrade,
  EngravingState,
  EngravingValue,
} from './engraving';
import type { CharacterRow } from './progress';

interface EngravingValueDbRow {
  id: number;
  category: EngravingCategory;
  grade: EngravingGrade;
  firstStatValue: number;
  secondStatValue: number | null;
}

export function readEngravingValues(
  db: Database.Database,
): EngravingValue[] {
  return db
    .prepare(
      `SELECT id, category, grade,
              first_stat_value AS firstStatValue,
              second_stat_value AS secondStatValue
         FROM engraving_values`,
    )
    .all() as EngravingValueDbRow[];
}

export function readCharacterEngravingRows(
  db: Database.Database,
): CharacterEngravingRow[] {
  return db
    .prepare(
      `SELECT character_id AS characterId, slot, value_id AS valueId,
              third_stat_name AS thirdStatName,
              third_stat_value AS thirdStatValue
         FROM character_engraving
        ORDER BY character_id, slot`,
    )
    .all() as CharacterEngravingRow[];
}

export function readEngravingValueById(
  db: Database.Database,
  id: number,
): EngravingValue | undefined {
  return db
    .prepare(
      `SELECT id, category, grade,
              first_stat_value AS firstStatValue,
              second_stat_value AS secondStatValue
         FROM engraving_values
        WHERE id = ?`,
    )
    .get(id) as EngravingValue | undefined;
}

export function readEngravingState(
  db: Database.Database,
  characters: readonly CharacterRow[],
): EngravingState {
  return buildEngravingState(
    characters,
    readEngravingValues(db),
    readCharacterEngravingRows(db),
  );
}
