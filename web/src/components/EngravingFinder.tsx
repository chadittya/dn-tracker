import type {
  EngravingCategoryMeta,
  EngravingFinderResult,
  EngravingGrade,
  EngravingSlotDefinition,
  EngravingValue,
  EngravingValueTables,
} from '../api/types';
import { formatEngravingValue, formatPercent } from '../lib/engraving';
import { EngravingGradeBadge } from './EngravingGradeBadge';

export interface FinderResponse {
  slot: EngravingSlotDefinition;
  targetValue: EngravingValue;
  results: EngravingFinderResult[];
}

export function EngravingFinder({
  slotDefinitions,
  categories,
  valueTables,
  grades,
  slot,
  grade,
  valueId,
  onSlotChange,
  onGradeChange,
  onValueChange,
  result,
  loading,
  error,
}: {
  slotDefinitions: EngravingSlotDefinition[];
  categories: EngravingCategoryMeta[];
  valueTables: EngravingValueTables;
  grades: Array<{ key: EngravingGrade; label: string }>;
  slot: number | '';
  grade: EngravingGrade | '';
  valueId: number | '';
  onSlotChange: (slot: number | '') => void;
  onGradeChange: (grade: EngravingGrade | '') => void;
  onValueChange: (valueId: number | '') => void;
  result: FinderResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const selectedDefinition = slotDefinitions.find(
    (definition) => definition.slot === slot,
  );
  const categoryMeta = selectedDefinition
    ? categories.find((category) => category.key === selectedDefinition.category)
    : undefined;
  const valueOptions =
    selectedDefinition && grade !== ''
      ? valueTables[selectedDefinition.category].filter(
          (value) => value.grade === grade,
        )
      : [];

  const targetLabel =
    result && categoryMeta
      ? formatEngravingValue(result.targetValue, categoryMeta)
      : null;

  return (
    <section className="card p-5">
      <div>
        <h2 className="section-title">Find a slot to upgrade</h2>
        <p className="muted mt-1">
          Choose a slot and the engraving value you want. Characters with an
          empty slot or a lower value are listed first.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="engraving-finder-slot" className="text-sm font-medium">
            Slot
          </label>
          <select
            id="engraving-finder-slot"
            className="input mt-1"
            value={slot === '' ? '' : String(slot)}
            onChange={(event) =>
              onSlotChange(
                event.target.value === '' ? '' : Number(event.target.value),
              )
            }
          >
            <option value="">Choose a slot</option>
            {slotDefinitions.map((definition) => (
              <option key={definition.slot} value={definition.slot}>
                {definition.slot}. {definition.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="engraving-finder-grade"
            className="text-sm font-medium"
          >
            Grade
          </label>
          <select
            id="engraving-finder-grade"
            className="input mt-1"
            value={grade}
            onChange={(event) =>
              onGradeChange(event.target.value as EngravingGrade | '')
            }
            disabled={selectedDefinition === undefined}
          >
            <option value="">Choose a grade</option>
            {grades.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="engraving-finder-value"
            className="text-sm font-medium"
          >
            Value
          </label>
          <select
            id="engraving-finder-value"
            className="input mt-1"
            value={valueId === '' ? '' : String(valueId)}
            onChange={(event) =>
              onValueChange(
                event.target.value === '' ? '' : Number(event.target.value),
              )
            }
            disabled={valueOptions.length === 0}
          >
            <option value="">
              {valueOptions.length === 0
                ? 'Choose a slot and grade first'
                : 'Choose a value'}
            </option>
            {valueOptions.map((value) => (
              <option key={value.id} value={value.id}>
                {categoryMeta
                  ? formatEngravingValue(value, categoryMeta)
                  : formatPercent(value.firstStatValue)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedDefinition && valueOptions.length === 0 && (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          No {grade || ''} values for {selectedDefinition.label}. Add values in
          Manage.
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="muted mt-4">Finding characters…</p>}

      {!loading && result && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            {result.slot.label}
            {targetLabel ? ` · ${targetLabel}` : ''}
          </p>
          {result.results.length === 0 ? (
            <p className="muted mt-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center dark:border-slate-700">
              No characters have an empty or lower-valued slot.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
              {result.results.map((item) => (
                <li
                  key={item.characterId}
                  className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="font-medium">{item.name}</span>
                  {item.isEmpty || item.grade === null ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      No engraving yet
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <EngravingGradeBadge grade={item.grade} />
                      <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
                        {formatPercent(item.firstStatValue ?? 0)}
                        {item.secondStatValue !== null &&
                        categoryMeta?.secondStatLabel
                          ? ` · ${formatPercent(item.secondStatValue)}`
                          : ''}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
