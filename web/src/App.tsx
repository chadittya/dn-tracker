import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import {
  keepsHeraldryPrefillOnHashChange,
  readTabFromHash,
} from './lib/navigation';
import type { Navigate, Tab } from './lib/navigation';
import { BackupPage } from './pages/BackupPage';
import { DashboardPage } from './pages/DashboardPage';
import { HeraldryPage } from './pages/HeraldryPage';
import { ManagePage } from './pages/ManagePage';
import { MatrixPage } from './pages/MatrixPage';
import { RunPage } from './pages/RunPage';
import { AppStateProvider } from './state/AppStateProvider';

export default function App() {
  const [tab, setTab] = useState<Tab>(readTabFromHash);
  const [heraldryPrefill, setHeraldryPrefill] = useState<string | undefined>(
    undefined,
  );
  const pendingHashRef = useRef<string | null>(null);

  useEffect(() => {
    const onHashChange = () => {
      const expected = pendingHashRef.current;
      pendingHashRef.current = null;

      // Our own navigate() caused this event: keep the one-shot prefill.
      // Back/forward or an external hash edit is the only path that clears it.
      if (
        !keepsHeraldryPrefillOnHashChange(expected, window.location.hash)
      ) {
        setHeraldryPrefill(undefined);
      }

      setTab(readTabFromHash());
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback<Navigate>((next, options) => {
    const hash = `#/${next}`;
    setHeraldryPrefill(options?.characterQuery);
    if (window.location.hash !== hash) {
      pendingHashRef.current = hash;
      window.location.hash = hash;
    }
    setTab(next);
  }, []);

  return (
    <AppStateProvider>
      <AppShell tab={tab} onNavigate={navigate}>
        {tab === 'runs' && <RunPage onNavigate={navigate} />}
        {tab === 'matrix' && <MatrixPage onNavigate={navigate} />}
        {tab === 'heraldry' && (
          <HeraldryPage
            onNavigate={navigate}
            initialCharacterQuery={heraldryPrefill}
          />
        )}
        {tab === 'dashboard' && <DashboardPage onNavigate={navigate} />}
        {tab === 'backup' && <BackupPage />}
        {tab === 'manage' && <ManagePage />}
      </AppShell>
    </AppStateProvider>
  );
}
