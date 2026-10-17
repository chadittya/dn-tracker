export interface Character {
  id: number;
  name: string;
  createdAt: string;
}

export interface Nest {
  id: number;
  name: string;
  createdAt: string;
}

export interface Run {
  characterId: number;
  nestId: number;
  weekKey: string;
  completedAt: string;
}

export interface NestProgress {
  nestId: number;
  name: string;
  done: number;
  total: number;
}

export interface CharacterProgress {
  characterId: number;
  name: string;
  done: number;
  total: number;
  remaining: number;
}

export interface Dashboard {
  done: number;
  total: number;
  perNest: NestProgress[];
  perCharacter: CharacterProgress[];
  mostRemaining: Array<{ characterId: number; name: string; remaining: number }>;
}

export interface AppState {
  weekKey: string;
  weekStartAt: string;
  nextResetAt: string;
  serverNow: string;
  characters: Character[];
  nests: Nest[];
  runs: Run[];
  dashboard: Dashboard;
}

export type BackupKind = 'app' | 'preimport';

export interface BackupInfo {
  filename: string;
  kind: BackupKind;
  createdAt: string;
  sizeBytes: number;
}

export interface ImportResult {
  imported: { characters: number; nests: number; runs: number };
  backup: string;
}
