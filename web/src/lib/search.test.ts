import { describe, expect, it } from 'vitest';
import {
  filterByName,
  filterMatrixCharacters,
  isFilterActive,
  matchesName,
  normalizeQuery,
} from './search';

describe('search helpers', () => {
  it('trims queries but preserves internal spaces', () => {
    expect(normalizeQuery('  raven  ')).toBe('raven');
    expect(normalizeQuery('the  abyss')).toBe('the  abyss');
    expect(normalizeQuery('   ')).toBe('');
  });

  it('treats blank queries as no filter', () => {
    expect(isFilterActive('')).toBe(false);
    expect(isFilterActive('   ')).toBe(false);
    expect(isFilterActive(' r ')).toBe(true);
  });

  it('matches case-insensitive substrings', () => {
    expect(matchesName('Raven', '')).toBe(true);
    expect(matchesName('Raven', '   ')).toBe(true);
    expect(matchesName('Raven', 'rav')).toBe(true);
    expect(matchesName('Raven', 'AVE')).toBe(true);
    expect(matchesName('Raven', ' raven ')).toBe(true);
    expect(matchesName('Raven', 'vena')).toBe(false);
    expect(matchesName('Raven', 'rave n')).toBe(false);
  });

  it('filters without changing order or casing', () => {
    const items = [
      { id: 1, name: 'Raven' },
      { id: 2, name: 'Luna' },
      { id: 3, name: 'RAVENNA' },
    ];

    expect(filterByName(items, '')).toEqual(items);
    expect(filterByName(items, '   ')).toEqual(items);
    expect(filterByName(items, 'rav')).toEqual([items[0], items[2]]);
    expect(filterByName(items, 'nope')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const items = [{ name: 'Raven' }, { name: 'Luna' }];
    const before = [...items];

    filterByName(items, 'rav');
    expect(items).toEqual(before);
  });

  const characters = [
    { id: 1, name: 'Raven' },
    { id: 2, name: 'Luna' },
  ];

  it('hides fully done characters only when the remaining toggle is on', () => {
    const nests = [{ id: 10 }, { id: 11 }];
    const donePairs = new Set(['1:10', '1:11', '2:10']);

    expect(
      filterMatrixCharacters(characters, nests, donePairs, '', false),
    ).toEqual(characters);
    expect(
      filterMatrixCharacters(characters, nests, donePairs, '', true),
    ).toEqual([characters[1]]);
  });

  it('evaluates remaining against currently visible nests only', () => {
    const donePairs = new Set(['1:10']);

    expect(
      filterMatrixCharacters(characters, [{ id: 10 }], donePairs, '', true),
    ).toEqual([characters[1]]);
    expect(
      filterMatrixCharacters(characters, [{ id: 11 }], donePairs, '', true),
    ).toEqual(characters);
  });

  it('combines text search with the remaining toggle', () => {
    const nests = [{ id: 10 }, { id: 11 }];
    const donePairs = new Set(['1:10', '1:11', '2:10']);

    expect(
      filterMatrixCharacters(characters, nests, donePairs, 'lun', true),
    ).toEqual([characters[1]]);
    expect(
      filterMatrixCharacters(characters, nests, donePairs, 'rav', true),
    ).toEqual([]);
  });

  it('returns no characters for zero visible nests even with remaining on', () => {
    expect(
      filterMatrixCharacters(
        characters,
        [],
        new Set(),
        '',
        true,
      ),
    ).toEqual([]);
    expect(
      filterMatrixCharacters(characters, [], new Set(), '', false),
    ).toEqual(characters);
  });
});
