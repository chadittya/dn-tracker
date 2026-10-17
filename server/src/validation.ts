import { ApiError } from './errors';

export const MAX_NAME_LENGTH = 50;

/**
 * Trim a name and validate it. Duplicate handling is left to the database's
 * NOCASE unique constraint (and mirrored in import validation).
 */
export function parseName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'name must be a string.');
  }

  const name = value.trim();
  if (name.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'name must not be empty.');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `name must be at most ${MAX_NAME_LENGTH} characters.`,
    );
  }

  return name;
}

export function parseId(value: unknown, field = 'id'): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${field} must be a positive integer.`,
    );
  }

  return parsed;
}

export function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a boolean.`);
  }
  return value;
}

/**
 * SQLite NOCASE folds ASCII A-Z only. Import validation mirrors that exactly
 * so imported data cannot violate the table's actual uniqueness semantics.
 */
export function foldNameForComparison(name: string): string {
  return name.replace(/[A-Z]/g, (char) => char.toLowerCase());
}
