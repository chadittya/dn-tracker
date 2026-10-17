import type { Tab } from '../lib/navigation';
import { useAppState } from '../state/context';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ProgressBar } from '../components/ProgressBar';
import { ResetCountdown } from '../components/ResetCountdown';
import { StatCard } from '../components/StatCard';

export function DashboardPage({
  onNavigate,
}: {
  onNavigate: (tab: Tab) => void;
}) {
  const { state, loading } = useAppState();

  if (loading && !state) return <LoadingState />;
  if (!state) return null;

  if (state.characters.length === 0 || state.nests.length === 0) {
    return (
      <EmptyState
        title="Nothing to track yet"
        description="Add at least one character and one nest to see your weekly progress."
        actionLabel="Go to Manage"
        onAction={() => onNavigate('manage')}
      />
    );
  }

  const { dashboard } = state;
  const percent =
    dashboard.total > 0
      ? Math.round((dashboard.done / dashboard.total) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="muted mt-1">
          Week {state.weekKey} · progress across all characters and nests.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overall"
          value={`${dashboard.done} / ${dashboard.total}`}
          hint={`${percent}% complete`}
        />
        <StatCard
          label="Remaining"
          value={String(dashboard.total - dashboard.done)}
          hint="runs left this week"
        />
        <StatCard
          label="Characters"
          value={String(state.characters.length)}
          hint={`${state.nests.length} nests each`}
        />
        <ResetCountdown />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="section-title">Progress per nest</h2>
          <div className="mt-4 space-y-4">
            {dashboard.perNest.map((nest) => (
              <ProgressBar
                key={nest.nestId}
                label={nest.name}
                done={nest.done}
                total={nest.total}
              />
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="section-title">Progress per character</h2>
          <div className="mt-4 space-y-4">
            {dashboard.perCharacter.map((character) => (
              <ProgressBar
                key={character.characterId}
                label={character.name}
                done={character.done}
                total={character.total}
              />
            ))}
          </div>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="section-title">Most remaining runs</h2>
        <p className="muted mt-1">
          Characters ranked by how many nests they still need this week.
        </p>
        <ol className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
          {dashboard.mostRemaining.map((character, index) => (
            <li
              key={character.characterId}
              className="flex min-h-12 items-center gap-3 py-2"
            >
              <span className="w-6 text-sm font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                {index + 1}.
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {character.name}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                  character.remaining === 0
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                }`}
              >
                {character.remaining} left
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
