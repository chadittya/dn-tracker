import { describe, expect, it } from 'vitest';
import type {
  CharacterProgress,
  Dashboard,
  NestProgress,
} from '../api/types';
import { buildDashboardLists } from './dashboard';

function makeDashboard(
  perCharacter: CharacterProgress[],
  perNest: NestProgress[],
  done = 0,
  total = 0,
): Dashboard {
  return {
    done,
    total,
    perNest,
    perCharacter,
    mostRemaining: [],
  };
}

function character(
  characterId: number,
  name: string,
  done: number,
  total = 5,
): CharacterProgress {
  return { characterId, name, done, total, remaining: total - done };
}

function nest(nestId: number, name: string, done: number, total: number): NestProgress {
  return { nestId, name, done, total };
}

describe('buildDashboardLists', () => {
  it('drops completed characters and sorts by remaining, then name', () => {
    const lists = buildDashboardLists(
      makeDashboard(
        [
          character(1, 'Zed', 2),
          character(2, 'amy', 4),
          character(3, 'Amy', 5),
          character(4, 'Bob', 1),
          character(5, 'alpha', 3),
          character(6, 'Beta', 3),
        ],
        [],
      ),
    );

    expect(lists.topCharacters.map((entry) => entry.name)).toEqual([
      'Bob',
      'Zed',
      'alpha',
      'Beta',
      'amy',
    ]);
    expect(lists.moreCharacters).toBe(0);
  });

  it('caps characters at 10 and reports the hidden count', () => {
    const characters = Array.from({ length: 12 }, (_, index) =>
      character(index + 1, `Character ${String(index + 1).padStart(2, '0')}`, 0),
    );

    const lists = buildDashboardLists(makeDashboard(characters, []));

    expect(lists.topCharacters).toHaveLength(10);
    expect(lists.moreCharacters).toBe(2);
  });

  it('reports zero hidden characters when under the cap', () => {
    const lists = buildDashboardLists(
      makeDashboard([character(1, 'Raven', 1)], []),
    );

    expect(lists.topCharacters).toHaveLength(1);
    expect(lists.moreCharacters).toBe(0);
  });

  it('drops complete nests and sorts by remaining, then name', () => {
    const lists = buildDashboardLists(
      makeDashboard(
        [],
        [
          nest(1, 'Complete', 4, 4),
          nest(2, 'Beta', 2, 4),
          nest(3, 'Alpha', 1, 4),
        ],
      ),
    );

    expect(
      lists.topNests.map((entry) => ({
        name: entry.name,
        remaining: entry.remaining,
      })),
    ).toEqual([
      { name: 'Alpha', remaining: 3 },
      { name: 'Beta', remaining: 2 },
    ]);
    expect(lists.moreNests).toBe(0);
  });

  it('caps nests at 5 and reports the hidden count', () => {
    const nests = Array.from({ length: 7 }, (_, index) =>
      nest(index + 1, `Nest ${index + 1}`, 1, 4),
    );

    const lists = buildDashboardLists(makeDashboard([], nests));

    expect(lists.topNests).toHaveLength(5);
    expect(lists.moreNests).toBe(2);
  });

  it('handles custom, zero, and negative limits', () => {
    const characters = [
      character(1, 'Raven', 0),
      character(2, 'Luna', 0),
    ];

    const custom = buildDashboardLists(makeDashboard(characters, []), 1, 1);
    expect(custom.topCharacters).toHaveLength(1);
    expect(custom.moreCharacters).toBe(1);

    const zero = buildDashboardLists(makeDashboard(characters, []), 0, 0);
    expect(zero.topCharacters).toEqual([]);
    expect(zero.moreCharacters).toBe(2);

    const negative = buildDashboardLists(
      makeDashboard(characters, []),
      -3,
      -3,
    );
    expect(negative.topCharacters).toEqual([]);
    expect(negative.moreCharacters).toBe(2);
  });

  it('reports all done only when there is work and it is finished', () => {
    expect(buildDashboardLists(makeDashboard([], [], 0, 0)).allDone).toBe(false);
    expect(buildDashboardLists(makeDashboard([], [], 4, 4)).allDone).toBe(true);
    expect(buildDashboardLists(makeDashboard([], [], 3, 4)).allDone).toBe(false);
  });

  it('returns empty lists for empty input', () => {
    const lists = buildDashboardLists(makeDashboard([], []));

    expect(lists.topCharacters).toEqual([]);
    expect(lists.moreCharacters).toBe(0);
    expect(lists.topNests).toEqual([]);
    expect(lists.moreNests).toBe(0);
  });

  it('does not mutate the dashboard arrays', () => {
    const characters = [character(1, 'Zed', 1), character(2, 'Amy', 2)];
    const nests = [nest(1, 'Zed nest', 1, 3), nest(2, 'Amy nest', 2, 3)];
    const characterOrder = characters.map((entry) => entry.characterId);
    const nestOrder = nests.map((entry) => entry.nestId);

    buildDashboardLists(makeDashboard(characters, nests));

    expect(characters.map((entry) => entry.characterId)).toEqual(characterOrder);
    expect(nests.map((entry) => entry.nestId)).toEqual(nestOrder);
  });
});
