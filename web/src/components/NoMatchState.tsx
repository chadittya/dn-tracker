export function NoMatchState({
  message,
  onAction,
  actionLabel = 'Clear filters',
}: {
  message: string;
  onAction: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
      <p className="text-sm font-medium">{message}</p>
      <button
        type="button"
        className="btn btn-secondary mt-3 min-h-9 px-3"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  );
}
