import type {
  Character,
  HeraldrySlot,
  HeraldryState,
  HeraldryStatus,
} from '../api/types';
import { matchesName } from './search';

export type HeraldryStatusFilter = 'all' | 'needs-upgrade' | 'recommended';

export const HERALDRY_PLATE_LIST_LIMIT = 3;
export const HERALDRY_UPGRADE_LIMIT = 10;

function groupSlotsByCharacter(
  slots: readonly HeraldrySlot[],
): Map<number, HeraldrySlot[]> {
  const grouped = new Map<number, HeraldrySlot[]>();

  for (const slot of slots) {
    const list = grouped.get(slot.characterId);
    if (list) {
      list.push(slot);
    } else {
      grouped.set(slot.characterId, [slot]);
    }
  }

  return grouped;
}

export function filterHeraldryCharacters(
  characters: readonly Character[],
  slots: readonly HeraldrySlot[],
  query: string,
  plateId: number | null,
  status: HeraldryStatusFilter,
): Character[] {
  const slotsByCharacter = groupSlotsByCharacter(slots);

  return characters.filter((character) => {
    if (!matchesName(character.name, query)) return false;

    const characterSlots = slotsByCharacter.get(character.id) ?? [];

    if (plateId !== null) {
      const plateSlot = characterSlots.find((slot) => slot.plateId === plateId);
      if (!plateSlot) return false;
      return status === 'all' || plateSlot.status === status;
    }

    if (status !== 'all') {
      return characterSlots.some((slot) => slot.status === status);
    }

    return true;
  });
}

export interface HeraldryUpgradeItem {
  characterId: number;
  name: string;
  status: Exclude<HeraldryStatus, 'ok'>;
  needsUpgrade: number;
  recommended: number;
  empty: number;
  plates: string[];
  hiddenPlateCount: number;
}

export interface HeraldryUpgradeList {
  items: HeraldryUpgradeItem[];
  more: number;
  allGood: boolean;
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.floor(limit));
}

export function buildHeraldryUpgradeList(
  heraldry: HeraldryState,
  limit: number = HERALDRY_UPGRADE_LIMIT,
): HeraldryUpgradeList {
  const slotsByCharacter = groupSlotsByCharacter(heraldry.slots);

  const eligible = heraldry.perCharacter
    .filter((summary) => summary.status !== 'ok')
    .map<HeraldryUpgradeItem>((summary) => {
      const status =
        summary.status === 'needs-upgrade' ? 'needs-upgrade' : 'recommended';

      const names = (slotsByCharacter.get(summary.characterId) ?? [])
        .filter(
          (slot) => slot.status === status && slot.plateName !== null,
        )
        .sort((a, b) => a.slot - b.slot)
        .map((slot) => slot.plateName ?? '')
        .filter((name) => name !== '');

      const plates = names.slice(0, HERALDRY_PLATE_LIST_LIMIT);

      return {
        characterId: summary.characterId,
        name: summary.name,
        status,
        needsUpgrade: summary.needsUpgrade,
        recommended: summary.recommended,
        empty: summary.empty,
        plates,
        hiddenPlateCount: names.length - plates.length,
      };
    })
    .sort(
      (a, b) =>
        (a.status === 'needs-upgrade' ? 0 : 1) -
          (b.status === 'needs-upgrade' ? 0 : 1) ||
        b.needsUpgrade - a.needsUpgrade ||
        b.recommended - a.recommended ||
        compareNames(a.name, b.name),
    );

  const items = eligible.slice(0, normalizeLimit(limit));

  return {
    items,
    more: eligible.length - items.length,
    allGood: eligible.length === 0,
  };
}
