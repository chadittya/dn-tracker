import { ApiError } from './errors';
import type { CharacterRow } from './progress';
import {
  MAX_NAME_LENGTH,
  foldNameForComparison,
} from './validation';

export const CARD_GRADES = [
  'magic',
  'rare',
  'epic',
  'unique',
  'legend',
] as const;

export type CardGrade = (typeof CARD_GRADES)[number];

export interface CardGradeMeta {
  key: CardGrade;
  label: string;
  rank: number;
}

export const CARD_GRADE_META: readonly CardGradeMeta[] = [
  { key: 'magic', label: 'Magic', rank: 0 },
  { key: 'rare', label: 'Rare', rank: 1 },
  { key: 'epic', label: 'Epic', rank: 2 },
  { key: 'unique', label: 'Unique', rank: 3 },
  { key: 'legend', label: 'Legend', rank: 4 },
];

export interface CardRow {
  id: number;
  name: string;
  createdAt: string;
}

export interface CharacterCardRow {
  characterId: number;
  cardId: number;
  grade: CardGrade;
}

export interface CharacterCardEntry extends CharacterCardRow {
  cardName: string;
}

export interface CharacterCardSummary {
  characterId: number;
  name: string;
  count: number;
  total: number;
}

export interface CardsState {
  grades: readonly CardGradeMeta[];
  catalog: CardRow[];
  entries: CharacterCardEntry[];
  perCharacter: CharacterCardSummary[];
}

export interface CardFinderResult {
  characterId: number;
  name: string;
  grade: CardGrade | null;
}

export interface BulkCardImportPlan {
  names: string[];
  added: number;
  skipped: number;
  invalid: number;
}

export function parseCardGrade(value: unknown, field = 'grade'): CardGrade {
  if (isCardGrade(value)) return value;
  throw new ApiError(
    400,
    'VALIDATION_ERROR',
    `${field} must be "magic", "rare", "epic", "unique", or "legend".`,
  );
}

export function isCardGrade(value: unknown): value is CardGrade {
  return (
    typeof value === 'string' &&
    (CARD_GRADES as readonly string[]).includes(value)
  );
}

export function cardGradeRank(grade: CardGrade): number {
  return CARD_GRADE_META.find((meta) => meta.key === grade)!.rank;
}

/**
 * Compare names the way SQLite NOCASE does: fold ASCII A-Z, then compare
 * Unicode code points. Callers tie-break equal names by id.
 */
export function compareCardNames(
  a: { name: string; id: number },
  b: { name: string; id: number },
): number {
  const left = foldNameForComparison(a.name);
  const right = foldNameForComparison(b.name);
  const leftPoints = Array.from(left, (char) => char.codePointAt(0)!);
  const rightPoints = Array.from(right, (char) => char.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }

  return leftPoints.length - rightPoints.length;
}

function compareByIdThenName(
  a: { id: number; name: string },
  b: { id: number; name: string },
): number {
  return compareCardNames(a, b) || a.id - b.id;
}

export function sortCardCatalog(cards: readonly CardRow[]): CardRow[] {
  return [...cards].sort(compareByIdThenName);
}

export function isLowerCardGrade(
  grade: CardGrade | null,
  target: CardGrade,
): boolean {
  return grade === null || cardGradeRank(grade) < cardGradeRank(target);
}

export function buildCardsState(
  characters: readonly CharacterRow[],
  catalog: readonly CardRow[],
  rows: readonly CharacterCardRow[],
): CardsState {
  const sortedCatalog = sortCardCatalog(catalog);
  const cardById = new Map(sortedCatalog.map((card) => [card.id, card]));
  const characterIds = new Set(characters.map((character) => character.id));

  const entries: CharacterCardEntry[] = [];
  for (const row of rows) {
    const card = cardById.get(row.cardId);
    if (!card || !characterIds.has(row.characterId)) continue;
    entries.push({
      characterId: row.characterId,
      cardId: row.cardId,
      cardName: card.name,
      grade: row.grade,
    });
  }

  entries.sort(
    (a, b) =>
      a.characterId - b.characterId ||
      compareCardNames(
        { id: a.cardId, name: a.cardName },
        { id: b.cardId, name: b.cardName },
      ) ||
      a.cardId - b.cardId,
  );

  const counts = new Map<number, number>();
  for (const entry of entries) {
    counts.set(entry.characterId, (counts.get(entry.characterId) ?? 0) + 1);
  }

  return {
    grades: CARD_GRADE_META,
    catalog: sortedCatalog,
    entries,
    perCharacter: characters.map((character) => ({
      characterId: character.id,
      name: character.name,
      count: counts.get(character.id) ?? 0,
      total: sortedCatalog.length,
    })),
  };
}

export function findCardCandidates(
  characters: readonly CharacterRow[],
  rows: readonly CharacterCardRow[],
  cardId: number,
  target: CardGrade,
): CardFinderResult[] {
  const gradeByCharacter = new Map(
    rows
      .filter((row) => row.cardId === cardId)
      .map((row) => [row.characterId, row.grade]),
  );

  return characters
    .map((character) => ({
      characterId: character.id,
      name: character.name,
      grade: gradeByCharacter.get(character.id) ?? null,
    }))
    .filter((result) => isLowerCardGrade(result.grade, target))
    .sort((a, b) => {
      const aMissing = a.grade === null;
      const bMissing = b.grade === null;
      if (aMissing !== bMissing) return aMissing ? -1 : 1;
      if (a.grade !== null && b.grade !== null) {
        const rankDifference =
          cardGradeRank(a.grade) - cardGradeRank(b.grade);
        if (rankDifference !== 0) return rankDifference;
      }
      return (
        compareCardNames(
          { id: a.characterId, name: a.name },
          { id: b.characterId, name: b.name },
        ) || a.characterId - b.characterId
      );
    });
}

export function planBulkCardImport(
  text: string,
  existingNames: readonly string[],
): BulkCardImportPlan {
  const existing = new Set(
    existingNames.map((name) => foldNameForComparison(name)),
  );
  const seen = new Set<string>();
  const names: string[] = [];
  let skipped = 0;
  let invalid = 0;

  for (const line of text.split(/\r\n|\r|\n/)) {
    const name = line.trim();
    if (name.length === 0) continue;

    if (name.length > MAX_NAME_LENGTH) {
      invalid += 1;
      continue;
    }

    const folded = foldNameForComparison(name);
    if (existing.has(folded) || seen.has(folded)) {
      skipped += 1;
      continue;
    }

    seen.add(folded);
    names.push(name);
  }

  return { names, added: names.length, skipped, invalid };
}
