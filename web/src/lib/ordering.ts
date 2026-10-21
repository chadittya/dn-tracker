export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

export function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.floor(limit));
}

export function compareCreatedAtDesc(
  a: Readonly<{ id: number; createdAt: string }>,
  b: Readonly<{ id: number; createdAt: string }>,
): number {
  const aTime = Date.parse(a.createdAt);
  const bTime = Date.parse(b.createdAt);
  const aValid = Number.isFinite(aTime);
  const bValid = Number.isFinite(bTime);

  if (aValid && bValid && aTime !== bTime) {
    return aTime < bTime ? 1 : -1;
  }
  if (aValid !== bValid) {
    return aValid ? -1 : 1;
  }

  // Equal (or both invalid) timestamps: newest id first.
  return b.id - a.id;
}

export function sortEntitiesForManage<
  T extends { id: number; createdAt: string },
>(items: readonly T[]): T[] {
  return [...items].sort(compareCreatedAtDesc);
}

export function sortLevelsDesc(levels: readonly number[]): number[] {
  return [...levels].sort((a, b) => b - a);
}
