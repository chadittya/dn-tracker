/** Success-note text shared by the Manage lists and the character card panel. */

export function addedNote(name: string, hiddenBySearch: boolean): string {
  return hiddenBySearch
    ? `Added ${name}. It is hidden by your current search.`
    : `Added ${name}.`;
}

export function addedLevelNote(level: number): string {
  return `Added Level ${level}.`;
}

export function changedCardGradeNote(
  cardName: string,
  gradeLabel: string,
): string {
  return `Changed ${cardName} to ${gradeLabel}.`;
}

export function removedCardNote(
  cardName: string,
  characterName: string,
): string {
  return `Removed ${cardName} from ${characterName}.`;
}
