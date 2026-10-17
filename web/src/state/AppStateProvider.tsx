import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, errorMessage } from '../api/client';
import type { AppState } from '../api/types';
import { AppStateContext } from './context';
import type { AppStateContextValue } from './context';

const MAX_TIMEOUT_MS = 2_147_483_647;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRuns, setPendingRuns] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const receivedAt = Date.now();
      const next = await api.getState();
      setState(next);
      setServerClockOffsetMs(Date.parse(next.serverNow) - receivedAt);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Refresh automatically when the weekly reset passes while the app is open.
  useEffect(() => {
    if (!state) return;

    const remaining =
      Date.parse(state.nextResetAt) - (Date.now() + serverClockOffsetMs);
    const delay = Math.min(Math.max(0, remaining) + 1000, MAX_TIMEOUT_MS);
    const timer = window.setTimeout(() => {
      void refresh();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [state, serverClockOffsetMs, refresh]);

  // Also refetch whenever the user returns to the tab.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refresh]);

  const clearError = useCallback(() => setError(null), []);

  const setRun = useCallback(
    async (characterId: number, nestId: number, done: boolean) => {
      const key = `${characterId}:${nestId}`;
      setPendingRuns((previous) => {
        const next = new Set(previous);
        next.add(key);
        return next;
      });

      try {
        await api.setRun(characterId, nestId, done);
        await refresh();
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setPendingRuns((previous) => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        });
      }
    },
    [refresh],
  );

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      loading,
      error,
      clearError,
      refresh,
      setRun,
      pendingRuns,
      serverClockOffsetMs,
    }),
    [
      state,
      loading,
      error,
      clearError,
      refresh,
      setRun,
      pendingRuns,
      serverClockOffsetMs,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}
