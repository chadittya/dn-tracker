export function normalizeQuery(raw: string): string {
  return raw.trim();
}

export function isFilterActive(query: string): boolean {
  return normalizeQuery(query).length > 0;
}

export function matchesName(name: string, query: string): boolean {
  const normalized = normalizeQuery(query).toLowerCase();
  if (normalized === '') return true;
  return name.toLowerCase().includes(normalized);
}

export function filterByName<T extends { name: string }>(
  items: readonly T[],
  query: string,
): T[] {
  const normalized = normalizeQuery(query).toLowerCase();
  if (normalized === '') return [...items];
  return items.filter((item) => item.name.toLowerCase().includes(normalized));
}

/**
 * Filters Matrix rows. The nest text filter must already be applied by the
 * caller; "remaining" is evaluated only against the currently visible nests.
 *
 * Zero visible nests is a page-level state and is handled before this helper
 * is allowed to influence the "all done" message. Keeping the guard here means
 * a caller that passes no nests gets no characters rather than a misleading
 * "everything is done" result.
 */
export function filterMatrixCharacters<T extends { id: number; name: string }>(
  characters: readonly T[],
  visibleNests: readonly { id: number }[],
  donePairs: ReadonlySet<string>,
  query: string,
  onlyRemaining: boolean,
): T[] {
  const normalized = normalizeQuery(query).toLowerCase();

  return characters.filter((character) => {
    if (
      normalized !== '' &&
      !character.name.toLowerCase().includes(normalized)
    ) {
      return false;
    }

    if (!onlyRemaining) return true;
    if (visibleNests.length === 0) return false;

    return visibleNests.some(
      (nest) => !donePairs.has(`${character.id}:${nest.id}`),
    );
  });
}
