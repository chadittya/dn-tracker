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

export interface CharacterCardImportOperation {
  cardId: number;
  cardName: string;
  grade: CardGrade;
}

export interface CharacterCardImportPlan {
  /** Added and updated cards only, in input line order. */
  operations: CharacterCardImportOperation[];
  added: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  invalid: number;
  invalidLines: string[];
}

/**
 * Match a grade label case-insensitively with SQLite NOCASE semantics
 * (ASCII A-Z only). Returns null for an unknown grade.
 */
export function matchCardGrade(value: string): CardGrade | null {
  const folded = foldNameForComparison(value.trim());
  return (
    CARD_GRADES.find(
      (grade) => foldNameForComparison(grade) === folded,
    ) ?? null
  );
}

/**
 * Plan a per-character `Card name, Grade` import. Pure: the caller supplies
 * the catalog and every character-card row.
 *
 * A line is invalid when it has no comma, an empty name or grade, an unknown
 * card, or an unknown grade. An invalid line never claims its card, so a later
 * valid line for the same card is still applied. Once a valid line claims a
 * card, every later line for that card is a duplicate and is skipped, even if
 * that later line is otherwise malformed.
 */
export function planCharacterCardImport(
  text: string,
  catalog: readonly CardRow[],
  characterId: number,
  existingRows: readonly CharacterCardRow[],
): CharacterCardImportPlan {
  const cardByName = new Map<string, CardRow>();
  for (const card of catalog) {
    cardByName.set(foldNameForComparison(card.name), card);
  }

  const existingGrades = new Map<number, CardGrade>();
  for (const row of existingRows) {
    if (row.characterId === characterId) {
      existingGrades.set(row.cardId, row.grade);
    }
  }

  const claimed = new Set<number>();
  const operations: CharacterCardImportOperation[] = [];
  const invalidLines: string[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const commaIndex = line.lastIndexOf(',');
    if (commaIndex < 0) {
      invalid += 1;
      invalidLines.push(line);
      continue;
    }

    const name = line.slice(0, commaIndex).trim();
    const gradeText = line.slice(commaIndex + 1).trim();
    if (name.length === 0 || gradeText.length === 0) {
      invalid += 1;
      invalidLines.push(line);
      continue;
    }

    const card = cardByName.get(foldNameForComparison(name));
    if (!card) {
      invalid += 1;
      invalidLines.push(line);
      continue;
    }

    if (claimed.has(card.id)) {
      duplicates += 1;
      continue;
    }

    const grade = matchCardGrade(gradeText);
    if (grade === null) {
      invalid += 1;
      invalidLines.push(line);
      continue;
    }

    claimed.add(card.id);
    const existingGrade = existingGrades.get(card.id);
    if (existingGrade === undefined) {
      added += 1;
      operations.push({ cardId: card.id, cardName: card.name, grade });
    } else if (existingGrade === grade) {
      unchanged += 1;
    } else {
      updated += 1;
      operations.push({ cardId: card.id, cardName: card.name, grade });
    }
  }

  return {
    operations,
    added,
    updated,
    unchanged,
    duplicates,
    invalid,
    invalidLines,
  };
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
