import { useState } from 'react';
import type { Tab } from '../lib/navigation';
import { useAppState } from '../state/context';
import { CharacterToggleCard } from '../components/CharacterToggleCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';

export function RunPage({
  onNavigate,
}: {
  onNavigate: (tab: Tab) => void;
}) {
  const { state, loading, setRun, pendingRuns } = useAppState();
  const [selectedNestId, setSelectedNestId] = useState<number | null>(null);

  if (loading && !state) return <LoadingState />;
  if (!state) return null;

  if (state.nests.length === 0) {
    return (
      <EmptyState
        title="No nests yet"
        description="Add the nests you run each week, then come back here to track who has completed them."
        actionLabel="Add nests"
        onAction={() => onNavigate('manage')}
      />
    );
  }

  if (state.characters.length === 0) {
    return (
      <EmptyState
        title="No characters yet"
        description="Add your characters once, then each nest shows every character automatically."
        actionLabel="Add characters"
        onAction={() => onNavigate('manage')}
      />
    );
  }

  const selected =
    state.nests.find((nest) => nest.id === selectedNestId) ?? state.nests[0];
  if (!selected) return null;

  const doneIds = new Set(
    state.runs
      .filter((run) => run.nestId === selected.id)
      .map((run) => run.characterId),
  );
  const notYet = state.characters.filter(
    (character) => !doneIds.has(character.id),
  );
  const doneCharacters = state.characters.filter((character) =>
    doneIds.has(character.id),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nest runs</h1>
          <p className="muted mt-1">
            Pick a nest, then click a character to toggle this week.
          </p>
        </div>
        <div className="card px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Done
          </span>{' '}
          <span className="text-lg font-bold tabular-nums">
            {doneCharacters.length} / {state.characters.length}
          </span>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Choose a nest"
      >
        {state.nests.map((nest) => (
          <button
            key={nest.id}
            type="button"
            onClick={() => setSelectedNestId(nest.id)}
            aria-pressed={nest.id === selected.id}
            className={`chip ${
              nest.id === selected.id ? 'chip-active' : 'chip-inactive'
            }`}
          >
            {nest.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <header className="flex items-center justify-between gap-3 px-1">
            <h2 className="section-title">Not yet</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {notYet.length}
            </span>
          </header>
          <div className="mt-3 space-y-2">
            {notYet.length === 0 ? (
              <p className="muted rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
                Everyone has run {selected.name} this week.
              </p>
            ) : (
              notYet.map((character) => (
                <CharacterToggleCard
                  key={character.id}
                  name={character.name}
                  done={false}
                  pending={pendingRuns.has(`${character.id}:${selected.id}`)}
                  onToggle={() => void setRun(character.id, selected.id, true)}
                />
              ))
            )}
          </div>
        </section>

        <section className="card p-4">
          <header className="flex items-center justify-between gap-3 px-1">
            <h2 className="section-title">Done</h2>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {doneCharacters.length}
            </span>
          </header>
          <div className="mt-3 space-y-2">
            {doneCharacters.length === 0 ? (
              <p className="muted rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
                No one has completed {selected.name} yet this week.
              </p>
            ) : (
              doneCharacters.map((character) => (
                <CharacterToggleCard
                  key={character.id}
                  name={character.name}
                  done
                  pending={pendingRuns.has(`${character.id}:${selected.id}`)}
                  onToggle={() => void setRun(character.id, selected.id, false)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
