import { describe, expect, it } from 'vitest';
import {
  ENGRAVING_CATEGORIES,
  ENGRAVING_GRADE_META,
  ENGRAVING_GRADES,
  ENGRAVING_SLOT_COUNT,
  ENGRAVING_SLOT_DEFINITIONS,
  buildEngravingState,
  categoryForSlot,
  compareEngravingValues,
  findEngravingCandidates,
  gradeRank,
  isLowerEngravingValue,
  slotDefinition,
} from '../src/engraving';
import type {
  CharacterEngravingRow,
  EngravingCategory,
  EngravingGrade,
  EngravingValue,
} from '../src/engraving';
import type { CharacterRow } from '../src/progress';

function character(id: number, name: string): CharacterRow {
  return { id, name, createdAt: '2026-01-01T00:00:00.000Z' };
}

function value(
  id: number,
  category: EngravingCategory,
  grade: EngravingGrade,
  firstStatValue: number,
  secondStatValue: number | null = null,
): EngravingValue {
  return { id, category, grade, firstStatValue, secondStatValue };
}

function row(
  characterId: number,
  slot: number,
  valueId: number,
  thirdStatName: string | null = null,
  thirdStatValue: number | null = null,
): CharacterEngravingRow {
  return { characterId, slot, valueId, thirdStatName, thirdStatValue };
}

describe('engraving domain', () => {
  it('defines all 14 slots with their categories', () => {
    expect(ENGRAVING_SLOT_COUNT).toBe(14);
    expect(ENGRAVING_SLOT_DEFINITIONS).toHaveLength(14);
    expect(ENGRAVING_SLOT_DEFINITIONS.map((slot) => slot.label)).toEqual([
      'Main weapon',
      'Secondary weapon',
      'Head',
      'Upper',
      'Lower',
      'Gloves',
      'Boots',
      'Necklace',
      'Earring',
      'Ring 1',
      'Ring 2',
      'Wings',
      'Tail',
      'Decal',
    ]);
    expect(ENGRAVING_SLOT_DEFINITIONS.map((slot) => slot.slot)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
    expect(ENGRAVING_SLOT_DEFINITIONS.map((slot) => slot.category)).toEqual([
      'weapon',
      'weapon',
      'armor',
      'armor',
      'armor',
      'armor',
      'armor',
      'accessory',
      'accessory',
      'accessory',
      'accessory',
      'wtd',
      'wtd',
      'wtd',
    ]);
  });

  it('ranks grades and categories in display order', () => {
    expect(ENGRAVING_GRADES).toEqual(['rare', 'epic', 'unique', 'legend']);
    expect(ENGRAVING_GRADES.map(gradeRank)).toEqual([0, 1, 2, 3]);
    expect(ENGRAVING_GRADE_META.map((grade) => grade.rank)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(ENGRAVING_CATEGORIES).toEqual([
      'weapon',
      'armor',
      'accessory',
      'wtd',
    ]);
  });

  it('looks up slot definitions and categories', () => {
    expect(slotDefinition(1)).toEqual({
      slot: 1,
      label: 'Main weapon',
      category: 'weapon',
    });
    expect(slotDefinition(14)?.label).toBe('Decal');
    expect(slotDefinition(0)).toBeUndefined();
    expect(slotDefinition(15)).toBeUndefined();
    expect(categoryForSlot(8)).toBe('accessory');
    expect(categoryForSlot(99)).toBeUndefined();
  });

  it('orders values by category, grade rank, first stat, then id', () => {
    const values = [
      value(6, 'wtd', 'rare', 10),
      value(5, 'armor', 'legend', 200),
      value(4, 'armor', 'rare', 30),
      value(3, 'armor', 'rare', 20),
      value(2, 'weapon', 'epic', 40),
      value(1, 'weapon', 'epic', 40),
    ];

    expect([...values].sort(compareEngravingValues).map((item) => item.id))
      .toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('treats only a lower grade or same-grade lower first stat as lower', () => {
    const chosen = value(1, 'armor', 'unique', 108);

    expect(isLowerEngravingValue(value(2, 'armor', 'epic', 140), chosen)).toBe(
      true,
    );
    expect(
      isLowerEngravingValue(value(2, 'armor', 'unique', 100), chosen),
    ).toBe(true);
    expect(
      isLowerEngravingValue(value(2, 'armor', 'unique', 108), chosen),
    ).toBe(false);
    expect(
      isLowerEngravingValue(value(2, 'armor', 'unique', 112), chosen),
    ).toBe(false);
    expect(isLowerEngravingValue(value(2, 'armor', 'legend', 100), chosen)).toBe(
      false,
    );
    expect(isLowerEngravingValue(value(2, 'weapon', 'rare', 20), chosen)).toBe(
      false,
    );
    expect(
      isLowerEngravingValue(
        value(2, 'accessory', 'epic', 20, 999999),
        value(1, 'accessory', 'epic', 30, 1),
      ),
    ).toBe(true);
  });

  it('expands every character to all slots and computes empty counts', () => {
    const characters = [character(1, 'Raven'), character(2, 'Luna')];
    const values = [
      value(10, 'weapon', 'rare', 20),
      value(11, 'accessory', 'epic', 28, 56),
      value(12, 'weapon', 'legend', 160),
    ];
    const rows = [
      row(1, 1, 10, 'Critical Damage', 125),
      row(1, 8, 11),
      row(1, 2, 11),
      row(1, 14, 999),
    ];

    const state = buildEngravingState(characters, values, rows);

    expect(state.slotCount).toBe(14);
    expect(state.slotDefinitions).toEqual(ENGRAVING_SLOT_DEFINITIONS);
    expect(state.valueTables.weapon.map((item) => item.id)).toEqual([10, 12]);
    expect(state.valueTables.armor).toEqual([]);
    expect(state.slots).toHaveLength(28);

    const raven = state.perCharacter[0]!;
    expect(raven).toEqual({
      characterId: 1,
      name: 'Raven',
      emptyCount: 12,
      filledCount: 2,
      emptySlots: expect.arrayContaining([
        { slot: 2, label: 'Secondary weapon' },
        { slot: 14, label: 'Decal' },
      ]),
    });
    expect(raven.emptySlots).toHaveLength(12);

    const luna = state.perCharacter[1]!;
    expect(luna.emptyCount).toBe(14);
    expect(luna.filledCount).toBe(0);
    expect(luna.emptySlots).toHaveLength(14);

    const ravenMain = state.slots.find(
      (slot) => slot.characterId === 1 && slot.slot === 1,
    );
    expect(ravenMain).toEqual({
      characterId: 1,
      slot: 1,
      category: 'weapon',
      label: 'Main weapon',
      isEmpty: false,
      valueId: 10,
      grade: 'rare',
      firstStatValue: 20,
      secondStatValue: null,
      thirdStatName: 'Critical Damage',
      thirdStatValue: 125,
    });

    const ravenSecondary = state.slots.find(
      (slot) => slot.characterId === 1 && slot.slot === 2,
    );
    expect(ravenSecondary?.isEmpty).toBe(true);
    expect(ravenSecondary?.valueId).toBeNull();
  });

  it('treats a missing or wrong-category referenced value as empty', () => {
    const state = buildEngravingState(
      [character(1, 'Raven')],
      [value(10, 'weapon', 'rare', 20)],
      [row(1, 1, 999), row(1, 3, 10)],
    );

    expect(state.perCharacter[0]?.emptyCount).toBe(14);
    expect(state.slots.every((slot) => slot.isEmpty)).toBe(true);
  });

  it('finds empty slots first, then only lower values ordered by value then name', () => {
    const chosen = value(100, 'armor', 'unique', 108);
    const characters = [
      character(1, 'Zed'),
      character(2, 'Luna'),
      character(3, 'Aria'),
      character(4, 'Equal'),
      character(5, 'Higher'),
      character(6, 'Mira'),
      character(7, 'Abel'),
    ];
    const values = [
      chosen,
      value(101, 'armor', 'rare', 24),
      value(102, 'armor', 'epic', 40),
      value(103, 'armor', 'unique', 108),
      value(104, 'armor', 'legend', 160),
    ];
    const rows = [
      row(2, 3, 101),
      row(3, 3, 101),
      row(4, 3, 103),
      row(5, 3, 104),
      row(6, 3, 102),
      row(7, 3, 102),
      row(1, 3, 999),
    ];

    const results = findEngravingCandidates(
      characters,
      values,
      rows,
      slotDefinition(3)!,
      chosen,
    );

    expect(results.map((result) => result.name)).toEqual([
      'Zed',
      'Aria',
      'Luna',
      'Abel',
      'Mira',
    ]);
    expect(results.map((result) => result.isEmpty)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(results.map((result) => result.valueId)).toEqual([
      null,
      101,
      101,
      102,
      102,
    ]);
    expect(
      results.some((result) => result.name === 'Equal' || result.name === 'Higher'),
    ).toBe(false);
  });

  it('breaks finder ties by name, then character id', () => {
    const chosen = value(100, 'weapon', 'legend', 160);
    const characters = [character(2, 'same'), character(1, 'Same')];

    const results = findEngravingCandidates(
      characters,
      [chosen],
      [],
      slotDefinition(1)!,
      chosen,
    );

    expect(results.map((result) => result.characterId)).toEqual([1, 2]);
  });

  it('treats a wrong-category stored value as an empty finder result', () => {
    const chosen = value(100, 'armor', 'unique', 108);
    const candidates = findEngravingCandidates(
      [character(1, 'Raven')],
      [chosen, value(101, 'weapon', 'rare', 20)],
      [row(1, 3, 101)],
      slotDefinition(3)!,
      chosen,
    );

    expect(candidates).toEqual([
      {
        characterId: 1,
        name: 'Raven',
        isEmpty: true,
        valueId: null,
        grade: null,
        firstStatValue: null,
        secondStatValue: null,
      },
    ]);
  });
});
