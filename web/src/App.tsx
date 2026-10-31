import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import {
  characterPrefillForTab,
  keepsCharacterPrefillOnHashChange,
  readTabFromHash,
} from './lib/navigation';
import type {
  CharacterPrefill,
  Navigate,
  Tab,
} from './lib/navigation';
import { BackupPage } from './pages/BackupPage';
import { DashboardPage } from './pages/DashboardPage';
import { EngravingPage } from './pages/EngravingPage';
import { HeraldryPage } from './pages/HeraldryPage';
import { ManagePage } from './pages/ManagePage';
import { MatrixPage } from './pages/MatrixPage';
import { RunPage } from './pages/RunPage';
import { AppStateProvider } from './state/AppStateProvider';

export default function App() {
  const [tab, setTab] = useState<Tab>(readTabFromHash);
  const [prefill, setPrefill] = useState<CharacterPrefill | undefined>(
    undefined,
  );
  const pendingHashRef = useRef<string | null>(null);

  useEffect(() => {
    const onHashChange = () => {
      const expected = pendingHashRef.current;
      pendingHashRef.current = null;

      // Our own navigate() caused this event: keep the one-shot prefill.
      // Back/forward or an external hash edit is the only path that clears it.
      if (!keepsCharacterPrefillOnHashChange(expected, window.location.hash)) {
        setPrefill(undefined);
      }

      setTab(readTabFromHash());
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback<Navigate>((next, options) => {
    const hash = `#/${next}`;
    setPrefill(
      options?.characterQuery === undefined
        ? undefined
        : { tab: next, characterQuery: options.characterQuery },
    );
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
            initialCharacterQuery={characterPrefillForTab(prefill, 'heraldry')}
          />
        )}
        {tab === 'engraving' && (
          <EngravingPage
            onNavigate={navigate}
            initialCharacterQuery={characterPrefillForTab(prefill, 'engraving')}
          />
        )}
        {tab === 'dashboard' && <DashboardPage onNavigate={navigate} />}
        {tab === 'backup' && <BackupPage />}
        {tab === 'manage' && <ManagePage />}
      </AppShell>
    </AppStateProvider>
  );
}
