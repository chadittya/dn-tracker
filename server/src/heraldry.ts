import type { CharacterRow } from './progress';

export const HERALDRY_SLOT_COUNT = 8;

export type HeraldryRarity = 'rare' | 'epic';
export type HeraldryStatus = 'ok' | 'recommended' | 'needs-upgrade';

export interface PlateRow {
  id: number;
  name: string;
  createdAt: string;
}

export interface HeraldryRow {
  characterId: number;
  slot: number;
  plateId: number;
  level: number;
  rarity: HeraldryRarity;
  hasThirdStat: boolean;
}

export interface HeraldrySlot {
  characterId: number;
  slot: number;
  isEmpty: boolean;
  plateId: number | null;
  plateName: string | null;
  level: number | null;
  rarity: HeraldryRarity | null;
  hasThirdStat: boolean;
  status: HeraldryStatus;
}

export interface HeraldryCharacterSummary {
  characterId: number;
  name: string;
  needsUpgrade: number;
  recommended: number;
  ok: number;
  empty: number;
  status: HeraldryStatus;
}

export interface HeraldryState {
  slotCount: number;
  levels: number[];
  cap: number | null;
  plates: PlateRow[];
  slots: HeraldrySlot[];
  perCharacter: HeraldryCharacterSummary[];
}

export function sortLevelsDescending(levels: readonly number[]): number[] {
  return [...levels].sort((a, b) => b - a);
}

/**
 * Rank 0 is the cap, rank 1 is the next level down, and rank 2+ is anything
 * lower. A level that is not in the list is defensive-only and behaves as
 * rank 2+.
 */
export function rankForLevel(
  level: number,
  levelsDesc: readonly number[],
): number {
  const index = levelsDesc.indexOf(level);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

export function computeStatus(
  rarity: HeraldryRarity,
  rank: number,
  hasThirdStat: boolean,
): HeraldryStatus {
  if (rank >= 2) return 'needs-upgrade';

  if (rank === 0) {
    if (rarity === 'epic') return 'ok';
    return hasThirdStat ? 'recommended' : 'needs-upgrade';
  }

  if (rarity === 'epic') {
    return hasThirdStat ? 'ok' : 'recommended';
  }
  return 'needs-upgrade';
}

export function emptyHeraldrySlot(
  characterId: number,
  slot: number,
): HeraldrySlot {
  return {
    characterId,
    slot,
    isEmpty: true,
    plateId: null,
    plateName: null,
    level: null,
    rarity: null,
    hasThirdStat: false,
    status: 'needs-upgrade',
  };
}

export function buildSlotState(
  row: HeraldryRow,
  plateName: string | null,
  levels: readonly number[],
): HeraldrySlot {
  const rank = rankForLevel(row.level, sortLevelsDescending(levels));
  return {
    characterId: row.characterId,
    slot: row.slot,
    isEmpty: false,
    plateId: row.plateId,
    plateName,
    level: row.level,
    rarity: row.rarity,
    hasThirdStat: row.hasThirdStat,
    status: computeStatus(row.rarity, rank, row.hasThirdStat),
  };
}

/**
 * Expands every character to the full slot grid. Empty slots are virtual
 * entries (no DB row) and always count as needs-upgrade.
 */
export function buildHeraldryState(
  characters: readonly CharacterRow[],
  levels: readonly number[],
  plates: readonly PlateRow[],
  rows: readonly HeraldryRow[],
): HeraldryState {
  const levelsDesc = sortLevelsDescending(levels);
  const plateNames = new Map(plates.map((plate) => [plate.id, plate.name]));
  const rowsByKey = new Map<string, HeraldryRow>();

  for (const row of rows) {
    rowsByKey.set(`${row.characterId}:${row.slot}`, row);
  }

  const slots: HeraldrySlot[] = [];
  const perCharacter: HeraldryCharacterSummary[] = [];

  for (const character of characters) {
    let needsUpgrade = 0;
    let recommended = 0;
    let ok = 0;
    let empty = 0;

    for (let slotNumber = 1; slotNumber <= HERALDRY_SLOT_COUNT; slotNumber += 1) {
      const row = rowsByKey.get(`${character.id}:${slotNumber}`);

      if (!row) {
        slots.push(emptyHeraldrySlot(character.id, slotNumber));
        needsUpgrade += 1;
        empty += 1;
        continue;
      }

      const status = computeStatus(
        row.rarity,
        rankForLevel(row.level, levelsDesc),
        row.hasThirdStat,
      );

      slots.push({
        characterId: character.id,
        slot: slotNumber,
        isEmpty: false,
        plateId: row.plateId,
        plateName: plateNames.get(row.plateId) ?? null,
        level: row.level,
        rarity: row.rarity,
        hasThirdStat: row.hasThirdStat,
        status,
      });

      if (status === 'needs-upgrade') needsUpgrade += 1;
      else if (status === 'recommended') recommended += 1;
      else ok += 1;
    }

    const status: HeraldryStatus =
      needsUpgrade > 0
        ? 'needs-upgrade'
        : recommended > 0
          ? 'recommended'
          : 'ok';

    perCharacter.push({
      characterId: character.id,
      name: character.name,
      needsUpgrade,
      recommended,
      ok,
      empty,
      status,
    });
  }

  return {
    slotCount: HERALDRY_SLOT_COUNT,
    levels: levelsDesc,
    cap: levelsDesc[0] ?? null,
    plates: [...plates],
    slots,
    perCharacter,
  };
}
