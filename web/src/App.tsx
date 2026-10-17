import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { readTabFromHash } from './lib/navigation';
import type { Tab } from './lib/navigation';
import { BackupPage } from './pages/BackupPage';
import { DashboardPage } from './pages/DashboardPage';
import { ManagePage } from './pages/ManagePage';
import { MatrixPage } from './pages/MatrixPage';
import { RunPage } from './pages/RunPage';
import { AppStateProvider } from './state/AppStateProvider';

export default function App() {
  const [tab, setTab] = useState<Tab>(readTabFromHash);

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Tab) => {
    const hash = `#/${next}`;
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    setTab(next);
  }, []);

  return (
    <AppStateProvider>
      <AppShell tab={tab} onNavigate={navigate}>
        {tab === 'runs' && <RunPage onNavigate={navigate} />}
        {tab === 'matrix' && <MatrixPage onNavigate={navigate} />}
        {tab === 'dashboard' && <DashboardPage onNavigate={navigate} />}
        {tab === 'backup' && <BackupPage />}
        {tab === 'manage' && <ManagePage />}
      </AppShell>
    </AppStateProvider>
  );
}
