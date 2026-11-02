export type Tab =
  | 'runs'
  | 'matrix'
  | 'heraldry'
  | 'engraving'
  | 'cards'
  | 'dashboard'
  | 'backup'
  | 'manage';

export interface NavigateOptions {
  characterQuery?: string;
}

export type Navigate = (tab: Tab, options?: NavigateOptions) => void;

export interface CharacterPrefill {
  tab: Tab;
  characterQuery: string;
}

export const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'runs', label: 'Runs' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'heraldry', label: 'Heraldry' },
  { id: 'engraving', label: 'Engraving' },
  { id: 'cards', label: 'Cards' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'backup', label: 'Backup' },
  { id: 'manage', label: 'Manage' },
];

const TAB_IDS = new Set<string>(TABS.map((tab) => tab.id));

export function parseTabFromHash(hash: string): Tab {
  const raw = hash.replace(/^#\/?/, '');
  return TAB_IDS.has(raw) ? (raw as Tab) : 'runs';
}

export function readTabFromHash(): Tab {
  return parseTabFromHash(window.location.hash);
}

/**
 * A Dashboard prefill applies only to the tab it was created for. A Heraldry
 * row must not prefill Engraving and vice versa.
 */
export function characterPrefillForTab(
  prefill: CharacterPrefill | undefined,
  tab: Tab,
): string | undefined {
  return prefill?.tab === tab ? prefill.characterQuery : undefined;
}

/**
 * True only for the hashchange caused by our own navigate(): the pending hash
 * matches the current hash. Back/forward and manual hash edits have no pending
 * hash (or a stale one) and must clear the one-shot Dashboard prefill.
 */
export function keepsCharacterPrefillOnHashChange(
  pendingHash: string | null,
  currentHash: string,
): boolean {
  return pendingHash !== null && pendingHash === currentHash;
}
