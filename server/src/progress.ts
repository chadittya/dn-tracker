export interface CharacterRow {
  id: number;
  name: string;
  createdAt: string;
}

export interface NestRow {
  id: number;
  name: string;
  createdAt: string;
}

export interface RunRow {
  characterId: number;
  nestId: number;
  weekKey: string;
  completedAt: string;
}

export interface NestProgress {
  nestId: number;
  name: string;
  done: number;
  total: number;
}

export interface CharacterProgress {
  characterId: number;
  name: string;
  done: number;
  total: number;
  remaining: number;
}

export interface Dashboard {
  done: number;
  total: number;
  perNest: NestProgress[];
  perCharacter: CharacterProgress[];
  mostRemaining: Array<{ characterId: number; name: string; remaining: number }>;
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

export function buildDashboard(
  characters: CharacterRow[],
  nests: NestRow[],
  currentWeekRuns: RunRow[],
): Dashboard {
  const donePairs = new Set(
    currentWeekRuns.map((run) => `${run.characterId}:${run.nestId}`),
  );

  const perNest: NestProgress[] = nests.map((nest) => {
    let done = 0;
    for (const character of characters) {
      if (donePairs.has(`${character.id}:${nest.id}`)) done += 1;
    }
    return {
      nestId: nest.id,
      name: nest.name,
      done,
      total: characters.length,
    };
  });

  const perCharacter: CharacterProgress[] = characters.map((character) => {
    let done = 0;
    for (const nest of nests) {
      if (donePairs.has(`${character.id}:${nest.id}`)) done += 1;
    }
    return {
      characterId: character.id,
      name: character.name,
      done,
      total: nests.length,
      remaining: nests.length - done,
    };
  });

  const mostRemaining = perCharacter
    .map(({ characterId, name, remaining }) => ({ characterId, name, remaining }))
    .sort(
      (a, b) => b.remaining - a.remaining || compareNames(a.name, b.name),
    );

  return {
    done: donePairs.size,
    total: characters.length * nests.length,
    perNest,
    perCharacter,
    mostRemaining,
  };
}
