import type Database from 'better-sqlite3';
import { ApiError } from './errors';
import { isValidWeekKey } from './week';
import type { BackupService } from './backup';
import {
  foldNameForComparison,
  parseId,
  parseName,
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

export interface ExportData {
  version: 1;
  exportedAt: string;
  characters: ExportCharacter[];
  nests: ExportNest[];
  runs: ExportRun[];
}

interface ValidatedImport {
  characters: ExportCharacter[];
  nests: ExportNest[];
  runs: ExportRun[];
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

function validateCharacterEntries(
  raw: unknown,
  label: string,
): ExportCharacter[] {
  const entries = asArray(raw, label);
  const ids = new Set<number>();
  const foldedNames = new Set<string>();
  const result: ExportCharacter[] = [];

  entries.forEach((entry, index) => {
    const record = asRecord(entry, `${label}[${index}]`);
    let id: number;
    try {
      id = parseId(record.id, `${label}[${index}].id`);
    } catch (error) {
      if (error instanceof ApiError) invalid(error.message);
      throw error;
    }

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

export function validateImportPayload(raw: unknown): ValidatedImport {
  const payload = asRecord(raw, 'Import payload');

  if (payload.version !== 1) {
    invalid('Unsupported import version. Expected version 1.');
  }

  const characters = validateCharacterEntries(payload.characters, 'characters');
  const nests = validateCharacterEntries(payload.nests, 'nests');

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

  return { characters, nests, runs };
}

export function exportData(db: Database.Database, now: Date): ExportData {
  return {
    version: 1,
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
  };
}

export async function importData(
  db: Database.Database,
  raw: unknown,
  backupService: BackupService,
  now: () => Date,
): Promise<{
  imported: { characters: number; nests: number; runs: number };
  backup: string;
}> {
  // Validate everything before creating a backup or touching the database.
  const data = validateImportPayload(raw);

  const backup = await backupService.create('preimport');
  const fallbackTimestamp = now().toISOString();

  const replace = db.transaction(() => {
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
  });

  replace();

  return {
    imported: {
      characters: data.characters.length,
      nests: data.nests.length,
      runs: data.runs.length,
    },
    backup: backup.filename,
  };
}
