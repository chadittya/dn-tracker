import type {
  Character,
  HeraldrySlot,
  HeraldryState,
  HeraldryStatus,
} from '../api/types';
import { HeraldryStatusBadge } from './HeraldryStatusBadge';

const STATUS_LABELS: Record<HeraldryStatus, string> = {
  ok: 'OK',
  recommended: 'recommended',
  'needs-upgrade': 'needs upgrade',
};

function fallbackSlot(characterId: number, slot: number): HeraldrySlot {
  return {
    characterId,
    slot,
    isEmpty: true,
    plateId: null,
    plateName: null,
    level: null,
    rarity: null,
    hasThirdStat: false,
    status: 'needs-upgrade',
  };
}

export function HeraldryGrid({
  characters,
  heraldry,
  onEdit,
}: {
  characters: Character[];
  heraldry: HeraldryState;
  onEdit: (characterId: number, slot: number) => void;
}) {
  const slotMap = new Map<string, HeraldrySlot>();
  for (const slot of heraldry.slots) {
    slotMap.set(`${slot.characterId}:${slot.slot}`, slot);
  }

  const slotNumbers = Array.from(
    { length: heraldry.slotCount },
    (_, index) => index + 1,
  );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-auto">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-40 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold dark:border-slate-800 dark:bg-slate-900">
                Character
              </th>
              {slotNumbers.map((slotNumber) => (
                <th
                  key={slotNumber}
                  scope="col"
                  className="sticky top-0 z-20 min-w-36 border-b border-slate-200 bg-slate-50 px-2 py-3 text-center font-semibold dark:border-slate-800 dark:bg-slate-900"
                >
                  Slot {slotNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {characters.map((character) => (
              <tr key={character.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-56 truncate border-b border-r border-slate-200 bg-white px-4 py-2 text-left font-medium dark:border-slate-800 dark:bg-slate-950"
                >
                  {character.name}
                </th>
                {slotNumbers.map((slotNumber) => {
                  const slot =
                    slotMap.get(`${character.id}:${slotNumber}`) ??
                    fallbackSlot(character.id, slotNumber);

                  const description = slot.isEmpty
                    ? `${character.name} slot ${slotNumber}: empty, ${STATUS_LABELS[slot.status]}`
                    : `${character.name} slot ${slotNumber}: ${slot.plateName}, level ${slot.level}, ${slot.rarity}, ${STATUS_LABELS[slot.status]}`;

                  return (
                    <td
                      key={slotNumber}
                      className="border-b border-slate-200 p-1 align-top dark:border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => onEdit(character.id, slotNumber)}
                        aria-label={`${description}. Edit slot.`}
                        className={`flex min-h-20 w-full min-w-36 flex-col items-start justify-between gap-2 rounded-xl border p-2 text-left transition-colors ${
                          slot.isEmpty
                            ? 'border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20'
                            : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20'
                        }`}
                      >
                        {slot.isEmpty ? (
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Empty
                          </span>
                        ) : (
                          <span className="flex w-full flex-col gap-1">
                            <span className="w-full truncate font-semibold">
                              {slot.plateName}
                            </span>
                            <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span>Lv {slot.level}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {slot.rarity === 'epic' ? 'Epic' : 'Rare'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span
                                role="img"
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  slot.hasThirdStat
                                    ? 'bg-indigo-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                aria-label={
                                  slot.hasThirdStat
                                    ? 'Has 3rd stat'
                                    : 'No 3rd stat'
                                }
                                title={
                                  slot.hasThirdStat
                                    ? 'Has 3rd stat'
                                    : 'No 3rd stat'
                                }
                              />
                            </span>
                          </span>
                        )}
                        <HeraldryStatusBadge status={slot.status} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
        <span className="font-semibold">Legend:</span>
        <HeraldryStatusBadge status="ok" />
        <HeraldryStatusBadge status="recommended" />
        <HeraldryStatusBadge status="needs-upgrade" />
        <span className="muted">Empty slot = Needs upgrade</span>
      </div>
    </div>
  );
}
