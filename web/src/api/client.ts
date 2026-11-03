import type {
  AppState,
  BackupInfo,
  CardBulkImportResult,
  CardCatalogEntry,
  CardFinderResult,
  CardGrade,
  CardUsageResponse,
  Character,
  CharacterCardEntry,
  CharacterCardImportResult,
  EngravingAffectedSlot,
  EngravingCategory,
  EngravingFinderResult,
  EngravingGrade,
  EngravingSlot,
  EngravingSlotDefinition,
  EngravingValue,
  EngravingValueUsageResponse,
  HeraldryAffectedSlot,
  HeraldryPlate,
  HeraldryRarity,
  HeraldrySlot,
  ImportResult,
  Nest,
} from './types';

export interface ApiErrorDetails {
  affectedSlots?: HeraldryAffectedSlot[];
  affectedEngravingSlots?: EngravingAffectedSlot[];
  affectedCount?: number;
  conflictingSlot?: number;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ApiErrorDetails;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: ApiErrorDetails,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...init, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text !== '') {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null)?.error;
    const details =
      typeof error?.details === 'object' && error.details !== null
        ? (error.details as ApiErrorDetails)
        : undefined;
    throw new ApiRequestError(
      error?.message ?? `Request failed (${response.status}).`,
      error?.code ?? 'REQUEST_FAILED',
      response.status,
      details,
    );
  }

  return payload as T;
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export const api = {
  getState: () => request<AppState>('/api/state'),

  createCharacter: (name: string) =>
    request<{ character: Character }>('/api/characters', {
      method: 'POST',
      body: jsonBody({ name }),
    }),

  renameCharacter: (id: number, name: string) =>
    request<{ character: Character }>(`/api/characters/${id}`, {
      method: 'PATCH',
      body: jsonBody({ name }),
    }),

  deleteCharacter: (id: number) =>
    request<void>(`/api/characters/${id}`, { method: 'DELETE' }),

  createNest: (name: string) =>
    request<{ nest: Nest }>('/api/nests', {
      method: 'POST',
      body: jsonBody({ name }),
    }),

  renameNest: (id: number, name: string) =>
    request<{ nest: Nest }>(`/api/nests/${id}`, {
      method: 'PATCH',
      body: jsonBody({ name }),
    }),

  deleteNest: (id: number) =>
    request<void>(`/api/nests/${id}`, { method: 'DELETE' }),

  setRun: (characterId: number, nestId: number, done: boolean) =>
    request<{ done: boolean; weekKey: string; nextResetAt: string }>(
      '/api/runs',
      {
        method: 'PUT',
        body: jsonBody({ characterId, nestId, done }),
      },
    ),

  addHeraldryLevel: (value: number) =>
    request<{ level: { value: number } }>('/api/heraldry/levels', {
      method: 'POST',
      body: jsonBody({ value }),
    }),

  deleteHeraldryLevel: (value: number) =>
    request<void>(`/api/heraldry/levels/${value}`, { method: 'DELETE' }),

  createHeraldryPlate: (name: string) =>
    request<{ plate: HeraldryPlate }>('/api/heraldry/plates', {
      method: 'POST',
      body: jsonBody({ name }),
    }),

  renameHeraldryPlate: (id: number, name: string) =>
    request<{ plate: HeraldryPlate }>(`/api/heraldry/plates/${id}`, {
      method: 'PATCH',
      body: jsonBody({ name }),
    }),

  deleteHeraldryPlate: (id: number) =>
    request<void>(`/api/heraldry/plates/${id}`, { method: 'DELETE' }),

  setHeraldrySlot: (input: {
    characterId: number;
    slot: number;
    plateId: number;
    level: number;
    rarity: HeraldryRarity;
    hasThirdStat: boolean;
  }) =>
    request<{ slot: HeraldrySlot }>('/api/heraldry/slots', {
      method: 'PUT',
      body: jsonBody(input),
    }),

  clearHeraldrySlot: (characterId: number, slot: number) =>
    request<void>(`/api/heraldry/slots/${characterId}/${slot}`, {
      method: 'DELETE',
    }),

  copyHeraldry: (sourceCharacterId: number, targetCharacterId: number) =>
    request<{ copied: number }>('/api/heraldry/copy', {
      method: 'POST',
      body: jsonBody({ sourceCharacterId, targetCharacterId }),
    }),

  createEngravingValue: (input: {
    category: EngravingCategory;
    grade: EngravingGrade;
    firstStatValue: number;
    secondStatValue?: number | null;
  }) =>
    request<{ value: EngravingValue }>('/api/engraving/values', {
      method: 'POST',
      body: jsonBody(input),
    }),

  updateEngravingValue: (
    id: number,
    input: {
      firstStatValue: number;
      secondStatValue?: number | null;
    },
  ) =>
    request<{ value: EngravingValue }>(`/api/engraving/values/${id}`, {
      method: 'PATCH',
      body: jsonBody(input),
    }),

  deleteEngravingValue: (id: number) =>
    request<void>(`/api/engraving/values/${id}`, { method: 'DELETE' }),

  getEngravingValueUsage: (id: number) =>
    request<EngravingValueUsageResponse>(
      `/api/engraving/values/${id}/usage`,
    ),

  getEngravingFinder: (slot: number, valueId: number) =>
    request<{
      slot: EngravingSlotDefinition;
      targetValue: EngravingValue;
      results: EngravingFinderResult[];
    }>(
      `/api/engraving/finder?slot=${encodeURIComponent(
        String(slot),
      )}&valueId=${encodeURIComponent(String(valueId))}`,
    ),

  setEngravingSlot: (input: {
    characterId: number;
    slot: number;
    valueId: number;
    thirdStatName?: string | null;
    thirdStatValue?: number | null;
  }) =>
    request<{ slot: EngravingSlot }>('/api/engraving/slots', {
      method: 'PUT',
      body: jsonBody(input),
    }),

  clearEngravingSlot: (characterId: number, slot: number) =>
    request<void>(`/api/engraving/slots/${characterId}/${slot}`, {
      method: 'DELETE',
    }),

  createCard: (name: string) =>
    request<{ card: CardCatalogEntry }>('/api/cards', {
      method: 'POST',
      body: jsonBody({ name }),
    }),

  renameCard: (id: number, name: string) =>
    request<{ card: CardCatalogEntry }>(`/api/cards/${id}`, {
      method: 'PATCH',
      body: jsonBody({ name }),
    }),

  deleteCard: (id: number) =>
    request<void>(`/api/cards/${id}`, { method: 'DELETE' }),

  getCardUsage: (id: number) =>
    request<CardUsageResponse>(`/api/cards/${id}/usage`),

  importCards: (text: string) =>
    request<CardBulkImportResult>('/api/cards/import', {
      method: 'POST',
      body: jsonBody({ text }),
    }),

  getCardFinder: (cardId: number, grade: CardGrade) =>
    request<{
      card: CardCatalogEntry;
      targetGrade: CardGrade;
      results: CardFinderResult[];
    }>(
      `/api/cards/finder?cardId=${encodeURIComponent(
        String(cardId),
      )}&grade=${encodeURIComponent(grade)}`,
    ),

  setCharacterCard: (input: {
    characterId: number;
    cardId: number;
    grade: CardGrade;
  }) =>
    request<{ entry: CharacterCardEntry }>('/api/character-cards', {
      method: 'PUT',
      body: jsonBody(input),
    }),

  importCharacterCards: (characterId: number, text: string) =>
    request<CharacterCardImportResult>('/api/character-cards/import', {
      method: 'POST',
      body: JSON.stringify({ characterId, text }),
    }),

  removeCharacterCard: (characterId: number, cardId: number) =>
    request<void>(`/api/character-cards/${characterId}/${cardId}`, {
      method: 'DELETE',
    }),

  getBackups: () =>
    request<{ backups: BackupInfo[] }>('/api/backups'),

  exportData: () => request<unknown>('/api/data/export'),

  importData: (data: unknown) =>
    request<ImportResult>('/api/data/import', {
      method: 'POST',
      body: jsonBody(data),
    }),
};
