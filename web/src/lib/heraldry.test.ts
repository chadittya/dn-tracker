import { describe, expect, it } from 'vitest';
import type {
  Character,
  HeraldryCharacterSummary,
  HeraldrySlot,
  HeraldryState,
  HeraldryStatus,
} from '../api/types';
import {
  buildHeraldryUpgradeList,
  filterHeraldryCharacters,
} from './heraldry';

function character(id: number, name: string): Character {
  return { id, name, createdAt: '2026-01-01T00:00:00.000Z' };
}

function slot(
  characterId: number,
  slotNumber: number,
  status: HeraldryStatus,
  plateId: number | null = null,
  plateName: string | null = null,
): HeraldrySlot {
  const emptyPlate = plateId === null;

  return {
    characterId,
    slot: slotNumber,
    isEmpty: emptyPlate,
    plateId,
    plateName,
    level: emptyPlate ? null : 30,
    rarity: emptyPlate ? null : 'epic',
    hasThirdStat: false,
    status,
  };
}

function summary(
  characterId: number,
  name: string,
  status: HeraldryStatus,
  needsUpgrade: number,
  recommended: number,
  ok: number,
  empty: number,
): HeraldryCharacterSummary {
  return {
    characterId,
    name,
    needsUpgrade,
    recommended,
    ok,
    empty,
    status,
  };
}

function state(
  characters: Character[],
  slots: HeraldrySlot[],
  perCharacter: HeraldryCharacterSummary[] = [],
  levels: number[] = [30],
): HeraldryState {
  return {
    slotCount: 8,
    levels,
    cap: levels[0] ?? null,
    plates: [],
    slots,
    perCharacter,
  };
}

describe('filterHeraldryCharacters', () => {
  const characters = [
    character(1, 'Raven'),
    character(2, 'Luna'),
    character(3, 'Ravenna'),
  ];
  const slots = [
    slot(1, 1, 'ok', 10, 'Bear'),
    slot(1, 2, 'recommended', 11, 'Wolf'),
    slot(1, 3, 'needs-upgrade'),
    slot(2, 1, 'recommended', 10, 'Bear'),
    slot(2, 2, 'needs-upgrade', 12, 'Eagle'),
    slot(3, 1, 'ok', 11, 'Wolf'),
  ];

  it('matches character names after trimming and case-insensitively', () => {
    expect(
      filterHeraldryCharacters(characters, slots, '  raV  ', null, 'all').map(
        (entry) => entry.name,
      ),
    ).toEqual(['Raven', 'Ravenna']);
  });

  it('filters to characters that use a plate', () => {
    expect(
      filterHeraldryCharacters(characters, slots, '', 10, 'all').map(
        (entry) => entry.name,
      ),
    ).toEqual(['Raven', 'Luna']);
  });

  it('never lets an empty slot satisfy a plate filter', () => {
    expect(
      filterHeraldryCharacters(characters, slots, '', 12, 'all'),
    ).toEqual([characters[1]]);
    expect(
      filterHeraldryCharacters(
        characters,
        [slot(1, 1, 'needs-upgrade')],
        '',
        12,
        'all',
      ),
    ).toEqual([]);
  });

  it('matches status on any slot when no plate is selected', () => {
    expect(
      filterHeraldryCharacters(characters, slots, '', null, 'recommended').map(
        (entry) => entry.name,
      ),
    ).toEqual(['Raven', 'Luna']);
    expect(
      filterHeraldryCharacters(characters, slots, '', null, 'needs-upgrade').map(
        (entry) => entry.name,
      ),
    ).toEqual(['Raven', 'Luna']);
  });

  it('applies status to the selected plate slot only', () => {
    expect(
      filterHeraldryCharacters(
        characters,
        slots,
        '',
        10,
        'recommended',
      ).map((entry) => entry.name),
    ).toEqual(['Luna']);
    expect(
      filterHeraldryCharacters(characters, slots, '', 11, 'recommended').map(
        (entry) => entry.name,
      ),
    ).toEqual(['Raven']);
  });

  it('combines the name, plate, and status filters', () => {
    expect(
      filterHeraldryCharacters(
        characters,
        slots,
        'raven',
        10,
        'recommended',
      ),
    ).toEqual([]);
    expect(
      filterHeraldryCharacters(
        characters,
        slots,
        'luna',
        10,
        'recommended',
      ).map((entry) => entry.name),
    ).toEqual(['Luna']);
  });

  it('preserves input order and does not mutate the inputs', () => {
    const slotOrder = slots.map((entry) => `${entry.characterId}:${entry.slot}`);
    const characterOrder = characters.map((entry) => entry.id);

    const result = filterHeraldryCharacters(
      characters,
      slots,
      '',
      null,
      'all',
    );

    expect(result.map((entry) => entry.id)).toEqual(characterOrder);
    expect(
      slots.map((entry) => `${entry.characterId}:${entry.slot}`),
    ).toEqual(slotOrder);
  });
});

describe('buildHeraldryUpgradeList', () => {
  const characters = [
    character(1, 'Alpha'),
    character(2, 'Bravo'),
    character(3, 'Cara'),
    character(4, 'Dora'),
    character(5, 'Echo'),
    character(6, 'Okay'),
  ];
  const slots = [
    slot(1, 1, 'needs-upgrade', 1, 'A1'),
    slot(1, 2, 'needs-upgrade', 2, 'A2'),
    slot(1, 3, 'needs-upgrade', 3, 'A3'),
    slot(1, 4, 'recommended', 4, 'A4'),
    slot(1, 5, 'recommended', 5, 'A5'),
    slot(2, 1, 'needs-upgrade', 6, 'B1'),
    slot(2, 2, 'needs-upgrade', 7, 'B2'),
    slot(2, 3, 'needs-upgrade', 8, 'B3'),
    slot(2, 4, 'recommended', 9, 'B4'),
    slot(2, 5, 'recommended', 10, 'B5'),
    slot(2, 6, 'recommended', 11, 'B6'),
    slot(2, 7, 'recommended', 12, 'B7'),
    slot(2, 8, 'recommended', 13, 'B8'),
    slot(3, 1, 'recommended', 14, 'C1'),
    slot(3, 2, 'recommended', 15, 'C2'),
    slot(4, 1, 'needs-upgrade', 16, 'D1'),
    slot(4, 2, 'needs-upgrade', 17, 'D2'),
    slot(4, 3, 'needs-upgrade', 18, 'D3'),
    slot(4, 4, 'needs-upgrade', 19, 'D4'),
    slot(4, 5, 'recommended', 20, 'D5'),
    slot(5, 1, 'recommended', 21, 'E1'),
    slot(5, 2, 'recommended', 22, 'E2'),
    slot(6, 1, 'ok', 23, 'Okay 1'),
  ];
  const perCharacter = [
    summary(1, 'Alpha', 'needs-upgrade', 3, 2, 3, 0),
    summary(2, 'Bravo', 'needs-upgrade', 3, 5, 0, 0),
    summary(3, 'Cara', 'recommended', 0, 2, 6, 0),
    summary(4, 'Dora', 'needs-upgrade', 4, 1, 3, 1),
    summary(5, 'Echo', 'recommended', 0, 2, 6, 0),
    summary(6, 'Okay', 'ok', 0, 0, 8, 0),
  ];

  it('excludes OK characters and sorts needs before recommended', () => {
    const list = buildHeraldryUpgradeList(state(characters, slots, perCharacter));

    expect(list.items.map((item) => item.name)).toEqual([
      'Dora',
      'Bravo',
      'Alpha',
      'Cara',
      'Echo',
    ]);
    expect(list.more).toBe(0);
    expect(list.allGood).toBe(false);
  });

  it('uses needs-upgrade plates in slot order and falls back to recommended', () => {
    const list = buildHeraldryUpgradeList(state(characters, slots, perCharacter));
    const byName = new Map(list.items.map((item) => [item.name, item]));

    expect(byName.get('Dora')).toMatchObject({
      status: 'needs-upgrade',
      needsUpgrade: 4,
      recommended: 1,
      empty: 1,
      plates: ['D1', 'D2', 'D3'],
      hiddenPlateCount: 1,
    });
    expect(byName.get('Bravo')).toMatchObject({
      plates: ['B1', 'B2', 'B3'],
      hiddenPlateCount: 0,
    });
    expect(byName.get('Cara')).toMatchObject({
      status: 'recommended',
      plates: ['C1', 'C2'],
      hiddenPlateCount: 0,
    });
    expect(byName.get('Echo')).toMatchObject({
      status: 'recommended',
      plates: ['E1', 'E2'],
      hiddenPlateCount: 0,
    });
  });

  it('caps the list and reports hidden characters', () => {
    const list = buildHeraldryUpgradeList(
      state(characters, slots, perCharacter),
      3,
    );

    expect(list.items.map((item) => item.name)).toEqual([
      'Dora',
      'Bravo',
      'Alpha',
    ]);
    expect(list.more).toBe(2);
  });

  it('uses the default limit of 10', () => {
    const manyCharacters: Character[] = [];
    const manySummaries: HeraldryCharacterSummary[] = [];
    const manySlots: HeraldrySlot[] = [];

    for (let index = 1; index <= 12; index += 1) {
      manyCharacters.push(character(index, `Character ${index}`));
      manySummaries.push(
        summary(index, `Character ${index}`, 'recommended', 0, 1, 7, 0),
      );
      manySlots.push(slot(index, 1, 'recommended', index, `Plate ${index}`));
    }

    const list = buildHeraldryUpgradeList(
      state(manyCharacters, manySlots, manySummaries),
    );

    expect(list.items).toHaveLength(10);
    expect(list.more).toBe(2);
  });

  it('reports all-good when no character needs attention', () => {
    const list = buildHeraldryUpgradeList(
      state(
        [character(1, 'Okay')],
        [slot(1, 1, 'ok', 1, 'Bear')],
        [summary(1, 'Okay', 'ok', 0, 0, 8, 0)],
      ),
    );

    expect(list.items).toEqual([]);
    expect(list.more).toBe(0);
    expect(list.allGood).toBe(true);
  });

  it('normalizes zero and negative limits', () => {
    const zero = buildHeraldryUpgradeList(
      state(characters, slots, perCharacter),
      0,
    );
    expect(zero.items).toEqual([]);
    expect(zero.more).toBe(5);

    const negative = buildHeraldryUpgradeList(
      state(characters, slots, perCharacter),
      -2,
    );
    expect(negative.items).toEqual([]);
    expect(negative.more).toBe(5);
  });

  it('does not mutate the input state', () => {
    const heraldry = state(characters, slots, perCharacter);
    const slotOrder = heraldry.slots.map((entry) => entry.slot);
    const summaryOrder = heraldry.perCharacter.map(
      (entry) => entry.characterId,
    );

    buildHeraldryUpgradeList(heraldry);

    expect(heraldry.slots.map((entry) => entry.slot)).toEqual(slotOrder);
    expect(
      heraldry.perCharacter.map((entry) => entry.characterId),
    ).toEqual(summaryOrder);
  });
});
