import type {
  Character,
  EngravingCategoryMeta,
  EngravingSlot,
  EngravingSlotDefinition,
  EngravingState,
} from '../api/types';
import { formatPercent, visibleSlotDefinitions } from '../lib/engraving';
import { EngravingGradeBadge } from './EngravingGradeBadge';

function fallbackSlot(definition: EngravingSlotDefinition): EngravingSlot {
  return {
    characterId: 0,
    slot: definition.slot,
    category: definition.category,
    label: definition.label,
    isEmpty: true,
    valueId: null,
    grade: null,
    firstStatValue: null,
    secondStatValue: null,
    thirdStatName: null,
    thirdStatValue: null,
  };
}

export function EngravingGrid({
  characters,
  engraving,
  slotFilter,
  onEdit,
}: {
  characters: Character[];
  engraving: EngravingState;
  slotFilter: number | null;
  onEdit: (characterId: number, slot: number) => void;
}) {
  const slotMap = new Map<string, EngravingSlot>();
  for (const slot of engraving.slots) {
    slotMap.set(`${slot.characterId}:${slot.slot}`, slot);
  }

  const visibleSlots = visibleSlotDefinitions(
    engraving.slotDefinitions,
    slotFilter,
  );

  const categoryMetaByKey = new Map<string, EngravingCategoryMeta>();
  for (const category of engraving.categories) {
    categoryMetaByKey.set(category.key, category);
  }

  const groups: Array<{
    key: string;
    label: string;
    count: number;
  }> = [];
  for (const definition of visibleSlots) {
    const last = groups[groups.length - 1];
    if (last?.key === definition.category) {
      last.count += 1;
    } else {
      groups.push({
        key: definition.category,
        label:
          categoryMetaByKey.get(definition.category)?.label ??
          definition.category,
        count: 1,
      });
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-auto">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-30 min-w-40 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left align-bottom font-semibold dark:border-slate-800 dark:bg-slate-900"
              >
                Character
              </th>
              {groups.map((group) => (
                <th
                  key={group.key}
                  colSpan={group.count}
                  className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                >
                  {group.label}
                </th>
              ))}
            </tr>
            <tr>
              {visibleSlots.map((definition) => (
                <th
                  key={definition.slot}
                  scope="col"
                  className="sticky top-9 z-20 min-w-36 border-b border-slate-200 bg-slate-50 px-2 py-2 text-center font-semibold dark:border-slate-800 dark:bg-slate-900"
                >
                  {definition.label}
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
                {visibleSlots.map((definition) => {
                  const slot =
                    slotMap.get(`${character.id}:${definition.slot}`) ??
                    fallbackSlot(definition);
                  const category = categoryMetaByKey.get(definition.category);

                  const thirdStat =
                    slot.thirdStatName !== null &&
                    slot.thirdStatValue !== null
                      ? `${slot.thirdStatName} ${formatPercent(
                          slot.thirdStatValue,
                        )}`
                      : null;

                  const description = slot.isEmpty
                    ? `${character.name} ${definition.label}: no engraving yet`
                    : `${character.name} ${definition.label}: ${
                        slot.grade
                      }, ${formatPercent(
                        slot.firstStatValue ?? 0,
                      )} ${category?.firstStatLabel ?? ''}${
                        slot.secondStatValue !== null &&
                        category?.secondStatLabel
                          ? `, ${formatPercent(
                              slot.secondStatValue,
                            )} ${category.secondStatLabel}`
                          : ''
                      }${thirdStat ? `, third stat ${thirdStat}` : ''}`;

                  return (
                    <td
                      key={definition.slot}
                      className="border-b border-slate-200 p-1 align-top dark:border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => onEdit(character.id, definition.slot)}
                        aria-label={`${description}. Edit slot.`}
                        className={`flex min-h-20 w-full min-w-36 flex-col items-start justify-between gap-2 rounded-xl border p-2 text-left transition-colors ${
                          slot.isEmpty
                            ? 'border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20'
                            : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20'
                        }`}
                      >
                        {slot.isEmpty ? (
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            No engraving yet
                          </span>
                        ) : (
                          <span className="flex w-full flex-col gap-1">
                            <span className="flex items-center justify-between gap-1">
                              {slot.grade && (
                                <EngravingGradeBadge grade={slot.grade} />
                              )}
                              <span
                                role="img"
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  thirdStat
                                    ? 'bg-indigo-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                aria-label={
                                  thirdStat
                                    ? `Third stat: ${thirdStat}`
                                    : 'No third stat'
                                }
                                title={
                                  thirdStat
                                    ? `Third stat: ${thirdStat}`
                                    : 'No third stat'
                                }
                              />
                            </span>
                            <span className="w-full truncate text-xs font-medium tabular-nums">
                              {formatPercent(slot.firstStatValue ?? 0)}
                              {slot.secondStatValue !== null &&
                              category?.secondStatLabel
                                ? ` · ${formatPercent(slot.secondStatValue)}`
                                : ''}
                            </span>
                            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {category?.firstStatLabel}
                              {slot.secondStatValue !== null &&
                              category?.secondStatLabel
                                ? ` / ${category.secondStatLabel}`
                                : ''}
                            </span>
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
        <span className="font-semibold">Grades:</span>
        {(['rare', 'epic', 'unique', 'legend'] as const).map((grade) => (
          <EngravingGradeBadge key={grade} grade={grade} />
        ))}
        <span className="muted">Dot = third stat</span>
      </div>
    </div>
  );
}
