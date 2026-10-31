import { ApiError } from './errors';
import {
  ENGRAVING_CATEGORIES,
  ENGRAVING_GRADES,
  ENGRAVING_SLOT_COUNT,
} from './engraving';
import type { EngravingCategory, EngravingGrade } from './engraving';
import { HERALDRY_SLOT_COUNT } from './heraldry';
import type { HeraldryRarity } from './heraldry';

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

export function parsePositiveInteger(value: unknown, field = 'value'): number {
  return parseId(value, field);
}

export function parseSlot(value: unknown, field = 'slot'): number {
  const slot = parseId(value, field);
  if (slot > HERALDRY_SLOT_COUNT) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${field} must be between 1 and ${HERALDRY_SLOT_COUNT}.`,
    );
  }
  return slot;
}

export function parseEngravingSlot(value: unknown, field = 'slot'): number {
  const slot = parseId(value, field);
  if (slot > ENGRAVING_SLOT_COUNT) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${field} must be between 1 and ${ENGRAVING_SLOT_COUNT}.`,
    );
  }
  return slot;
}

export function parseEngravingCategory(
  value: unknown,
  field = 'category',
): EngravingCategory {
  if (
    typeof value === 'string' &&
    (ENGRAVING_CATEGORIES as readonly string[]).includes(value)
  ) {
    return value as EngravingCategory;
  }

  throw new ApiError(
    400,
    'VALIDATION_ERROR',
    `${field} must be "weapon", "armor", "accessory", or "wtd".`,
  );
}

export function parseEngravingGrade(
  value: unknown,
  field = 'grade',
): EngravingGrade {
  if (
    typeof value === 'string' &&
    (ENGRAVING_GRADES as readonly string[]).includes(value)
  ) {
    return value as EngravingGrade;
  }

  throw new ApiError(
    400,
    'VALIDATION_ERROR',
    `${field} must be "rare", "epic", "unique", or "legend".`,
  );
}

export function parseRarity(
  value: unknown,
  field = 'rarity',
): HeraldryRarity {
  if (value === 'rare' || value === 'epic') return value;
  throw new ApiError(
    400,
    'VALIDATION_ERROR',
    `${field} must be "rare" or "epic".`,
  );
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
