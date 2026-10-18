export function FilterStatus({
  messages,
  onClear,
}: {
  messages: string[];
  onClear: () => void;
}) {
  if (messages.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300"
    >
      <span>{messages.join(' · ')}</span>
      <button
        type="button"
        className="btn btn-ghost min-h-9 px-2 text-indigo-600 dark:text-indigo-300"
        onClick={onClear}
      >
        Clear filters
      </button>
    </div>
  );
}
