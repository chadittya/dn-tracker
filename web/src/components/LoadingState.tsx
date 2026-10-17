export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="card flex items-center justify-center gap-3 px-6 py-14 text-sm text-slate-500 dark:text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
      {label}
    </div>
  );
}
