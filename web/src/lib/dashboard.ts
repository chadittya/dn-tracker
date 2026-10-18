import type {
  CharacterProgress,
  Dashboard,
  NestProgress,
} from '../api/types';

export const CHARACTER_LIMIT = 10;
export const NEST_LIMIT = 5;

export interface DashboardNestItem extends NestProgress {
  remaining: number;
}

export interface DashboardLists {
  topCharacters: CharacterProgress[];
  moreCharacters: number;
  topNests: DashboardNestItem[];
  moreNests: number;
  allDone: boolean;
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.floor(limit));
}

export function buildDashboardLists(
  dashboard: Dashboard,
  characterLimit = CHARACTER_LIMIT,
  nestLimit = NEST_LIMIT,
): DashboardLists {
  const eligibleCharacters = dashboard.perCharacter
    .filter((character) => character.remaining > 0)
    .sort(
      (a, b) =>
        b.remaining - a.remaining || compareNames(a.name, b.name),
    );

  const eligibleNests = dashboard.perNest
    .map((nest) => ({
      ...nest,
      remaining: Math.max(0, nest.total - nest.done),
    }))
    .filter((nest) => nest.remaining > 0)
    .sort(
      (a, b) =>
        b.remaining - a.remaining || compareNames(a.name, b.name),
    );

  const characterCap = normalizeLimit(characterLimit);
  const nestCap = normalizeLimit(nestLimit);
  const topCharacters = eligibleCharacters.slice(0, characterCap);
  const topNests = eligibleNests.slice(0, nestCap);

  return {
    topCharacters,
    moreCharacters: eligibleCharacters.length - topCharacters.length,
    topNests,
    moreNests: eligibleNests.length - topNests.length,
    allDone: dashboard.total > 0 && dashboard.done >= dashboard.total,
  };
}
