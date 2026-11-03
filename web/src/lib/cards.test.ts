import { describe, expect, it } from 'vitest';
import type {
  CardCatalogEntry,
  CharacterCardEntry,
  CharacterCardImportResult,
} from '../api/types';
import {
  buildCardOptions,
  buildCharacterCardList,
  filterCardOptions,
  filterCards,
  filterCharacterCards,
  formatCardCount,
  formatCardImportSummary,
  formatCharacterCardImportSummary,
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

describe('buildCharacterCardList', () => {
  function ownedEntry(
    characterId: number,
    cardId: number,
    cardName: string,
  ): CharacterCardEntry {
    return { characterId, cardId, cardName, grade: 'rare' };
  }

  const entries = [
    ownedEntry(2, 1, 'Zulu'),
    ownedEntry(1, 9, 'Zeta'),
    ownedEntry(1, 2, 'Alpha'),
    ...Array.from({ length: 22 }, (_, index) =>
      ownedEntry(1, 100 + index, `Card ${String(index).padStart(2, '0')}`),
    ),
  ];

  it('keeps only the character, sorts A to Z, and paginates by 10', () => {
    const result = buildCharacterCardList(entries, 1, '', 1);

    expect(result.owned).toHaveLength(24);
    expect(result.filtered).toHaveLength(24);
    expect(result.paged.items).toHaveLength(10);
    expect(result.paged.items.map((item) => item.cardName)).toEqual([
      'Alpha',
      'Card 00',
      'Card 01',
      'Card 02',
      'Card 03',
      'Card 04',
      'Card 05',
      'Card 06',
      'Card 07',
      'Card 08',
    ]);
    expect(result.paged.pageCount).toBe(3);
    expect(result.owned.some((item) => item.characterId === 2)).toBe(false);
  });

  it('searches every owned card before paginating and clamps the page', () => {
    const result = buildCharacterCardList(entries, 1, 'card 21', 99);

    expect(result.owned).toHaveLength(24);
    expect(result.filtered.map((item) => item.cardName)).toEqual(['Card 21']);
    expect(result.paged.page).toBe(1);
    expect(result.paged.items[0]?.cardName).toBe('Card 21');
  });

  it('returns an empty page for an unknown character', () => {
    const result = buildCharacterCardList(entries, 99, '', 3);

    expect(result.owned).toEqual([]);
    expect(result.filtered).toEqual([]);
    expect(result.paged.page).toBe(1);
    expect(result.paged.items).toEqual([]);
  });
});

describe('formatCharacterCardImportSummary', () => {
  function result(
    overrides: Partial<CharacterCardImportResult> = {},
  ): CharacterCardImportResult {
    return {
      added: 0,
      updated: 0,
      unchanged: 0,
      duplicates: 0,
      invalid: 0,
      invalidLines: [],
      ...overrides,
    };
  }

  it('lists only nonzero clauses in a fixed order', () => {
    expect(
      formatCharacterCardImportSummary(
        result({ added: 12, updated: 3, unchanged: 2 }),
      ),
    ).toBe('Imported: added 12, updated 3, unchanged 2.');
    expect(formatCharacterCardImportSummary(result({ added: 12 }))).toBe(
      'Imported: added 12.',
    );
  });

  it('reports nothing changed when every apply count is zero', () => {
    expect(formatCharacterCardImportSummary(result())).toBe(
      'Imported: nothing changed.',
    );
  });

  it('appends duplicate and invalid clauses with pluralization', () => {
    expect(
      formatCharacterCardImportSummary(
        result({ added: 1, duplicates: 1, invalid: 1 }),
      ),
    ).toBe(
      'Imported: added 1. 1 duplicate line skipped. 1 line not added.',
    );
    expect(
      formatCharacterCardImportSummary(
        result({ duplicates: 2, invalid: 2 }),
      ),
    ).toBe(
      'Imported: nothing changed. 2 duplicate lines skipped. 2 lines not added.',
    );
  });
});
