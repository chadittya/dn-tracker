import type {
  CardBulkImportResult,
  CardCatalogEntry,
  CharacterCardEntry,
} from '../api/types';
import { foldName } from './names';
import { filterByName } from './search';

export interface CardOption {
  id: number;
  label: string;
}

function compareNames(
  a: { id: number; name: string },
  b: { id: number; name: string },
): number {
  const left = foldName(a.name);
  const right = foldName(b.name);
  const leftPoints = Array.from(left, (char) => char.codePointAt(0)!);
  const rightPoints = Array.from(right, (char) => char.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }

  return leftPoints.length - rightPoints.length;
}

export function sortCardsAZ(
  cards: readonly CardCatalogEntry[],
): CardCatalogEntry[] {
  return [...cards].sort(
    (a, b) => compareNames(a, b) || a.id - b.id,
  );
}

export function sortCharacterCardEntries(
  entries: readonly CharacterCardEntry[],
): CharacterCardEntry[] {
  return [...entries].sort(
    (a, b) => compareNames(
      { id: a.cardId, name: a.cardName },
      { id: b.cardId, name: b.cardName },
    ) || a.cardId - b.cardId,
  );
}

export function filterCards(
  cards: readonly CardCatalogEntry[],
  query: string,
): CardCatalogEntry[] {
  return filterByName(cards, query);
}

export function filterCharacterCards(
  entries: readonly CharacterCardEntry[],
  query: string,
): CharacterCardEntry[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return [...entries];
  return entries.filter((entry) =>
    entry.cardName.toLowerCase().includes(normalized),
  );
}

export function buildCardOptions(
  catalog: readonly CardCatalogEntry[],
  ownedIds: ReadonlySet<number>,
): CardOption[] {
  return catalog
    .filter((card) => !ownedIds.has(card.id))
    .map((card) => ({ id: card.id, label: card.name }));
}

export function filterCardOptions(
  options: readonly CardOption[],
  query: string,
): CardOption[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return [...options];
  return options.filter((option) =>
    option.label.toLowerCase().includes(normalized),
  );
}

export function formatCardCount(count: number, total: number): string {
  return `Cards: ${count} / ${total}`;
}

export function formatCardImportSummary(
  result: CardBulkImportResult,
): string {
  const base = `Added ${result.added}, skipped ${result.skipped} already existing.`;
  if (result.invalid === 0) return base;
  return `${base} ${result.invalid} invalid line${
    result.invalid === 1 ? '' : 's'
  } not added.`;
}
