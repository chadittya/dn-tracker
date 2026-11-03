import { describe, expect, it } from 'vitest';
import {
  buildCardsState,
  cardGradeRank,
  compareCardNames,
  findCardCandidates,
  isLowerCardGrade,
  matchCardGrade,
  planBulkCardImport,
  planCharacterCardImport,
  sortCardCatalog,
} from '../src/cards';
import type {
  CardRow,
  CharacterCardRow,
  CardGrade,
} from '../src/cards';
import type { CharacterRow } from '../src/progress';

function character(id: number, name: string): CharacterRow {
  return { id, name, createdAt: '2026-01-01T00:00:00.000Z' };
}

function card(id: number, name: string): CardRow {
  return { id, name, createdAt: '2026-01-01T00:00:00.000Z' };
}

function entry(
  characterId: number,
  cardId: number,
  grade: CardGrade,
): CharacterCardRow {
  return { characterId, cardId, grade };
}

describe('card grades', () => {
  it('orders Magic < Rare < Epic < Unique < Legend', () => {
    expect(
      (['magic', 'rare', 'epic', 'unique', 'legend'] as const).map(
        cardGradeRank,
      ),
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it('treats a missing card and lower grades as lower than the target', () => {
    expect(isLowerCardGrade(null, 'magic')).toBe(true);
    expect(isLowerCardGrade('magic', 'epic')).toBe(true);
    expect(isLowerCardGrade('rare', 'rare')).toBe(false);
    expect(isLowerCardGrade('legend', 'epic')).toBe(false);
  });
});

describe('compareCardNames', () => {
  it('folds ASCII case and ties equal names by id', () => {
    expect(compareCardNames({ id: 1, name: 'alpha' }, { id: 2, name: 'Beta' })).toBeLessThan(0);
    expect(compareCardNames({ id: 1, name: 'Red Dragon' }, { id: 2, name: 'red dragon' })).toBe(0);
  });

  it('does not fold non-ASCII case pairs', () => {
    expect(compareCardNames({ id: 1, name: 'É' }, { id: 2, name: 'é' })).toBeLessThan(0);
  });

  it('sorts A to Z without mutating the input', () => {
    const input = [card(3, 'Zeta'), card(2, 'beta'), card(1, 'Alpha')];
    const sorted = sortCardCatalog(input);
    expect(sorted.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(input.map((item) => item.id)).toEqual([3, 2, 1]);
  });
});

describe('buildCardsState', () => {
  it('sorts the catalog, resolves names, and counts per character', () => {
    const state = buildCardsState(
      [character(1, 'Aria'), character(2, 'Bran'), character(3, 'Cleo')],
      [card(3, 'Red Dragon'), card(1, 'alpha'), card(2, 'Beta')],
      [
        entry(1, 3, 'legend'),
        entry(1, 1, 'magic'),
        entry(2, 2, 'epic'),
        entry(1, 99, 'rare'),
        entry(99, 1, 'rare'),
      ],
    );

    expect(state.catalog.map((item) => item.name)).toEqual([
      'alpha',
      'Beta',
      'Red Dragon',
    ]);
    expect(state.entries).toEqual([
      { characterId: 1, cardId: 1, cardName: 'alpha', grade: 'magic' },
      { characterId: 1, cardId: 3, cardName: 'Red Dragon', grade: 'legend' },
      { characterId: 2, cardId: 2, cardName: 'Beta', grade: 'epic' },
    ]);
    expect(state.perCharacter).toEqual([
      { characterId: 1, name: 'Aria', count: 2, total: 3 },
      { characterId: 2, name: 'Bran', count: 1, total: 3 },
      { characterId: 3, name: 'Cleo', count: 0, total: 3 },
    ]);
  });
});

describe('findCardCandidates', () => {
  it('lists missing first, then lowest grades, then name', () => {
    const candidates = findCardCandidates(
      [
        character(1, 'Zed'),
        character(2, 'Aria'),
        character(3, 'Bran'),
        character(4, 'Cleo'),
        character(5, 'Dana'),
      ],
      [
        entry(1, 7, 'rare'),
        entry(2, 7, 'magic'),
        entry(4, 7, 'epic'),
        entry(5, 7, 'legend'),
      ],
      7,
      'epic',
    );

    expect(candidates).toEqual([
      { characterId: 3, name: 'Bran', grade: null },
      { characterId: 2, name: 'Aria', grade: 'magic' },
      { characterId: 1, name: 'Zed', grade: 'rare' },
    ]);
  });

  it('excludes characters without an entry for another card', () => {
    const candidates = findCardCandidates(
      [character(1, 'Aria')],
      [entry(1, 8, 'magic')],
      7,
      'magic',
    );
    expect(candidates).toEqual([{ characterId: 1, name: 'Aria', grade: null }]);
  });
});

describe('planBulkCardImport', () => {
  it('trims, ignores blanks, and splits invalid, existing and duplicate lines', () => {
    const plan = planBulkCardImport(
      [
        '  Red Dragon  ',
        '',
        'red dragon',
        'Blue Dragon',
        'Existing Card',
        'existing card',
        'x'.repeat(51),
        'y'.repeat(51),
      ].join('\n'),
      ['Existing Card'],
    );

    expect(plan).toEqual({
      names: ['Red Dragon', 'Blue Dragon'],
      added: 2,
      skipped: 3,
      invalid: 2,
    });
  });

  it('counts nothing for empty or whitespace-only text', () => {
    expect(planBulkCardImport(' \r\n\t\r', [])).toEqual({
      names: [],
      added: 0,
      skipped: 0,
      invalid: 0,
    });
  });
});

describe('matchCardGrade', () => {
  it('trims and matches ASCII case-insensitively', () => {
    expect(matchCardGrade(' Magic ')).toBe('magic');
    expect(matchCardGrade('LEGEND')).toBe('legend');
    expect(matchCardGrade('Epic')).toBe('epic');
    expect(matchCardGrade('Mythic')).toBeNull();
    expect(matchCardGrade('')).toBeNull();
  });
});

describe('planCharacterCardImport', () => {
  const catalog = [
    card(1, 'Red Dragon'),
    card(2, 'Blue Dragon, Fire'),
    card(3, 'Gold Dragon'),
  ];

  it('splits on the last comma and matches names and grades case-insensitively', () => {
    const plan = planCharacterCardImport(
      ' red dragon , epic \nBLUE DRAGON, FIRE, LEGEND\n',
      catalog,
      1,
      [],
    );

    expect(plan).toEqual({
      operations: [
        { cardId: 1, cardName: 'Red Dragon', grade: 'epic' },
        { cardId: 2, cardName: 'Blue Dragon, Fire', grade: 'legend' },
      ],
      added: 2,
      updated: 0,
      unchanged: 0,
      duplicates: 0,
      invalid: 0,
      invalidLines: [],
    });
  });

  it('ignores empty lines and reports every invalid kind in order', () => {
    const plan = planCharacterCardImport(
      [
        '',
        'Missing Comma',
        ', Epic',
        'Red Dragon,',
        'Unknown Card, Epic',
        'Red Dragon, Mythic',
        '   ',
      ].join('\n'),
      catalog,
      1,
      [],
    );

    expect(plan.added).toBe(0);
    expect(plan.invalid).toBe(5);
    expect(plan.invalidLines).toEqual([
      'Missing Comma',
      ', Epic',
      'Red Dragon,',
      'Unknown Card, Epic',
      'Red Dragon, Mythic',
    ]);
  });

  it('counts added, updated and unchanged against existing rows', () => {
    const rows = [entry(1, 3, 'rare'), entry(2, 3, 'legend')];

    const unchanged = planCharacterCardImport(
      'Gold Dragon, Rare',
      catalog,
      1,
      rows,
    );
    expect(unchanged.unchanged).toBe(1);
    expect(unchanged.operations).toEqual([]);

    const updated = planCharacterCardImport(
      'Gold Dragon, Legend',
      catalog,
      1,
      rows,
    );
    expect(updated.updated).toBe(1);
    expect(updated.operations).toEqual([
      { cardId: 3, cardName: 'Gold Dragon', grade: 'legend' },
    ]);
  });

  it('lets the first valid occurrence win and counts later lines as duplicates', () => {
    const plan = planCharacterCardImport(
      'Red Dragon, Epic\nred dragon, Legend\nRed Dragon, Mythic',
      catalog,
      1,
      [],
    );

    expect(plan.added).toBe(1);
    expect(plan.duplicates).toBe(2);
    expect(plan.invalid).toBe(0);
    expect(plan.operations).toEqual([
      { cardId: 1, cardName: 'Red Dragon', grade: 'epic' },
    ]);
  });

  it('does not let an invalid line claim a card for a later valid line', () => {
    const plan = planCharacterCardImport(
      'Red Dragon, Mythic\nRed Dragon, Legend',
      catalog,
      1,
      [],
    );

    expect(plan.invalid).toBe(1);
    expect(plan.added).toBe(1);
    expect(plan.duplicates).toBe(0);
    expect(plan.invalidLines).toEqual(['Red Dragon, Mythic']);
    expect(plan.operations).toEqual([
      { cardId: 1, cardName: 'Red Dragon', grade: 'legend' },
    ]);
  });

  it('ignores rows belonging to other characters', () => {
    const plan = planCharacterCardImport(
      'Gold Dragon, Rare',
      catalog,
      7,
      [entry(1, 3, 'rare')],
    );

    expect(plan.added).toBe(1);
    expect(plan.unchanged).toBe(0);
  });

  it('uses ASCII-only name folding like NOCASE', () => {
    const plan = planCharacterCardImport(
      'äther, Epic',
      [card(9, 'Äther')],
      1,
      [],
    );

    expect(plan.added).toBe(0);
    expect(plan.invalid).toBe(1);
    expect(plan.invalidLines).toEqual(['äther, Epic']);
  });

  it('returns zero counts for empty or whitespace-only text', () => {
    expect(planCharacterCardImport(' \r\n\t', catalog, 1, [])).toEqual({
      operations: [],
      added: 0,
      updated: 0,
      unchanged: 0,
      duplicates: 0,
      invalid: 0,
      invalidLines: [],
    });
  });
});
