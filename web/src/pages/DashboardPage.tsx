import type { Navigate } from '../lib/navigation';
import { buildDashboardLists } from '../lib/dashboard';
import { buildEngravingEmptyList } from '../lib/engraving';
import { buildHeraldryUpgradeList } from '../lib/heraldry';
import { useAppState } from '../state/context';
import { DashboardListSection } from '../components/DashboardListSection';
import { EmptyState } from '../components/EmptyState';
import { HeraldryStatusBadge } from '../components/HeraldryStatusBadge';
import { LoadingState } from '../components/LoadingState';
import { ProgressBar } from '../components/ProgressBar';
import { ResetCountdown } from '../components/ResetCountdown';
import { StatCard } from '../components/StatCard';

export function DashboardPage({
  onNavigate,
}: {
  onNavigate: Navigate;
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
  const lists = buildDashboardLists(dashboard);
  const heraldryList = buildHeraldryUpgradeList(state.heraldry);
  const engravingList = buildEngravingEmptyList(state.engraving.perCharacter);
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

      {lists.allDone ? (
        <section className="card flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <p className="text-lg font-semibold">All done this week</p>
          <p className="muted">
            Every character has run every nest. Come back after the next reset.
          </p>
        </section>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <DashboardListSection
            title="Most remaining"
            description="Characters ranked by how many nests they still need this week."
            actionLabel="View all"
            onAction={() => onNavigate('matrix')}
            isEmpty={lists.topCharacters.length === 0}
            emptyMessage="No characters have remaining runs."
            moreCount={lists.moreCharacters}
            moreLabel="characters"
          >
            {lists.topCharacters.map((character) => (
              <ProgressBar
                key={character.characterId}
                label={character.name}
                done={character.done}
                total={character.total}
                trailing={
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    {character.remaining} left
                  </span>
                }
              />
            ))}
          </DashboardListSection>

          <DashboardListSection
            title="Nests needing runs"
            description="Nests that are not finished yet, ranked by most remaining."
            actionLabel="View all"
            onAction={() => onNavigate('runs')}
            isEmpty={lists.topNests.length === 0}
            emptyMessage="Every nest is complete."
            moreCount={lists.moreNests}
            moreLabel="nests"
          >
            {lists.topNests.map((nest) => (
              <ProgressBar
                key={nest.nestId}
                label={nest.name}
                done={nest.done}
                total={nest.total}
                trailing={
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    {nest.remaining} left
                  </span>
                }
              />
            ))}
          </DashboardListSection>
        </div>
      )}

      {state.heraldry.levels.length === 0 ? (
        <section className="card flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <h2 className="section-title">Heraldry to upgrade</h2>
          <p className="muted">Set the cap in Manage first.</p>
          <button
            type="button"
            className="btn btn-primary mt-2"
            onClick={() => onNavigate('manage')}
          >
            Go to Manage
          </button>
        </section>
      ) : (
        <DashboardListSection
          title="Heraldry to upgrade"
          description="Characters whose heraldry needs attention, ranked by the most urgent slots."
          actionLabel="View all"
          onAction={() => onNavigate('heraldry')}
          isEmpty={heraldryList.items.length === 0}
          emptyMessage="All heraldry slots are up to date."
          moreCount={heraldryList.more}
          moreLabel="characters"
        >
          {heraldryList.items.map((item) => (
            <button
              key={item.characterId}
              type="button"
              onClick={() =>
                onNavigate('heraldry', { characterQuery: item.name })
              }
              className="flex min-h-14 w-full flex-col gap-2 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="muted block truncate">
                  {item.plates.join(', ')}
                  {item.hiddenPlateCount > 0
                    ? ` +${item.hiddenPlateCount}`
                    : ''}
                  {item.empty > 0
                    ? `${
                        item.plates.length > 0 || item.hiddenPlateCount > 0
                          ? ' · '
                          : ''
                      }${item.empty} empty`
                    : ''}
                </span>
              </span>
              <HeraldryStatusBadge status={item.status} />
            </button>
          ))}
        </DashboardListSection>
      )}

      <DashboardListSection
        title="Engraving empty slots"
        description="Characters missing the most engraving slots, ranked by empty count."
        actionLabel="View all"
        onAction={() => onNavigate('engraving')}
        isEmpty={engravingList.items.length === 0}
        emptyMessage="All engraving slots are filled."
        moreCount={engravingList.more}
        moreLabel="characters"
      >
        {engravingList.items.map((item) => (
          <button
            key={item.characterId}
            type="button"
            onClick={() =>
              onNavigate('engraving', { characterQuery: item.name })
            }
            className="flex min-h-14 w-full flex-col gap-2 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.name}</span>
              <span className="muted block truncate">
                {item.slots.join(', ')}
                {item.hiddenSlotCount > 0
                  ? ` +${item.hiddenSlotCount}`
                  : ''}
                {' · '}
                {item.emptyCount} empty
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {item.emptyCount} empty
            </span>
          </button>
        ))}
      </DashboardListSection>
    </div>
  );
}
