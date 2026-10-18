import { describe, expect, it } from 'vitest';
import { analyzeAddName, foldName } from './names';

const items = [
  { id: 1, name: 'Raven' },
  { id: 2, name: 'Ravenna' },
  { id: 3, name: 'Luna' },
];

describe('name helpers', () => {
  it('trims and folds ASCII case only', () => {
    expect(foldName('  Raven  ')).toBe('raven');
    expect(foldName('RAVEN')).toBe('raven');
    expect(foldName('Ä')).toBe('Ä');
    expect(foldName('ä')).toBe('ä');
  });

  it('returns no matches for blank input', () => {
    expect(analyzeAddName(items, '   ')).toEqual({
      trimmed: '',
      matches: [],
      exactMatch: undefined,
    });
  });

  it('detects an exact same-case duplicate', () => {
    const analysis = analyzeAddName(items, 'Raven');

    expect(analysis.exactMatch).toBe(items[0]);
    expect(analysis.matches).toEqual([items[0], items[1]]);
  });

  it('detects an exact case-insensitive duplicate', () => {
    const analysis = analyzeAddName(items, '  rAvEn  ');

    expect(analysis.trimmed).toBe('rAvEn');
    expect(analysis.exactMatch).toBe(items[0]);
  });

  it('lists partial matches without marking them exact', () => {
    const analysis = analyzeAddName(items, 'Rav');

    expect(analysis.exactMatch).toBeUndefined();
    expect(analysis.matches).toEqual([items[0], items[1]]);
  });

  it('keeps item order for multiple matches', () => {
    const analysis = analyzeAddName(items, 'a');

    expect(analysis.matches.map((item) => item.name)).toEqual([
      'Raven',
      'Ravenna',
      'Luna',
    ]);
  });

  it('does not treat non-ASCII case variants as duplicates', () => {
    const analysis = analyzeAddName([{ id: 1, name: 'Ä' }], 'ä');

    expect(analysis.matches).toEqual([]);
    expect(analysis.exactMatch).toBeUndefined();
  });

  it('does not mutate the input list', () => {
    const before = [...items];

    analyzeAddName(items, 'rav');
    expect(items).toEqual(before);
  });
});
