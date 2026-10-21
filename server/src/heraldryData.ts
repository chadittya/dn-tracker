import type Database from 'better-sqlite3';
import { buildHeraldryState } from './heraldry';
import type {
  HeraldryRarity,
  HeraldryRow,
  HeraldryState,
  PlateRow,
} from './heraldry';
import type { CharacterRow } from './progress';

interface HeraldryDbRow {
  characterId: number;
  slot: number;
  plateId: number;
  level: number;
  rarity: HeraldryRarity;
  hasThirdStat: number;
}

export function readLevels(db: Database.Database): number[] {
  const rows = db
    .prepare('SELECT value FROM plate_levels ORDER BY value DESC')
    .all() as Array<{ value: number }>;
  return rows.map((row) => row.value);
}

export function readPlates(db: Database.Database): PlateRow[] {
  return db
    .prepare(
      `SELECT id, name, created_at AS createdAt
         FROM plates
        ORDER BY name COLLATE NOCASE, id`,
    )
    .all() as PlateRow[];
}

export function readHeraldryRows(db: Database.Database): HeraldryRow[] {
  const rows = db
    .prepare(
      `SELECT character_id AS characterId, slot, plate_id AS plateId,
              level, rarity, has_third_stat AS hasThirdStat
         FROM character_heraldry
        ORDER BY character_id, slot`,
    )
    .all() as HeraldryDbRow[];

  return rows.map((row) => ({
    characterId: row.characterId,
    slot: row.slot,
    plateId: row.plateId,
    level: row.level,
    rarity: row.rarity,
    hasThirdStat: row.hasThirdStat !== 0,
  }));
}

export function readHeraldryState(
  db: Database.Database,
  characters: readonly CharacterRow[],
): HeraldryState {
  return buildHeraldryState(
    characters,
    readLevels(db),
    readPlates(db),
    readHeraldryRows(db),
  );
}
