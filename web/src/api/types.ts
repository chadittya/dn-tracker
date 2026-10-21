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

export type HeraldryRarity = 'rare' | 'epic';
export type HeraldryStatus = 'ok' | 'recommended' | 'needs-upgrade';

export interface HeraldryPlate {
  id: number;
  name: string;
  createdAt: string;
}

export interface HeraldrySlot {
  characterId: number;
  slot: number;
  isEmpty: boolean;
  plateId: number | null;
  plateName: string | null;
  level: number | null;
  rarity: HeraldryRarity | null;
  hasThirdStat: boolean;
  status: HeraldryStatus;
}

export interface HeraldryCharacterSummary {
  characterId: number;
  name: string;
  needsUpgrade: number;
  recommended: number;
  ok: number;
  empty: number;
  status: HeraldryStatus;
}

export interface HeraldryState {
  slotCount: number;
  levels: number[];
  cap: number | null;
  plates: HeraldryPlate[];
  slots: HeraldrySlot[];
  perCharacter: HeraldryCharacterSummary[];
}

export interface HeraldryAffectedSlot {
  characterId: number;
  characterName: string;
  plateId: number;
  plateName: string;
  slot: number;
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
  heraldry: HeraldryState;
}

export type BackupKind = 'app' | 'preimport';

export interface BackupInfo {
  filename: string;
  kind: BackupKind;
  createdAt: string;
  sizeBytes: number;
}

export interface ImportResult {
  imported: {
    characters: number;
    nests: number;
    runs: number;
    plateLevels: number;
    plates: number;
    heraldrySlots: number;
  };
  backup: string;
}
