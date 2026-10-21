import { describe, expect, it } from 'vitest';
import {
  HERALDRY_SLOT_COUNT,
  buildHeraldryState,
  buildSlotState,
  computeStatus,
  rankForLevel,
  sortLevelsDescending,
} from '../src/heraldry';
import type {
  HeraldryRow,
  HeraldryRarity,
  PlateRow,
} from '../src/heraldry';
import type { CharacterRow } from '../src/progress';

function character(id: number, name: string): CharacterRow {
  return { id, name, createdAt: '2026-01-01T00:00:00.000Z' };
}

function plate(id: number, name: string): PlateRow {
  return { id, name, createdAt: '2026-01-01T00:00:00.000Z' };
}

function row(
  characterId: number,
  slot: number,
  plateId: number,
  level: number,
  rarity: HeraldryRarity,
  hasThirdStat: boolean,
): HeraldryRow {
  return { characterId, slot, plateId, level, rarity, hasThirdStat };
}

describe('computeStatus', () => {
  it('follows the full rarity, rank, and third-stat rule table', () => {
    expect(computeStatus('epic', 0, true)).toBe('ok');
    expect(computeStatus('epic', 0, false)).toBe('ok');

    expect(computeStatus('epic', 1, true)).toBe('ok');
    expect(computeStatus('epic', 1, false)).toBe('recommended');

    expect(computeStatus('epic', 2, true)).toBe('needs-upgrade');
    expect(computeStatus('epic', 2, false)).toBe('needs-upgrade');
    expect(computeStatus('epic', Number.POSITIVE_INFINITY, true)).toBe(
      'needs-upgrade',
    );

    expect(computeStatus('rare', 0, true)).toBe('recommended');
    expect(computeStatus('rare', 0, false)).toBe('needs-upgrade');

    expect(computeStatus('rare', 1, true)).toBe('needs-upgrade');
    expect(computeStatus('rare', 1, false)).toBe('needs-upgrade');
    expect(computeStatus('rare', 2, true)).toBe('needs-upgrade');
  });
});

describe('rankForLevel', () => {
  it('ranks descending and treats unknown levels as rank 2+', () => {
    const levels = sortLevelsDescending([25, 30, 27]);

    expect(levels).toEqual([30, 27, 25]);
    expect(rankForLevel(30, levels)).toBe(0);
    expect(rankForLevel(27, levels)).toBe(1);
    expect(rankForLevel(25, levels)).toBe(2);
    expect(rankForLevel(20, levels)).toBe(Number.POSITIVE_INFINITY);
    expect(rankForLevel(30, [])).toBe(Number.POSITIVE_INFINITY);
  });

  it('ranks a single level as the cap only', () => {
    const levels = sortLevelsDescending([30]);

    expect(levels).toEqual([30]);
    expect(rankForLevel(30, levels)).toBe(0);
    expect(rankForLevel(27, levels)).toBe(Number.POSITIVE_INFINITY);
  });

  it('does not mutate the input array', () => {
    const levels = [25, 30, 27];

    const sorted = sortLevelsDescending(levels);

    expect(sorted).toEqual([30, 27, 25]);
    expect(levels).toEqual([25, 30, 27]);
  });
});

describe('buildSlotState', () => {
  it('recalculates status when a level is inserted in the middle', () => {
    const before = buildSlotState(
      row(1, 1, 1, 25, 'epic', true),
      'Bear',
      [30, 25, 20],
    );
    expect(before.status).toBe('ok');

    const after = buildSlotState(
      row(1, 1, 1, 25, 'epic', true),
      'Bear',
      [30, 27, 25, 20],
    );
    expect(after.status).toBe('needs-upgrade');
  });

  it('marks rare slots by third stat at the cap', () => {
    expect(
      buildSlotState(row(1, 1, 1, 30, 'rare', true), 'Bear', [30]).status,
    ).toBe('recommended');
    expect(
      buildSlotState(row(1, 1, 1, 30, 'rare', false), 'Bear', [30]).status,
    ).toBe('needs-upgrade');
  });

  it('defensively marks a level outside the list as needs-upgrade', () => {
    const slot = buildSlotState(
      row(1, 1, 1, 20, 'epic', true),
      'Bear',
      [30, 27, 25],
    );

    expect(slot.isEmpty).toBe(false);
    expect(slot.status).toBe('needs-upgrade');
  });
});

describe('buildHeraldryState', () => {
  it('expands every character to the full slot grid with summaries', () => {
    const state = buildHeraldryState(
      [character(1, 'Raven'), character(2, 'Luna')],
      [25, 30, 27],
      [plate(1, 'Bear'), plate(2, 'Wolf')],
      [
        row(1, 1, 1, 30, 'epic', true),
        row(1, 2, 2, 27, 'epic', false),
        row(2, 3, 1, 25, 'rare', true),
        row(2, 4, 2, 30, 'rare', true),
      ],
    );

    expect(state.slotCount).toBe(HERALDRY_SLOT_COUNT);
    expect(state.levels).toEqual([30, 27, 25]);
    expect(state.cap).toBe(30);
    expect(state.slots).toHaveLength(2 * HERALDRY_SLOT_COUNT);

    const ravenSlots = state.slots.filter((slot) => slot.characterId === 1);
    expect(ravenSlots.map((slot) => slot.slot)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(ravenSlots[0]).toMatchObject({
      isEmpty: false,
      plateId: 1,
      plateName: 'Bear',
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
      status: 'ok',
    });
    expect(ravenSlots[1]).toMatchObject({
      isEmpty: false,
      plateId: 2,
      plateName: 'Wolf',
      level: 27,
      rarity: 'epic',
      hasThirdStat: false,
      status: 'recommended',
    });
    expect(ravenSlots[2]).toEqual({
      characterId: 1,
      slot: 3,
      isEmpty: true,
      plateId: null,
      plateName: null,
      level: null,
      rarity: null,
      hasThirdStat: false,
      status: 'needs-upgrade',
    });

    expect(state.perCharacter).toEqual([
      {
        characterId: 1,
        name: 'Raven',
        needsUpgrade: 6,
        recommended: 1,
        ok: 1,
        empty: 6,
        status: 'needs-upgrade',
      },
      {
        characterId: 2,
        name: 'Luna',
        needsUpgrade: 7,
        recommended: 1,
        ok: 0,
        empty: 6,
        status: 'needs-upgrade',
      },
    ]);

    const lunaFilled = state.slots.filter(
      (slot) => slot.characterId === 2 && !slot.isEmpty,
    );
    expect(lunaFilled.map((slot) => slot.status)).toEqual([
      'needs-upgrade',
      'recommended',
    ]);
  });

  it('reports recommended and ok summary states', () => {
    const levels = [30];
    const plates = [plate(1, 'Bear')];
    const recommendedRows = Array.from(
      { length: HERALDRY_SLOT_COUNT },
      (_, index) => row(1, index + 1, 1, 30, 'epic', true),
    );
    recommendedRows[0] = row(1, 1, 1, 30, 'rare', true);

    const recommended = buildHeraldryState(
      [character(1, 'Raven')],
      levels,
      plates,
      recommendedRows,
    );
    expect(recommended.perCharacter[0]).toMatchObject({
      needsUpgrade: 0,
      recommended: 1,
      ok: 7,
      empty: 0,
      status: 'recommended',
    });

    const ok = buildHeraldryState(
      [character(1, 'Raven')],
      levels,
      plates,
      Array.from({ length: HERALDRY_SLOT_COUNT }, (_, index) =>
        row(1, index + 1, 1, 30, 'epic', true),
      ),
    );
    expect(ok.perCharacter[0]).toMatchObject({
      needsUpgrade: 0,
      recommended: 0,
      ok: 8,
      empty: 0,
      status: 'ok',
    });
  });

  it('handles an empty level list with every slot empty', () => {
    const state = buildHeraldryState(
      [character(1, 'Raven')],
      [],
      [],
      [],
    );

    expect(state.levels).toEqual([]);
    expect(state.cap).toBeNull();
    expect(state.slots).toHaveLength(HERALDRY_SLOT_COUNT);
    expect(state.slots.every((slot) => slot.isEmpty)).toBe(true);
    expect(state.slots.every((slot) => slot.status === 'needs-upgrade')).toBe(
      true,
    );
    expect(state.perCharacter[0]).toMatchObject({
      needsUpgrade: HERALDRY_SLOT_COUNT,
      recommended: 0,
      ok: 0,
      empty: HERALDRY_SLOT_COUNT,
      status: 'needs-upgrade',
    });
  });

  it('returns no slots for no characters', () => {
    const state = buildHeraldryState([], [30], [plate(1, 'Bear')], []);

    expect(state.slots).toEqual([]);
    expect(state.perCharacter).toEqual([]);
  });
});
