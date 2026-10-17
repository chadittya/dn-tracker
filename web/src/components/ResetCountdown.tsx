import { useCountdown } from '../hooks/useCountdown';
import { formatDuration, formatWib } from '../lib/format';
import { useAppState } from '../state/context';

export function ResetCountdown({ compact = false }: { compact?: boolean }) {
  const { state, serverClockOffsetMs } = useAppState();
  const remaining = useCountdown(
    state?.nextResetAt ?? null,
    serverClockOffsetMs,
  );

  if (!state) return null;

  if (compact) {
    return (
      <span
        className="hidden rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex"
        title={`Next reset: ${formatWib(state.nextResetAt)}`}
      >
        Resets in {formatDuration(remaining)}
      </span>
    );
  }

  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Next weekly reset
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        {formatDuration(remaining)}
      </p>
      <p className="muted mt-1">
        {formatWib(state.nextResetAt)} · week {state.weekKey}
      </p>
    </div>
  );
}
