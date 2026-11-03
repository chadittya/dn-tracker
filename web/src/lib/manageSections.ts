export interface ManageSection {
  id: string;
  label: string;
  elementId: string;
}

/**
 * Scroll target offset used by sidebar clicks. Mirrors `.manage-section-anchor`
 * (`scroll-margin-top: var(--app-header-height) + 1.5rem`) in `index.css`.
 */
export const MANAGE_SCROLL_OFFSET_PX = 24;

/**
 * Slack above the scroll target so a clicked section, placed at
 * `header + MANAGE_SCROLL_OFFSET_PX`, is always treated as in view despite
 * sub-pixel rounding. Must stay clearly larger than 0.
 */
export const MANAGE_SPY_TOLERANCE_PX = 16;

/**
 * Document-offset threshold for the active-section spy. `tops` are document
 * offsets, so the viewport threshold must include the current scroll position.
 */
export function manageSpyThreshold(
  headerHeight: number,
  scrollY: number,
): number {
  return (
    scrollY +
    headerHeight +
    MANAGE_SCROLL_OFFSET_PX +
    MANAGE_SPY_TOLERANCE_PX
  );
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
 * section is the last one whose top is at or above the threshold (equality
 * included). At the page bottom the last section wins, because tall final
 * sections cannot cross the threshold. `tops` is in document order.
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
