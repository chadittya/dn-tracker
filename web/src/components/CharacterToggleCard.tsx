export function CharacterToggleCard({
  name,
  done,
  pending,
  onToggle,
}: {
  name: string;
  done: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={done}
      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
        done
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/60'
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30'
      }`}
    >
      <span className="truncate font-medium">{name}</span>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
          done
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-slate-300 text-transparent dark:border-slate-600'
        }`}
        aria-hidden="true"
      >
        ✓
      </span>
    </button>
  );
}
