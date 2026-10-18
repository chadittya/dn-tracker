import type { ReactNode } from 'react';

export function ProgressBar({
  label,
  done,
  total,
  trailing,
}: {
  label: string;
  done: number;
  total: number;
  trailing?: ReactNode;
}) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-slate-500 dark:text-slate-400">
            {done} / {total}
          </span>
          {trailing}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
