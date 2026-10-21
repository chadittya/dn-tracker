import {
  PAGE_SIZE,
  formatPageRange,
  formatPageStatus,
} from '../lib/pagination';
import type { PageSummary } from '../lib/pagination';

export function Pagination({
  summary,
  itemPlural,
  label,
  onPrevious,
  onNext,
}: {
  summary: PageSummary;
  itemPlural: string;
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (summary.total <= PAGE_SIZE) return null;

  return (
    <nav
      aria-label={`${label} pagination`}
      className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
    >
      <p className="muted tabular-nums">
        {formatPageRange(summary, itemPlural)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary min-h-10 px-3"
          onClick={onPrevious}
          disabled={!summary.hasPrevious}
          aria-label={`Previous page of ${itemPlural}`}
        >
          Previous
        </button>
        <span className="muted tabular-nums" aria-live="polite">
          {formatPageStatus(summary.page, summary.pageCount)}
        </span>
        <button
          type="button"
          className="btn btn-secondary min-h-10 px-3"
          onClick={onNext}
          disabled={!summary.hasNext}
          aria-label={`Next page of ${itemPlural}`}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
