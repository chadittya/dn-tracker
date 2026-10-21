export type Tab =
  | 'runs'
  | 'matrix'
  | 'heraldry'
  | 'dashboard'
  | 'backup'
  | 'manage';

export interface NavigateOptions {
  characterQuery?: string;
}

export type Navigate = (tab: Tab, options?: NavigateOptions) => void;

export const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'runs', label: 'Runs' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'heraldry', label: 'Heraldry' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'backup', label: 'Backup' },
  { id: 'manage', label: 'Manage' },
];

const TAB_IDS = new Set<string>(TABS.map((tab) => tab.id));

export function readTabFromHash(): Tab {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return TAB_IDS.has(raw) ? (raw as Tab) : 'runs';
}

/**
 * True only for the hashchange caused by our own navigate(): the pending hash
 * matches the current hash. Back/forward and manual hash edits have no pending
 * hash (or a stale one) and must clear the one-shot Dashboard prefill.
 */
export function keepsHeraldryPrefillOnHashChange(
  pendingHash: string | null,
  currentHash: string,
): boolean {
  return pendingHash !== null && pendingHash === currentHash;
}
