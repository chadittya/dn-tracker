import type { Tab } from '../lib/navigation';
import { useAppState } from '../state/context';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { MatrixGrid } from '../components/MatrixGrid';

export function MatrixPage({
  onNavigate,
}: {
  onNavigate: (tab: Tab) => void;
}) {
  const { state, loading, setRun, pendingRuns } = useAppState();

  if (loading && !state) return <LoadingState />;
  if (!state) return null;

  if (state.characters.length === 0) {
    return (
      <EmptyState
        title="No characters yet"
        description="Add your characters to see the full run matrix."
        actionLabel="Add characters"
        onAction={() => onNavigate('manage')}
      />
    );
  }

  if (state.nests.length === 0) {
    return (
      <EmptyState
        title="No nests yet"
        description="Add nests to see the full run matrix."
        actionLabel="Add nests"
        onAction={() => onNavigate('manage')}
      />
    );
  }

  const donePairs = new Set(
    state.runs.map((run) => `${run.characterId}:${run.nestId}`),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matrix</h1>
        <p className="muted mt-1">
          Click any cell to toggle a run. Scroll for more characters and nests.
        </p>
      </div>

      <MatrixGrid
        characters={state.characters}
        nests={state.nests}
        donePairs={donePairs}
        pendingRuns={pendingRuns}
        onToggle={(characterId, nestId, done) => {
          void setRun(characterId, nestId, done);
        }}
      />
    </div>
  );
}
