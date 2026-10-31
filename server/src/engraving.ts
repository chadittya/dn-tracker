import type { CharacterRow } from './progress';

export const ENGRAVING_SLOT_COUNT = 14;

export const ENGRAVING_CATEGORIES = [
  'weapon',
  'armor',
  'accessory',
  'wtd',
] as const;

export type EngravingCategory = (typeof ENGRAVING_CATEGORIES)[number];

export const ENGRAVING_GRADES = ['rare', 'epic', 'unique', 'legend'] as const;

export type EngravingGrade = (typeof ENGRAVING_GRADES)[number];

export interface EngravingSlotDefinition {
  slot: number;
  label: string;
  category: EngravingCategory;
}

export interface EngravingCategoryMeta {
  key: EngravingCategory;
  label: string;
  firstStatLabel: string;
  secondStatLabel: string | null;
}

export interface EngravingGradeMeta {
  key: EngravingGrade;
  label: string;
  rank: number;
}

export const ENGRAVING_SLOT_DEFINITIONS: readonly EngravingSlotDefinition[] = [
  { slot: 1, label: 'Main weapon', category: 'weapon' },
  { slot: 2, label: 'Secondary weapon', category: 'weapon' },
  { slot: 3, label: 'Head', category: 'armor' },
  { slot: 4, label: 'Upper', category: 'armor' },
  { slot: 5, label: 'Lower', category: 'armor' },
  { slot: 6, label: 'Gloves', category: 'armor' },
  { slot: 7, label: 'Boots', category: 'armor' },
  { slot: 8, label: 'Necklace', category: 'accessory' },
  { slot: 9, label: 'Earring', category: 'accessory' },
  { slot: 10, label: 'Ring 1', category: 'accessory' },
  { slot: 11, label: 'Ring 2', category: 'accessory' },
  { slot: 12, label: 'Wings', category: 'wtd' },
  { slot: 13, label: 'Tail', category: 'wtd' },
  { slot: 14, label: 'Decal', category: 'wtd' },
];

export const ENGRAVING_CATEGORY_META: readonly EngravingCategoryMeta[] = [
  {
    key: 'weapon',
    label: 'Weapon',
    firstStatLabel: 'Attack/Magic Attack',
    secondStatLabel: null,
  },
  {
    key: 'armor',
    label: 'Armor',
    firstStatLabel: 'Defense/Magic Defense',
    secondStatLabel: null,
  },
  {
    key: 'accessory',
    label: 'Accessory',
    firstStatLabel: 'Attack/Magic Attack',
    secondStatLabel: 'Max HP',
  },
  {
    key: 'wtd',
    label: 'W/T/D',
    firstStatLabel: 'Attack/Magic Attack',
    secondStatLabel: 'Crit',
  },
];

export const ENGRAVING_GRADE_META: readonly EngravingGradeMeta[] =
  ENGRAVING_GRADES.map((key, rank) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    rank,
  }));

export interface EngravingValue {
  id: number;
  category: EngravingCategory;
  grade: EngravingGrade;
  /** Integer hundredths of a percent: 28 = 0.28%. */
  firstStatValue: number;
  /** Integer hundredths of a percent, or null for weapon/armor. */
  secondStatValue: number | null;
}

export interface CharacterEngravingRow {
  characterId: number;
  slot: number;
  valueId: number;
  thirdStatName: string | null;
  thirdStatValue: number | null;
}

export interface EngravingSlotState {
  characterId: number;
  slot: number;
  category: EngravingCategory;
  label: string;
  isEmpty: boolean;
  valueId: number | null;
  grade: EngravingGrade | null;
  firstStatValue: number | null;
  secondStatValue: number | null;
  thirdStatName: string | null;
  thirdStatValue: number | null;
}

export interface EngravingEmptySlot {
  slot: number;
  label: string;
}

export interface EngravingCharacterSummary {
  characterId: number;
  name: string;
  emptyCount: number;
  filledCount: number;
  emptySlots: EngravingEmptySlot[];
}

export interface EngravingState {
  slotCount: number;
  slotDefinitions: readonly EngravingSlotDefinition[];
  categories: readonly EngravingCategoryMeta[];
  grades: readonly EngravingGradeMeta[];
  valueTables: Record<EngravingCategory, EngravingValue[]>;
  slots: EngravingSlotState[];
  perCharacter: EngravingCharacterSummary[];
}

export interface EngravingFinderResult {
  characterId: number;
  name: string;
  isEmpty: boolean;
  valueId: number | null;
  grade: EngravingGrade | null;
  firstStatValue: number | null;
  secondStatValue: number | null;
}

export function gradeRank(grade: EngravingGrade): number {
  return ENGRAVING_GRADES.indexOf(grade);
}

export function categoryRank(category: EngravingCategory): number {
  return ENGRAVING_CATEGORIES.indexOf(category);
}

export function compareEngravingValues(
  a: EngravingValue,
  b: EngravingValue,
): number {
  return (
    categoryRank(a.category) - categoryRank(b.category) ||
    gradeRank(a.grade) - gradeRank(b.grade) ||
    a.firstStatValue - b.firstStatValue ||
    a.id - b.id
  );
}

/**
 * A candidate is lower only when it has a lower grade, or the same grade with
 * a lower first stat. Second and third stats are ignored. Equal is not lower.
 */
export function isLowerEngravingValue(
  candidate: EngravingValue,
  chosen: EngravingValue,
): boolean {
  if (candidate.category !== chosen.category) return false;

  const candidateRank = gradeRank(candidate.grade);
  const chosenRank = gradeRank(chosen.grade);

  return (
    candidateRank < chosenRank ||
    (candidateRank === chosenRank &&
      candidate.firstStatValue < chosen.firstStatValue)
  );
}

export function slotDefinition(
  slot: number,
): EngravingSlotDefinition | undefined {
  return ENGRAVING_SLOT_DEFINITIONS.find(
    (definition) => definition.slot === slot,
  );
}

export function categoryForSlot(slot: number): EngravingCategory | undefined {
  return slotDefinition(slot)?.category;
}

function emptySlotState(
  characterId: number,
  definition: EngravingSlotDefinition,
): EngravingSlotState {
  return {
    characterId,
    slot: definition.slot,
    category: definition.category,
    label: definition.label,
    isEmpty: true,
    valueId: null,
    grade: null,
    firstStatValue: null,
    secondStatValue: null,
    thirdStatName: null,
    thirdStatValue: null,
  };
}

function filledSlotState(
  row: CharacterEngravingRow,
  definition: EngravingSlotDefinition,
  value: EngravingValue,
): EngravingSlotState {
  return {
    characterId: row.characterId,
    slot: definition.slot,
    category: definition.category,
    label: definition.label,
    isEmpty: false,
    valueId: value.id,
    grade: value.grade,
    firstStatValue: value.firstStatValue,
    secondStatValue: value.secondStatValue,
    thirdStatName: row.thirdStatName,
    thirdStatValue: row.thirdStatValue,
  };
}

export function buildEngravingSlot(
  row: CharacterEngravingRow,
  definition: EngravingSlotDefinition,
  value: EngravingValue,
): EngravingSlotState {
  return filledSlotState(row, definition, value);
}

function groupRowsByCharacterSlot(
  rows: readonly CharacterEngravingRow[],
): Map<string, CharacterEngravingRow> {
  const rowsByKey = new Map<string, CharacterEngravingRow>();
  for (const row of rows) {
    rowsByKey.set(`${row.characterId}:${row.slot}`, row);
  }
  return rowsByKey;
}

/**
 * Expands every character to all 14 slots. Empty slots are virtual entries
 * (no DB row). A row whose value is missing or has the wrong category is
 * defensively treated as empty instead of crashing the state payload.
 */
export function buildEngravingState(
  characters: readonly CharacterRow[],
  values: readonly EngravingValue[],
  rows: readonly CharacterEngravingRow[],
): EngravingState {
  const valueTables: Record<EngravingCategory, EngravingValue[]> = {
    weapon: [],
    armor: [],
    accessory: [],
    wtd: [],
  };

  for (const value of [...values].sort(compareEngravingValues)) {
    valueTables[value.category].push(value);
  }

  const valueById = new Map(values.map((value) => [value.id, value]));
  const rowsByKey = groupRowsByCharacterSlot(rows);

  const slots: EngravingSlotState[] = [];
  const perCharacter: EngravingCharacterSummary[] = [];

  for (const character of characters) {
    const emptySlots: EngravingEmptySlot[] = [];
    let filledCount = 0;

    for (const definition of ENGRAVING_SLOT_DEFINITIONS) {
      const row = rowsByKey.get(`${character.id}:${definition.slot}`);
      const value = row ? valueById.get(row.valueId) : undefined;

      if (!row || !value || value.category !== definition.category) {
        slots.push(emptySlotState(character.id, definition));
        emptySlots.push({ slot: definition.slot, label: definition.label });
        continue;
      }

      slots.push(filledSlotState(row, definition, value));
      filledCount += 1;
    }

    perCharacter.push({
      characterId: character.id,
      name: character.name,
      emptyCount: emptySlots.length,
      filledCount,
      emptySlots,
    });
  }

  return {
    slotCount: ENGRAVING_SLOT_COUNT,
    slotDefinitions: ENGRAVING_SLOT_DEFINITIONS,
    categories: ENGRAVING_CATEGORY_META,
    grades: ENGRAVING_GRADE_META,
    valueTables,
    slots,
    perCharacter,
  };
}

function compareFinderResults(
  a: EngravingFinderResult,
  b: EngravingFinderResult,
): number {
  if (a.isEmpty !== b.isEmpty) return a.isEmpty ? -1 : 1;

  if (!a.isEmpty && !b.isEmpty) {
    const gradeDiff =
      gradeRank(a.grade as EngravingGrade) -
      gradeRank(b.grade as EngravingGrade);
    if (gradeDiff !== 0) return gradeDiff;

    const firstDiff =
      (a.firstStatValue as number) - (b.firstStatValue as number);
    if (firstDiff !== 0) return firstDiff;
  }

  const nameDiff = a.name.localeCompare(b.name, 'en', {
    sensitivity: 'base',
  });
  if (nameDiff !== 0) return nameDiff;

  return a.characterId - b.characterId;
}

export function findEngravingCandidates(
  characters: readonly CharacterRow[],
  values: readonly EngravingValue[],
  rows: readonly CharacterEngravingRow[],
  definition: EngravingSlotDefinition,
  chosen: EngravingValue,
): EngravingFinderResult[] {
  const valueById = new Map(values.map((value) => [value.id, value]));
  const rowsByKey = groupRowsByCharacterSlot(rows);
  const results: EngravingFinderResult[] = [];

  for (const character of characters) {
    const row = rowsByKey.get(`${character.id}:${definition.slot}`);

    if (!row) {
      results.push({
        characterId: character.id,
        name: character.name,
        isEmpty: true,
        valueId: null,
        grade: null,
        firstStatValue: null,
        secondStatValue: null,
      });
      continue;
    }

    const value = valueById.get(row.valueId);
    if (!value || value.category !== definition.category) {
      results.push({
        characterId: character.id,
        name: character.name,
        isEmpty: true,
        valueId: null,
        grade: null,
        firstStatValue: null,
        secondStatValue: null,
      });
      continue;
    }

    if (!isLowerEngravingValue(value, chosen)) continue;

    results.push({
      characterId: character.id,
      name: character.name,
      isEmpty: false,
      valueId: value.id,
      grade: value.grade,
      firstStatValue: value.firstStatValue,
      secondStatValue: value.secondStatValue,
    });
  }

  return results.sort(compareFinderResults);
}
