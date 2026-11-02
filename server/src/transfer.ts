import type Database from 'better-sqlite3';
import { parseCardGrade } from './cards';
import type { CardGrade } from './cards';
import { ApiError } from './errors';
import {
  compareEngravingValues,
  ENGRAVING_CATEGORIES,
  slotDefinition,
} from './engraving';
import type {
  CharacterEngravingRow,
  EngravingCategory,
  EngravingGrade,
  EngravingValue,
} from './engraving';
import {
  readCharacterEngravingRows,
  readEngravingValues,
} from './engravingData';
import type { HeraldryRarity } from './heraldry';
import {
  readHeraldryRows,
  readLevels,
  readPlates,
} from './heraldryData';
import { isValidWeekKey } from './week';
import type { BackupService } from './backup';
import {
  foldNameForComparison,
  parseBoolean,
  parseEngravingGrade,
  parseEngravingSlot,
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

export interface ExportEngravingValue {
  id: number;
  grade: EngravingGrade;
  firstStatValue: number;
  secondStatValue: number | null;
}

export type ExportEngravingValues = Record<
  EngravingCategory,
  ExportEngravingValue[]
>;

export interface ExportEngraving {
  characterId: number;
  slot: number;
  valueId: number;
  thirdStatName: string | null;
  thirdStatValue: number | null;
}

export interface ExportCard {
  id: number;
  name: string;
  createdAt: string;
}

export interface ExportCharacterCard {
  characterId: number;
  cardId: number;
  grade: CardGrade;
}

export interface ExportData {
  version: 4;
  exportedAt: string;
  characters: ExportCharacter[];
  nests: ExportNest[];
  runs: ExportRun[];
  plateLevels: number[];
  plates: ExportPlate[];
  characterHeraldry: ExportHeraldry[];
  engravingValues: ExportEngravingValues;
  characterEngraving: ExportEngraving[];
  cards: ExportCard[];
  characterCards: ExportCharacterCard[];
}

interface ValidatedImport {
  version: 1 | 2 | 3 | 4;
  characters: ExportCharacter[];
  nests: ExportNest[];
  runs: ExportRun[];
  plateLevels: number[];
  plates: ExportPlate[];
  characterHeraldry: ExportHeraldry[];
  engravingValues: EngravingValue[];
  characterEngraving: CharacterEngravingRow[];
  cards: ExportCard[];
  characterCards: ExportCharacterCard[];
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

function validateEngravingValues(
  raw: unknown,
  label: string,
): EngravingValue[] {
  const record = asRecord(raw, label);
  const ids = new Set<number>();
  const naturalKeys = new Set<string>();
  const result: EngravingValue[] = [];

  for (const category of ENGRAVING_CATEGORIES) {
    const entries = asArray(record[category], `${label}.${category}`);

    entries.forEach((entry, index) => {
      const prefix = `${label}.${category}[${index}]`;
      const valueRecord = asRecord(entry, prefix);
      const id = withLabel(`${prefix}.id`, () => parseId(valueRecord.id));
      const grade = withLabel(`${prefix}.grade`, () =>
        parseEngravingGrade(valueRecord.grade),
      );
      const firstStatValue = withLabel(`${prefix}.firstStatValue`, () =>
        parsePositiveInteger(valueRecord.firstStatValue, 'firstStatValue'),
      );

      let secondStatValue: number | null;
      if (category === 'weapon' || category === 'armor') {
        if (
          valueRecord.secondStatValue !== undefined &&
          valueRecord.secondStatValue !== null
        ) {
          invalid(
            `${prefix}.secondStatValue must be absent for weapon and armor values.`,
          );
        }
        secondStatValue = null;
      } else {
        if (
          valueRecord.secondStatValue === undefined ||
          valueRecord.secondStatValue === null
        ) {
          invalid(
            `${prefix}.secondStatValue is required for accessory and W/T/D values.`,
          );
        }
        secondStatValue = withLabel(`${prefix}.secondStatValue`, () =>
          parsePositiveInteger(valueRecord.secondStatValue, 'secondStatValue'),
        );
      }

      if (ids.has(id)) invalid(`Duplicate engraving value id ${id}.`);
      ids.add(id);

      const naturalKey = `${category}:${grade}:${firstStatValue}`;
      if (naturalKeys.has(naturalKey)) {
        invalid(
          `Duplicate engraving value for ${category} ${grade} ${firstStatValue}.`,
        );
      }
      naturalKeys.add(naturalKey);

      result.push({
        id,
        category,
        grade,
        firstStatValue,
        secondStatValue,
      });
    });
  }

  return result;
}

function validateCharacterEngraving(
  raw: unknown,
  label: string,
  characterIds: ReadonlySet<number>,
  valuesById: ReadonlyMap<number, EngravingValue>,
): CharacterEngravingRow[] {
  const entries = asArray(raw, label);
  const slotKeys = new Set<string>();
  const result: CharacterEngravingRow[] = [];

  entries.forEach((entry, index) => {
    const prefix = `${label}[${index}]`;
    const record = asRecord(entry, prefix);
    const characterId = withLabel(`${prefix}.characterId`, () =>
      parseId(record.characterId),
    );
    const slot = withLabel(`${prefix}.slot`, () =>
      parseEngravingSlot(record.slot),
    );
    const valueId = withLabel(`${prefix}.valueId`, () =>
      parseId(record.valueId),
    );

    if (!characterIds.has(characterId)) {
      invalid(`${prefix} references unknown character ${characterId}.`);
    }

    const value = valuesById.get(valueId);
    if (!value) {
      invalid(`${prefix} references unknown engraving value ${valueId}.`);
    }

    const definition = slotDefinition(slot);
    if (!definition || value.category !== definition.category) {
      invalid(
        `${prefix} engraving value category does not match slot ${slot}.`,
      );
    }

    const slotKey = `${characterId}:${slot}`;
    if (slotKeys.has(slotKey)) {
      invalid(
        `Duplicate engraving slot for character ${characterId}, slot ${slot}.`,
      );
    }
    slotKeys.add(slotKey);

    const rawName = record.thirdStatName;
    const rawValue = record.thirdStatValue;
    const nameAbsent =
      rawName === undefined ||
      rawName === null ||
      (typeof rawName === 'string' && rawName.trim() === '');
    const valueAbsent = rawValue === undefined || rawValue === null;

    if (nameAbsent !== valueAbsent) {
      invalid(
        `${prefix}: thirdStatName and thirdStatValue must both be provided or both omitted.`,
      );
    }

    const thirdStatName = nameAbsent
      ? null
      : validateName(rawName, `${prefix}.thirdStatName`);
    const thirdStatValue = valueAbsent
      ? null
      : withLabel(`${prefix}.thirdStatValue`, () =>
          parsePositiveInteger(rawValue, 'thirdStatValue'),
        );

    result.push({
      characterId,
      slot,
      valueId,
      thirdStatName,
      thirdStatValue,
    });
  });

  return result;
}

function validateCharacterCards(
  raw: unknown,
  label: string,
  characterIds: ReadonlySet<number>,
  cardIds: ReadonlySet<number>,
): ExportCharacterCard[] {
  const entries = asArray(raw, label);
  const keys = new Set<string>();
  const result: ExportCharacterCard[] = [];

  entries.forEach((entry, index) => {
    const prefix = `${label}[${index}]`;
    const record = asRecord(entry, prefix);
    const characterId = withLabel(`${prefix}.characterId`, () =>
      parseId(record.characterId),
    );
    const cardId = withLabel(`${prefix}.cardId`, () =>
      parseId(record.cardId),
    );
    const grade = withLabel(`${prefix}.grade`, () =>
      parseCardGrade(record.grade),
    );

    if (!characterIds.has(characterId)) {
      invalid(`${prefix} references unknown character ${characterId}.`);
    }
    if (!cardIds.has(cardId)) {
      invalid(`${prefix} references unknown card ${cardId}.`);
    }

    const key = `${characterId}:${cardId}`;
    if (keys.has(key)) {
      invalid(
        `Duplicate card for character ${characterId}, card ${cardId}.`,
      );
    }
    keys.add(key);

    result.push({ characterId, cardId, grade });
  });

  return result;
}

export function validateImportPayload(raw: unknown): ValidatedImport {
  const payload = asRecord(raw, 'Import payload');

  if (
    payload.version !== 1 &&
    payload.version !== 2 &&
    payload.version !== 3 &&
    payload.version !== 4
  ) {
    invalid('Unsupported import version. Expected version 1, 2, 3, or 4.');
  }

  const version = payload.version;

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

  if (version === 2 || version === 3 || version === 4) {
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

  let engravingValues: EngravingValue[] = [];
  let characterEngraving: CharacterEngravingRow[] = [];

  if (version === 3 || version === 4) {
    engravingValues = validateEngravingValues(
      payload.engravingValues,
      'engravingValues',
    );
    const valuesById = new Map(
      engravingValues.map((value) => [value.id, value]),
    );
    characterEngraving = validateCharacterEngraving(
      payload.characterEngraving,
      'characterEngraving',
      characterIds,
      valuesById,
    );
  }

  let cards: ExportCard[] = [];
  let characterCards: ExportCharacterCard[] = [];

  if (version === 4) {
    cards = validateNamedEntries(payload.cards, 'cards');
    const cardIds = new Set(cards.map((card) => card.id));
    characterCards = validateCharacterCards(
      payload.characterCards,
      'characterCards',
      characterIds,
      cardIds,
    );
  }

  return {
    version,
    characters,
    nests,
    runs,
    plateLevels,
    plates,
    characterHeraldry,
    engravingValues,
    characterEngraving,
    cards,
    characterCards,
  };
}

export function exportData(db: Database.Database, now: Date): ExportData {
  const engravingValues: ExportEngravingValues = {
    weapon: [],
    armor: [],
    accessory: [],
    wtd: [],
  };

  for (const value of [...readEngravingValues(db)].sort(
    compareEngravingValues,
  )) {
    engravingValues[value.category].push({
      id: value.id,
      grade: value.grade,
      firstStatValue: value.firstStatValue,
      secondStatValue: value.secondStatValue,
    });
  }

  return {
    version: 4,
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
    plateLevels: readLevels(db),
    plates: readPlates(db),
    characterHeraldry: readHeraldryRows(db),
    engravingValues,
    characterEngraving: readCharacterEngravingRows(db),
    cards: db
      .prepare('SELECT id, name, created_at AS createdAt FROM cards ORDER BY id')
      .all() as ExportCard[],
    characterCards: db
      .prepare(
        `SELECT character_id AS characterId, card_id AS cardId, grade
           FROM character_cards
          ORDER BY character_id, card_id`,
      )
      .all() as ExportCharacterCard[],
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
    engravingValues: number;
    engravingSlots: number;
    cards: number;
    cardSlots: number;
  };
  backup: string;
}> {
  // Validate everything before creating a backup or touching the database.
  const data = validateImportPayload(raw);

  const backup = await backupService.create('preimport');
  const fallbackTimestamp = now().toISOString();

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM character_cards').run();
    if (data.version === 4) {
      db.prepare('DELETE FROM cards').run();
    }

    db.prepare('DELETE FROM character_engraving').run();
    if (data.version === 3 || data.version === 4) {
      db.prepare('DELETE FROM engraving_values').run();
    }

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

    const insertCard = db.prepare(
      'INSERT INTO cards (id, name, created_at) VALUES (?, ?, ?)',
    );
    for (const card of data.cards) {
      insertCard.run(
        card.id,
        card.name,
        card.createdAt || fallbackTimestamp,
      );
    }

    const insertCharacterCard = db.prepare(
      `INSERT INTO character_cards (character_id, card_id, grade)
       VALUES (?, ?, ?)`,
    );
    for (const entry of data.characterCards) {
      insertCharacterCard.run(
        entry.characterId,
        entry.cardId,
        entry.grade,
      );
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

    const insertEngravingValue = db.prepare(
      `INSERT INTO engraving_values
         (id, category, grade, first_stat_value, second_stat_value)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const value of data.engravingValues) {
      insertEngravingValue.run(
        value.id,
        value.category,
        value.grade,
        value.firstStatValue,
        value.secondStatValue,
      );
    }

    const insertEngraving = db.prepare(
      `INSERT INTO character_engraving
         (character_id, slot, value_id, third_stat_name, third_stat_value)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const slot of data.characterEngraving) {
      insertEngraving.run(
        slot.characterId,
        slot.slot,
        slot.valueId,
        slot.thirdStatName,
        slot.thirdStatValue,
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
      engravingValues: data.engravingValues.length,
      engravingSlots: data.characterEngraving.length,
      cards: data.cards.length,
      cardSlots: data.characterCards.length,
    },
    backup: backup.filename,
  };
}
