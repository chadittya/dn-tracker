/**
 * Mirrors SQLite's NOCASE rule: only ASCII A-Z are case-folded. Keep this in
 * sync with the server so the client's duplicate warning does not disagree
 * with the table's UNIQUE constraint.
 */
export function foldName(name: string): string {
  return name.trim().replace(/[A-Z]/g, (char) => char.toLowerCase());
}

export interface AddNameAnalysis<T extends { id: number; name: string }> {
  trimmed: string;
  matches: T[];
  exactMatch: T | undefined;
}

export function analyzeAddName<T extends { id: number; name: string }>(
  items: readonly T[],
  input: string,
): AddNameAnalysis<T> {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { trimmed, matches: [], exactMatch: undefined };
  }

  const foldedInput = foldName(trimmed);
  const matches = items.filter((item) =>
    foldName(item.name).includes(foldedInput),
  );
  const exactMatch = items.find((item) => foldName(item.name) === foldedInput);

  return { trimmed, matches, exactMatch };
}
