import { useMemo, useState } from 'react';
import type { Character, Nest, Run } from '../api/types';
import type { Tab } from '../lib/navigation';
import {
  filterByName,
  filterMatrixCharacters,
  isFilterActive,
} from '../lib/search';
import { useAppState } from '../state/context';
import { EmptyState } from '../components/EmptyState';
import { FilterStatus } from '../components/FilterStatus';
import { LoadingState } from '../components/LoadingState';
import { MatrixGrid } from '../components/MatrixGrid';
import { NoMatchState } from '../components/NoMatchState';
import { SearchField } from '../components/SearchField';

const EMPTY_CHARACTERS: Character[] = [];
const EMPTY_NESTS: Nest[] = [];
const EMPTY_RUNS: Run[] = [];

export function MatrixPage({
  onNavigate,
}: {
  onNavigate: (tab: Tab) => void;
}) {
  const { state, loading, setRun, pendingRuns } = useAppState();
  const [characterQuery, setCharacterQuery] = useState('');
  const [nestQuery, setNestQuery] = useState('');
  const [onlyRemaining, setOnlyRemaining] = useState(false);

  const characters = state?.characters ?? EMPTY_CHARACTERS;
  const nests = state?.nests ?? EMPTY_NESTS;
  const runs = state?.runs ?? EMPTY_RUNS;

  const donePairs = useMemo(
    () =>
      new Set(runs.map((run) => `${run.characterId}:${run.nestId}`)),
    [runs],
  );

  const visibleNests = useMemo(
    () => filterByName(nests, nestQuery),
    [nests, nestQuery],
  );

  const visibleCharacters = useMemo(
    () =>
      filterMatrixCharacters(
        characters,
        visibleNests,
        donePairs,
        characterQuery,
        onlyRemaining,
      ),
    [characters, visibleNests, donePairs, characterQuery, onlyRemaining],
  );

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

  const characterFilterActive = isFilterActive(characterQuery);
  const nestFilterActive = isFilterActive(nestQuery);

  const filterMessages: string[] = [];
  if (characterFilterActive || onlyRemaining) {
    filterMessages.push(
      `Showing ${visibleCharacters.length} of ${characters.length} characters`,
    );
  }
  if (nestFilterActive) {
    filterMessages.push(
      `Showing ${visibleNests.length} of ${nests.length} nests`,
    );
  }

  const clearFilters = () => {
    setCharacterQuery('');
    setNestQuery('');
    setOnlyRemaining(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matrix</h1>
        <p className="muted mt-1">
          Click any cell to toggle a run. Scroll for more characters and nests.
        </p>
      </div>

      <section className="card flex flex-col gap-3 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <SearchField
            value={characterQuery}
            onChange={setCharacterQuery}
            placeholder="Search characters"
            label="Search characters"
          />
          <SearchField
            value={nestQuery}
            onChange={setNestQuery}
            placeholder="Search nests"
            label="Search nests"
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            checked={onlyRemaining}
            onChange={(event) => setOnlyRemaining(event.target.checked)}
          />
          Only characters with remaining runs
        </label>

        <FilterStatus messages={filterMessages} onClear={clearFilters} />
      </section>

      {visibleNests.length === 0 ? (
        <NoMatchState
          message={`No nests match “${nestQuery.trim()}”.`}
          onAction={clearFilters}
        />
      ) : visibleCharacters.length === 0 ? (
        <NoMatchState
          message={
            characterFilterActive
              ? `No characters match “${characterQuery.trim()}”.`
              : 'All characters are done on the visible nests.'
          }
          actionLabel={
            onlyRemaining && !characterFilterActive
              ? 'Show all characters'
              : 'Clear filters'
          }
          onAction={
            onlyRemaining && !characterFilterActive
              ? () => setOnlyRemaining(false)
              : clearFilters
          }
        />
      ) : (
        <MatrixGrid
          characters={visibleCharacters}
          nests={visibleNests}
          donePairs={donePairs}
          pendingRuns={pendingRuns}
          onToggle={(characterId, nestId, done) => {
            void setRun(characterId, nestId, done);
          }}
        />
      )}
    </div>
  );
}
