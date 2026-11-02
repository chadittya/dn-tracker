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

export type EngravingCategory = 'weapon' | 'armor' | 'accessory' | 'wtd';
export type EngravingGrade = 'rare' | 'epic' | 'unique' | 'legend';

export interface EngravingSlotDefinition {
  slot: number;
  label: string;
  category: EngravingCategory;
}

export interface EngravingCategoryMeta {
  key: EngravingCategory;
  label: string;
  firstStatLabel: string;
  secondStatLabel: string | null;
}

export interface EngravingGradeMeta {
  key: EngravingGrade;
  label: string;
  rank: number;
}

export interface EngravingValue {
  id: number;
  category: EngravingCategory;
  grade: EngravingGrade;
  /** Integer hundredths of a percent: 28 = 0.28%. */
  firstStatValue: number;
  secondStatValue: number | null;
}

export interface EngravingSlot {
  characterId: number;
  slot: number;
  category: EngravingCategory;
  label: string;
  isEmpty: boolean;
  valueId: number | null;
  grade: EngravingGrade | null;
  firstStatValue: number | null;
  secondStatValue: number | null;
  thirdStatName: string | null;
  thirdStatValue: number | null;
}

export interface EngravingEmptySlot {
  slot: number;
  label: string;
}

export interface EngravingCharacterSummary {
  characterId: number;
  name: string;
  emptyCount: number;
  filledCount: number;
  emptySlots: EngravingEmptySlot[];
}

export type EngravingValueTables = Record<EngravingCategory, EngravingValue[]>;

export interface EngravingState {
  slotCount: number;
  slotDefinitions: EngravingSlotDefinition[];
  categories: EngravingCategoryMeta[];
  grades: EngravingGradeMeta[];
  valueTables: EngravingValueTables;
  slots: EngravingSlot[];
  perCharacter: EngravingCharacterSummary[];
}

export interface EngravingFinderResult {
  characterId: number;
  name: string;
  isEmpty: boolean;
  valueId: number | null;
  grade: EngravingGrade | null;
  firstStatValue: number | null;
  secondStatValue: number | null;
}

export interface EngravingValueUsageResponse {
  valueId: number;
  affectedCount: number;
  affectedEngravingSlots: EngravingAffectedSlot[];
}

export interface EngravingAffectedSlot {
  characterId: number;
  characterName: string;
  slot: number;
  slotLabel: string;
}

export type CardGrade = 'magic' | 'rare' | 'epic' | 'unique' | 'legend';

export interface CardGradeMeta {
  key: CardGrade;
  label: string;
  rank: number;
}

export interface CardCatalogEntry {
  id: number;
  name: string;
  createdAt: string;
}

export interface CharacterCardEntry {
  characterId: number;
  cardId: number;
  cardName: string;
  grade: CardGrade;
}

export interface CharacterCardSummary {
  characterId: number;
  name: string;
  count: number;
  total: number;
}

export interface CardsState {
  grades: CardGradeMeta[];
  catalog: CardCatalogEntry[];
  entries: CharacterCardEntry[];
  perCharacter: CharacterCardSummary[];
}

export interface CardFinderResult {
  characterId: number;
  name: string;
  grade: CardGrade | null;
}

export interface CardAffectedCharacter {
  characterId: number;
  characterName: string;
  grade: CardGrade;
}

export interface CardUsageResponse {
  cardId: number;
  affectedCount: number;
  affectedCharacters: CardAffectedCharacter[];
}

export interface CardBulkImportResult {
  added: number;
  skipped: number;
  invalid: number;
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
  engraving: EngravingState;
  cards: CardsState;
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
    engravingValues: number;
    engravingSlots: number;
    cards: number;
    cardSlots: number;
  };
  backup: string;
}
