import type {
  Character,
  EngravingCategoryMeta,
  EngravingCharacterSummary,
  EngravingSlotDefinition,
  EngravingValue,
} from '../api/types';
import { compareNames, normalizeLimit } from './ordering';
import { matchesName } from './search';

export const ENGRAVING_EMPTY_LIST_LIMIT = 10;
export const ENGRAVING_EMPTY_SLOT_LIMIT = 3;

/**
 * Formats integer hundredths as a percent with exactly two decimals.
 * Uses integer string maths so 1.15% never becomes 1.1499999999999999%.
 */
export function formatPercent(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const fraction = hundredths % 100;
  return `${whole}.${String(fraction).padStart(2, '0')}%`;
}

/** Same as formatPercent without the percent sign, for editable inputs. */
export function formatPercentInput(hundredths: number): string {
  return formatPercent(hundredths).slice(0, -1);
}

/**
 * Parses a percent input into integer hundredths. String/integer maths only,
 * so no floating-point rounding is involved. Accepts up to two decimals and
 * a leading-dot form such as ".5". Rejects signs, exponents, commas, a
 * trailing dot, more than two decimals, and values that are not positive.
 */
export function parsePercentInput(raw: string): number | null {
  const normalized = raw.trim();
  if (!/^\d*(?:\.\d{1,2})?$/.test(normalized)) return null;
  if (normalized === '' || normalized === '.') return null;

  const [wholePart = '', fractionPart = ''] = normalized.split('.');
  const whole = wholePart === '' ? 0 : Number(wholePart);
  const fraction = Number((fractionPart + '00').slice(0, 2));
  const hundredths = whole * 100 + fraction;

  if (!Number.isSafeInteger(hundredths) || hundredths <= 0) return null;
  return hundredths;
}

export function formatEngravingValue(
  value: Pick<EngravingValue, 'firstStatValue' | 'secondStatValue'>,
  category: EngravingCategoryMeta,
): string {
  const first = `${formatPercent(value.firstStatValue)} ${
    category.firstStatLabel
  }`;
  if (value.secondStatValue === null || category.secondStatLabel === null) {
    return first;
  }
  return `${first} · ${formatPercent(value.secondStatValue)} ${
    category.secondStatLabel
  }`;
}

/** The slot filter is a view choice; only the name search filters characters. */
export function filterEngravingCharacters(
  characters: readonly Character[],
  query: string,
): Character[] {
  return characters.filter((character) =>
    matchesName(character.name, query),
  );
}

export function visibleSlotDefinitions(
  definitions: readonly EngravingSlotDefinition[],
  slotFilter: number | null,
): EngravingSlotDefinition[] {
  if (slotFilter === null) return [...definitions];
  return definitions.filter((definition) => definition.slot === slotFilter);
}

export interface EngravingEmptyListItem {
  characterId: number;
  name: string;
  emptyCount: number;
  slots: string[];
  hiddenSlotCount: number;
}

export interface EngravingEmptyList {
  items: EngravingEmptyListItem[];
  more: number;
  allFilled: boolean;
}

export function buildEngravingEmptyList(
  perCharacter: readonly EngravingCharacterSummary[],
  limit: number = ENGRAVING_EMPTY_LIST_LIMIT,
): EngravingEmptyList {
  const eligible = perCharacter
    .filter((summary) => summary.emptyCount > 0)
    .sort(
      (a, b) =>
        b.emptyCount - a.emptyCount || compareNames(a.name, b.name),
    )
    .map<EngravingEmptyListItem>((summary) => {
      const slots = summary.emptySlots
        .slice(0, ENGRAVING_EMPTY_SLOT_LIMIT)
        .map((slot) => slot.label);

      return {
        characterId: summary.characterId,
        name: summary.name,
        emptyCount: summary.emptyCount,
        slots,
        hiddenSlotCount: summary.emptySlots.length - slots.length,
      };
    });

  const items = eligible.slice(0, normalizeLimit(limit));

  return {
    items,
    more: eligible.length - items.length,
    allFilled: eligible.length === 0,
  };
}
