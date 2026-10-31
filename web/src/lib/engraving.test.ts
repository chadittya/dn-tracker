import { describe, expect, it } from 'vitest';
import type {
  Character,
  EngravingCategoryMeta,
  EngravingCharacterSummary,
  EngravingSlotDefinition,
} from '../api/types';
import {
  buildEngravingEmptyList,
  filterEngravingCharacters,
  formatEngravingValue,
  formatPercent,
  parsePercentInput,
  visibleSlotDefinitions,
} from './engraving';

describe('formatPercent', () => {
  it('always prints two decimals using integer maths', () => {
    expect(formatPercent(28)).toBe('0.28%');
    expect(formatPercent(57)).toBe('0.57%');
    expect(formatPercent(115)).toBe('1.15%');
    expect(formatPercent(100)).toBe('1.00%');
    expect(formatPercent(5)).toBe('0.05%');
    expect(formatPercent(12345)).toBe('123.45%');
  });
});

describe('parsePercentInput', () => {
  it.each([
    ['0.29', 29],
    ['0.57', 57],
    ['1.15', 115],
    ['.5', 50],
    [' 0.29 ', 29],
    ['5', 500],
  ])('accepts %s as %i hundredths', (raw, expected) => {
    expect(parsePercentInput(raw)).toBe(expected);
  });

  it.each([
    ['1,5'],
    ['0.001'],
    ['1.'],
    ['1e2'],
    ['-0.5'],
    ['+0.5'],
    [''],
    ['   '],
    ['abc'],
    ['.'],
    ['0'],
    ['0.00'],
  ])('rejects %s', (raw) => {
    expect(parsePercentInput(raw)).toBeNull();
  });
});

describe('formatEngravingValue', () => {
  const weapon: EngravingCategoryMeta = {
    key: 'weapon',
    label: 'Weapon',
    firstStatLabel: 'Attack/Magic Attack',
    secondStatLabel: null,
  };
  const armor: EngravingCategoryMeta = {
    key: 'armor',
    label: 'Armor',
    firstStatLabel: 'Defense/Magic Defense',
    secondStatLabel: null,
  };
  const accessory: EngravingCategoryMeta = {
    key: 'accessory',
    label: 'Accessory',
    firstStatLabel: 'Attack/Magic Attack',
    secondStatLabel: 'Max HP',
  };
  const wtd: EngravingCategoryMeta = {
    key: 'wtd',
    label: 'W/T/D',
    firstStatLabel: 'Attack/Magic Attack',
    secondStatLabel: 'Crit',
  };

  it('labels all four categories', () => {
    expect(
      formatEngravingValue(
        { firstStatValue: 28, secondStatValue: null },
        weapon,
      ),
    ).toBe('0.28% Attack/Magic Attack');
    expect(
      formatEngravingValue(
        { firstStatValue: 108, secondStatValue: null },
        armor,
      ),
    ).toBe('1.08% Defense/Magic Defense');
    expect(
      formatEngravingValue(
        { firstStatValue: 28, secondStatValue: 56 },
        accessory,
      ),
    ).toBe('0.28% Attack/Magic Attack · 0.56% Max HP');
    expect(
      formatEngravingValue(
        { firstStatValue: 26, secondStatValue: 70 },
        wtd,
      ),
    ).toBe('0.26% Attack/Magic Attack · 0.70% Crit');
  });
});

describe('slot and character filtering', () => {
  const definitions: EngravingSlotDefinition[] = [
    { slot: 1, label: 'Main weapon', category: 'weapon' },
    { slot: 2, label: 'Secondary weapon', category: 'weapon' },
    { slot: 3, label: 'Head', category: 'armor' },
  ];
  const characters: Character[] = [
    { id: 1, name: 'Raven', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 2, name: 'Luna', createdAt: '2026-01-02T00:00:00.000Z' },
  ];

  it('shows every column or only the selected slot column', () => {
    expect(visibleSlotDefinitions(definitions, null)).toEqual(definitions);
    expect(visibleSlotDefinitions(definitions, 3)).toEqual([
      definitions[2],
    ]);
    expect(visibleSlotDefinitions(definitions, 14)).toEqual([]);
  });

  it('filters characters by name only', () => {
    expect(filterEngravingCharacters(characters, '')).toHaveLength(2);
    expect(filterEngravingCharacters(characters, ' rav ')).toEqual([
      characters[0],
    ]);
    expect(filterEngravingCharacters(characters, 'nobody')).toEqual([]);
  });
});

describe('buildEngravingEmptyList', () => {
  function summary(
    characterId: number,
    name: string,
    emptyCount: number,
  ): EngravingCharacterSummary {
    return {
      characterId,
      name,
      emptyCount,
      filledCount: 14 - emptyCount,
      emptySlots: Array.from({ length: emptyCount }, (_, index) => ({
        slot: index + 1,
        label: `Slot ${index + 1}`,
      })),
    };
  }

  it('sorts by empty count, then name, and shows three slots plus +N', () => {
    const list = buildEngravingEmptyList([
      summary(1, 'Zed', 3),
      summary(2, 'Luna', 5),
      summary(3, 'Aria', 5),
      summary(4, 'Full', 0),
    ]);

    expect(list.items.map((item) => item.name)).toEqual([
      'Aria',
      'Luna',
      'Zed',
    ]);
    expect(list.items[0]).toMatchObject({
      emptyCount: 5,
      slots: ['Slot 1', 'Slot 2', 'Slot 3'],
      hiddenSlotCount: 2,
    });
    expect(list.more).toBe(0);
    expect(list.allFilled).toBe(false);
  });

  it('caps the list and reports how many characters are hidden', () => {
    const summaries = Array.from({ length: 12 }, (_, index) =>
      summary(index + 1, `Character ${index + 1}`, 14 - index),
    );
    const list = buildEngravingEmptyList(summaries, 10);

    expect(list.items).toHaveLength(10);
    expect(list.more).toBe(2);
  });

  it('reports all filled when every character has no empty slot', () => {
    const list = buildEngravingEmptyList([summary(1, 'Aria', 0)]);
    expect(list.items).toEqual([]);
    expect(list.more).toBe(0);
    expect(list.allFilled).toBe(true);
  });
});
