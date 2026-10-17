export type Tab = 'runs' | 'matrix' | 'dashboard' | 'backup' | 'manage';

export const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'runs', label: 'Runs' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'backup', label: 'Backup' },
  { id: 'manage', label: 'Manage' },
];

const TAB_IDS = new Set<string>(TABS.map((tab) => tab.id));

export function readTabFromHash(): Tab {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return TAB_IDS.has(raw) ? (raw as Tab) : 'runs';
}
