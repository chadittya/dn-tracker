export interface ManageSection {
  id: string;
  label: string;
  elementId: string;
}

/** Manage page order. Also defines the sidebar link order. */
export const MANAGE_SECTIONS: readonly ManageSection[] = [
  { id: 'characters', label: 'Characters', elementId: 'manage-characters' },
  { id: 'nests', label: 'Nests', elementId: 'manage-nests' },
  { id: 'plates', label: 'Plates', elementId: 'manage-plates' },
  {
    id: 'plate-levels',
    label: 'Plate levels',
    elementId: 'manage-plate-levels',
  },
  {
    id: 'engraving-values',
    label: 'Engraving values',
    elementId: 'manage-engraving-values',
  },
  { id: 'cards', label: 'Cards', elementId: 'manage-cards' },
];

/**
 * Pick the active section from each section's document offset. The active
 * section is the last one whose top is at or above the threshold. At the page
 * bottom the last section wins, because tall final sections cannot cross the
 * threshold. `tops` is in document order.
 */
export function pickActiveSectionIndex(
  tops: readonly number[],
  threshold: number,
  atBottom: boolean,
): number {
  if (tops.length === 0) return 0;
  if (atBottom) return tops.length - 1;

  let active = 0;
  for (let index = 0; index < tops.length; index += 1) {
    if (tops[index]! > threshold) break;
    active = index;
  }
  return active;
}
