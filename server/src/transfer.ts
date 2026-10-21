import type Database from 'better-sqlite3';
import { ApiError } from './errors';
import type { HeraldryRarity } from './heraldry';
import { isValidWeekKey } from './week';
import type { BackupService } from './backup';
import {
  foldNameForComparison,
  parseBoolean,
  parseId,
  parseName,
  parsePositiveInteger,
  parseRarity,
  parseSlot,
} from './validation';

export interface ExportCharacter {
  id: number;
  name: string;
  createdAt: string;
}

export interface ExportNest {
  id: number;
  name: string;
  createdAt: string;
}

export interface ExportRun {
  characterId: number;
  nestId: number;
  weekKey: string;
  completedAt: string;
}

export interface ExportPlate {
  id: number;
  name: string;
  createdAt: string;
}

export interface ExportHeraldry {
  characterId: number;
  slot: number;
  plateId: number;
  level: number;
  rarity: HeraldryRarity;
  hasThirdStat: boolean;
}

export interface ExportData {
  version: 2;
  exportedAt: string;
  characters: ExportCharacter[];
  nests: ExportNest[];
  runs: ExportRun[];
  plateLevels: number[];
  plates: ExportPlate[];
  characterHeraldry: ExportHeraldry[];
}

interface ValidatedImport {
  characters: ExportCharacter[];
  nests: ExportNest[];
  runs: ExportRun[];
  plateLevels: number[];
  plates: ExportPlate[];
  characterHeraldry: ExportHeraldry[];
}

interface ExportHeraldryDbRow {
  characterId: number;
  slot: number;
  plateId: number;
  level: number;
  rarity: HeraldryRarity;
  hasThirdStat: number;
}

function invalid(message: string): never {
  throw new ApiError(400, 'INVALID_IMPORT', message);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) invalid(`${label} must be an array.`);
  return value;
}

function optionalTimestamp(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    invalid(`${label} must be an ISO timestamp string.`);
  }
  if (Number.isNaN(Date.parse(value))) {
    invalid(`${label} must be a valid ISO timestamp.`);
  }
  return value;
}

function validateName(value: unknown, label: string): string {
  try {
    return parseName(value);
  } catch (error) {
    if (error instanceof ApiError) {
      invalid(`${label}: ${error.message}`);
    }
    throw error;
  }
}

function withLabel<T>(label: string, action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (error instanceof ApiError) {
      invalid(`${label}: ${error.message}`);
    }
    throw error;
  }
}

function validateNamedEntries(
  raw: unknown,
  label: string,
): ExportCharacter[] {
  const entries = asArray(raw, label);
  const ids = new Set<number>();
  const foldedNames = new Set<string>();
  const result: ExportCharacter[] = [];

  entries.forEach((entry, index) => {
    const record = asRecord(entry, `${label}[${index}]`);
    const id = withLabel(`${label}[${index}].id`, () => parseId(record.id));
    const name = validateName(record.name, `${label}[${index}].name`);
    const folded = foldNameForComparison(name);

    if (ids.has(id)) invalid(`Duplicate id ${id} in ${label}.`);
    if (foldedNames.has(folded)) invalid(`Duplicate name "${name}" in ${label}.`);

    ids.add(id);
    foldedNames.add(folded);
    result.push({
      id,
      name,
      createdAt:
        optionalTimestamp(
          record.createdAt,
          `${label}[${index}].createdAt`,
        ) ?? '',
    });
  });

  return result;
}

function validatePlateLevels(raw: unknown, label: string): number[] {
  const entries = asArray(raw, label);
  const seen = new Set<number>();

  return entries.map((entry, index) => {
    const value = withLabel(`${label}[${index}]`, () =>
      parsePositiveInteger(entry),
    );
    if (seen.has(value)) invalid(`Duplicate level ${value} in ${label}.`);
    seen.add(value);
    return value;
  });
}

function validateHeraldryEntries(
  raw: unknown,
  label: string,
  characterIds: ReadonlySet<number>,
  plateIds: ReadonlySet<number>,
  levelValues: ReadonlySet<number>,
): ExportHeraldry[] {
  const entries = asArray(raw, label);
  const slotKeys = new Set<string>();
  const plateKeys = new Set<string>();
  const result: ExportHeraldry[] = [];

  entries.forEach((entry, index) => {
    const prefix = `${label}[${index}]`;
    const record = asRecord(entry, prefix);
    const characterId = withLabel(`${prefix}.characterId`, () =>
      parseId(record.characterId),
    );
    const slot = withLabel(`${prefix}.slot`, () => parseSlot(record.slot));
    const plateId = withLabel(`${prefix}.plateId`, () =>
      parseId(record.plateId),
    );
    const level = withLabel(`${prefix}.level`, () =>
      parsePositiveInteger(record.level),
    );
    const rarity = withLabel(`${prefix}.rarity`, () =>
      parseRarity(record.rarity),
    );
    const hasThirdStat = withLabel(`${prefix}.hasThirdStat`, () =>
      parseBoolean(record.hasThirdStat, 'hasThirdStat'),
    );

    if (!characterIds.has(characterId)) {
      invalid(`${prefix} references unknown character ${characterId}.`);
    }
    if (!plateIds.has(plateId)) {
      invalid(`${prefix} references unknown plate ${plateId}.`);
    }
    if (!levelValues.has(level)) {
      invalid(`${prefix} references unknown level ${level}.`);
    }

    const slotKey = `${characterId}:${slot}`;
    if (slotKeys.has(slotKey)) {
      invalid(
        `Duplicate heraldry slot for character ${characterId}, slot ${slot}.`,
      );
    }
    slotKeys.add(slotKey);

    const plateKey = `${characterId}:${plateId}`;
    if (plateKeys.has(plateKey)) {
      invalid(`Character ${characterId} uses plate ${plateId} more than once.`);
    }
    plateKeys.add(plateKey);

    result.push({ characterId, slot, plateId, level, rarity, hasThirdStat });
  });

  return result;
}

export function validateImportPayload(raw: unknown): ValidatedImport {
  const payload = asRecord(raw, 'Import payload');

  if (payload.version !== 1 && payload.version !== 2) {
    invalid('Unsupported import version. Expected version 1 or 2.');
  }

  const characters = validateNamedEntries(payload.characters, 'characters');
  const nests = validateNamedEntries(payload.nests, 'nests');

  const characterIds = new Set(characters.map((character) => character.id));
  const nestIds = new Set(nests.map((nest) => nest.id));
  const runTriples = new Set<string>();
  const runsRaw = asArray(payload.runs, 'runs');

  const runs: ExportRun[] = runsRaw.map((entry, index) => {
    const record = asRecord(entry, `runs[${index}]`);

    let characterId: number;
    let nestId: number;
    try {
      characterId = parseId(
        record.characterId,
        `runs[${index}].characterId`,
      );
      nestId = parseId(record.nestId, `runs[${index}].nestId`);
    } catch (error) {
      if (error instanceof ApiError) invalid(error.message);
      throw error;
    }

    if (!characterIds.has(characterId)) {
      invalid(`runs[${index}] references unknown character ${characterId}.`);
    }
    if (!nestIds.has(nestId)) {
      invalid(`runs[${index}] references unknown nest ${nestId}.`);
    }

    const weekKey = record.weekKey;
    if (typeof weekKey !== 'string' || !isValidWeekKey(weekKey)) {
      invalid(`runs[${index}].weekKey must be a Saturday date (YYYY-MM-DD).`);
    }

    const triple = `${characterId}:${nestId}:${weekKey}`;
    if (runTriples.has(triple)) {
      invalid(
        `Duplicate run for character ${characterId}, nest ${nestId}, week ${weekKey}.`,
      );
    }
    runTriples.add(triple);

    return {
      characterId,
      nestId,
      weekKey,
      completedAt:
        optionalTimestamp(
          record.completedAt,
          `runs[${index}].completedAt`,
        ) ?? '',
    };
  });

  let plateLevels: number[] = [];
  let plates: ExportPlate[] = [];
  let characterHeraldry: ExportHeraldry[] = [];

  if (payload.version === 2) {
    plateLevels = validatePlateLevels(payload.plateLevels, 'plateLevels');
    plates = validateNamedEntries(payload.plates, 'plates');
    const plateIds = new Set(plates.map((plate) => plate.id));
    characterHeraldry = validateHeraldryEntries(
      payload.characterHeraldry,
      'characterHeraldry',
      characterIds,
      plateIds,
      new Set(plateLevels),
    );
  }

  return {
    characters,
    nests,
    runs,
    plateLevels,
    plates,
    characterHeraldry,
  };
}

export function exportData(db: Database.Database, now: Date): ExportData {
  const levelRows = db
    .prepare('SELECT value FROM plate_levels ORDER BY value DESC')
    .all() as Array<{ value: number }>;

  const heraldryRows = db
    .prepare(
      `SELECT character_id AS characterId, slot, plate_id AS plateId,
              level, rarity, has_third_stat AS hasThirdStat
         FROM character_heraldry
        ORDER BY character_id, slot`,
    )
    .all() as ExportHeraldryDbRow[];

  return {
    version: 2,
    exportedAt: now.toISOString(),
    characters: db
      .prepare(
        'SELECT id, name, created_at AS createdAt FROM characters ORDER BY id',
      )
      .all() as ExportCharacter[],
    nests: db
      .prepare('SELECT id, name, created_at AS createdAt FROM nests ORDER BY id')
      .all() as ExportNest[],
    runs: db
      .prepare(
        `SELECT character_id AS characterId, nest_id AS nestId,
                week_key AS weekKey, completed_at AS completedAt
           FROM runs
          ORDER BY week_key, character_id, nest_id`,
      )
      .all() as ExportRun[],
    plateLevels: levelRows.map((row) => row.value),
    plates: db
      .prepare(
        `SELECT id, name, created_at AS createdAt
           FROM plates
          ORDER BY name COLLATE NOCASE, id`,
      )
      .all() as ExportPlate[],
    characterHeraldry: heraldryRows.map((row) => ({
      characterId: row.characterId,
      slot: row.slot,
      plateId: row.plateId,
      level: row.level,
      rarity: row.rarity,
      hasThirdStat: row.hasThirdStat !== 0,
    })),
  };
}

export async function importData(
  db: Database.Database,
  raw: unknown,
  backupService: BackupService,
  now: () => Date,
): Promise<{
  imported: {
    characters: number;
    nests: number;
    runs: number;
    plateLevels: number;
    plates: number;
    heraldrySlots: number;
  };
  backup: string;
}> {
  // Validate everything before creating a backup or touching the database.
  const data = validateImportPayload(raw);

  const backup = await backupService.create('preimport');
  const fallbackTimestamp = now().toISOString();

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM character_heraldry').run();
    db.prepare('DELETE FROM plates').run();
    db.prepare('DELETE FROM plate_levels').run();
    db.prepare('DELETE FROM runs').run();
    db.prepare('DELETE FROM characters').run();
    db.prepare('DELETE FROM nests').run();

    const insertCharacter = db.prepare(
      'INSERT INTO characters (id, name, created_at) VALUES (?, ?, ?)',
    );
    for (const character of data.characters) {
      insertCharacter.run(
        character.id,
        character.name,
        character.createdAt || fallbackTimestamp,
      );
    }

    const insertNest = db.prepare(
      'INSERT INTO nests (id, name, created_at) VALUES (?, ?, ?)',
    );
    for (const nest of data.nests) {
      insertNest.run(nest.id, nest.name, nest.createdAt || fallbackTimestamp);
    }

    const insertLevel = db.prepare(
      'INSERT INTO plate_levels (value) VALUES (?)',
    );
    for (const value of data.plateLevels) {
      insertLevel.run(value);
    }

    const insertPlate = db.prepare(
      'INSERT INTO plates (id, name, created_at) VALUES (?, ?, ?)',
    );
    for (const plate of data.plates) {
      insertPlate.run(
        plate.id,
        plate.name,
        plate.createdAt || fallbackTimestamp,
      );
    }

    const insertRun = db.prepare(
      `INSERT INTO runs (character_id, nest_id, week_key, completed_at)
       VALUES (?, ?, ?, ?)`,
    );
    for (const run of data.runs) {
      insertRun.run(
        run.characterId,
        run.nestId,
        run.weekKey,
        run.completedAt || fallbackTimestamp,
      );
    }

    const insertHeraldry = db.prepare(
      `INSERT INTO character_heraldry
         (character_id, slot, plate_id, level, rarity, has_third_stat)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const slot of data.characterHeraldry) {
      insertHeraldry.run(
        slot.characterId,
        slot.slot,
        slot.plateId,
        slot.level,
        slot.rarity,
        slot.hasThirdStat ? 1 : 0,
      );
    }
  });

  replace();

  return {
    imported: {
      characters: data.characters.length,
      nests: data.nests.length,
      runs: data.runs.length,
      plateLevels: data.plateLevels.length,
      plates: data.plates.length,
      heraldrySlots: data.characterHeraldry.length,
    },
    backup: backup.filename,
  };
}
