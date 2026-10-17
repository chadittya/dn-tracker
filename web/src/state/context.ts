import { createContext, useContext } from 'react';
import type { AppState } from '../api/types';

export interface AppStateContextValue {
  state: AppState | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  setRun: (characterId: number, nestId: number, done: boolean) => Promise<void>;
  pendingRuns: ReadonlySet<string>;
  serverClockOffsetMs: number;
}

export const AppStateContext = createContext<AppStateContextValue | null>(null);

export function useAppState(): AppStateContextValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return value;
}
