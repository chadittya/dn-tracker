import { describe, expect, it } from 'vitest';
import type {
  CardCatalogEntry,
  CharacterCardEntry,
} from '../api/types';
import {
  buildCardOptions,
  filterCardOptions,
  filterCards,
  filterCharacterCards,
  formatCardCount,
  formatCardImportSummary,
  sortCardsAZ,
  sortCharacterCardEntries,
} from './cards';

function card(id: number, name: string): CardCatalogEntry {
  return { id, name, createdAt: '2026-01-01T00:00:00.000Z' };
}

function entry(
  characterId: number,
  cardId: number,
  cardName: string,
): CharacterCardEntry {
  return { characterId, cardId, cardName, grade: 'magic' };
}

describe('sortCardsAZ', () => {
  it('sorts A to Z case-insensitively, ties by id, and does not mutate', () => {
    const input = [card(3, 'zeta'), card(2, 'Beta'), card(1, 'alpha')];
    expect(sortCardsAZ(input).map((item) => item.id)).toEqual([1, 2, 3]);
    expect(input.map((item) => item.id)).toEqual([3, 2, 1]);
  });
});

describe('sortCharacterCardEntries', () => {
  it('sorts by card name then id', () => {
    const input = [
      entry(1, 3, 'zeta'),
      entry(1, 2, 'Beta'),
      entry(1, 1, 'alpha'),
    ];
    expect(
      sortCharacterCardEntries(input).map((item) => item.cardId),
    ).toEqual([1, 2, 3]);
  });
});

describe('filters', () => {
  it('trims and matches contains, case-insensitively', () => {
    const cards = [card(1, 'Red Dragon'), card(2, 'Blue Dragon')];
    expect(filterCards(cards, '  DRAGON ').map((item) => item.id)).toEqual([
      1, 2,
    ]);
    expect(filterCards(cards, 'red').map((item) => item.id)).toEqual([1]);
    expect(filterCards(cards, '   ').map((item) => item.id)).toEqual([1, 2]);
  });

  it('filters character card entries by card name', () => {
    const entries = [
      entry(1, 1, 'Red Dragon'),
      entry(1, 2, 'Gold Dragon'),
    ];
    expect(filterCharacterCards(entries, 'gold')).toEqual([entries[1]]);
  });
});

describe('card options', () => {
  it('excludes owned cards and filters by label', () => {
    const options = buildCardOptions(
      [card(1, 'Alpha'), card(2, 'Beta'), card(3, 'Gamma')],
      new Set([2]),
    );
    expect(options).toEqual([
      { id: 1, label: 'Alpha' },
      { id: 3, label: 'Gamma' },
    ]);
    expect(filterCardOptions(options, 'gam')).toEqual([
      { id: 3, label: 'Gamma' },
    ]);
  });
});

describe('formatting', () => {
  it('formats counts and import summaries', () => {
    expect(formatCardCount(3, 91)).toBe('Cards: 3 / 91');
    expect(
      formatCardImportSummary({ added: 12, skipped: 79, invalid: 0 }),
    ).toBe('Added 12, skipped 79 already existing.');
    expect(
      formatCardImportSummary({ added: 12, skipped: 79, invalid: 1 }),
    ).toBe(
      'Added 12, skipped 79 already existing. 1 invalid line not added.',
    );
    expect(
      formatCardImportSummary({ added: 2, skipped: 0, invalid: 3 }),
    ).toBe(
      'Added 2, skipped 0 already existing. 3 invalid lines not added.',
    );
  });
});
