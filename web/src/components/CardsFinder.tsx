import type {
  CardCatalogEntry,
  CardFinderResult,
  CardGrade,
  CardGradeMeta,
} from '../api/types';
import { CARD_GRADE_COLORS } from '../lib/engravingColors';
import { CardGradeBadge } from './CardGradeBadge';
import { ComboBox } from './ComboBox';

export interface CardFinderResponse {
  card: CardCatalogEntry;
  targetGrade: CardGrade;
  results: CardFinderResult[];
}

export function CardsFinder({
  catalog,
  grades,
  cardId,
  grade,
  onCardChange,
  onGradeChange,
  result,
  loading,
  error,
}: {
  catalog: CardCatalogEntry[];
  grades: CardGradeMeta[];
  cardId: number | null;
  grade: CardGrade | null;
  onCardChange: (cardId: number | null) => void;
  onGradeChange: (grade: CardGrade) => void;
  result: CardFinderResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const targetLabel = result
    ? CARD_GRADE_COLORS[result.targetGrade].label
    : grade
      ? CARD_GRADE_COLORS[grade].label
      : null;

  return (
    <section className="card p-5">
      <div>
        <h2 className="section-title">Find who needs a card</h2>
        <p className="muted mt-1">
          Choose a card and a target grade. Characters without the card or
          below that grade are listed first.
        </p>
      </div>

      {catalog.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          No cards yet. Add cards in Manage.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <span className="text-sm font-medium">Card</span>
            <ComboBox
              label="Card"
              placeholder="Search cards"
              options={catalog.map((card) => ({
                id: card.id,
                label: card.name,
              }))}
              value={cardId}
              onChange={onCardChange}
              emptyText="No matching cards."
              className="mt-1"
            />
          </div>

          <div>
            <span className="text-sm font-medium">Target grade</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {grades.map((option) => {
                const colors = CARD_GRADE_COLORS[option.key];
                const selected = grade === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`btn ${
                      selected
                        ? colors.buttonSelectedClassName
                        : colors.buttonClassName
                    }`}
                    aria-pressed={selected}
                    onClick={() => onGradeChange(option.key)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
            {result.card.name} · {targetLabel}
          </p>
          {result.results.length === 0 ? (
            <p className="muted mt-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center dark:border-slate-700">
              No characters are missing or below {targetLabel} for{' '}
              {result.card.name}.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
              {result.results.map((item) => (
                <li
                  key={item.characterId}
                  className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="font-medium">{item.name}</span>
                  {item.grade === null ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      No card
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <CardGradeBadge grade={item.grade} />
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        Below {targetLabel}
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
