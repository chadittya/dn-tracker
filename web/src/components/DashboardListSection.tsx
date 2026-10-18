import type { ReactNode } from 'react';

export function DashboardListSection({
  title,
  description,
  actionLabel,
  onAction,
  isEmpty,
  emptyMessage,
  moreCount,
  moreLabel,
  children,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  isEmpty: boolean;
  emptyMessage: string;
  moreCount: number;
  moreLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="muted mt-1">{description}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost min-h-9 px-2 text-sm"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      </div>

      {isEmpty ? (
        <p className="muted mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-4 space-y-4">{children}</div>
      )}

      {moreCount > 0 && (
        <p className="muted mt-4">
          +{moreCount} more {moreLabel}
        </p>
      )}
    </section>
  );
}
