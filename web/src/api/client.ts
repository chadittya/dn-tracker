import type {
  AppState,
  BackupInfo,
  Character,
  ImportResult,
  Nest,
} from './types';

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
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
      error?: { code?: string; message?: string };
    } | null)?.error;
    throw new ApiRequestError(
      error?.message ?? `Request failed (${response.status}).`,
      error?.code ?? 'REQUEST_FAILED',
      response.status,
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

  getBackups: () =>
    request<{ backups: BackupInfo[] }>('/api/backups'),

  exportData: () => request<unknown>('/api/data/export'),

  importData: (data: unknown) =>
    request<ImportResult>('/api/data/import', {
      method: 'POST',
      body: jsonBody(data),
    }),
};
