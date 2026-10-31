import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { EngravingGrade } from '../api/types';
import { filterEngravingCharacters } from '../lib/engraving';
import type { Navigate } from '../lib/navigation';
import { isFilterActive } from '../lib/search';
import { useAppState } from '../state/context';
import { EmptyState } from '../components/EmptyState';
import { EngravingFinder } from '../components/EngravingFinder';
import type { FinderResponse } from '../components/EngravingFinder';
import { EngravingGrid } from '../components/EngravingGrid';
import { EngravingSlotEditor } from '../components/EngravingSlotEditor';
import { FilterStatus } from '../components/FilterStatus';
import { LoadingState } from '../components/LoadingState';
import { NoMatchState } from '../components/NoMatchState';
import { SearchField } from '../components/SearchField';

export function EngravingPage({
  onNavigate,
  initialCharacterQuery,
}: {
  onNavigate: Navigate;
  initialCharacterQuery?: string;
}) {
  const { state, loading, refresh } = useAppState();
  const [characterQuery, setCharacterQuery] = useState(
    initialCharacterQuery ?? '',
  );
  const [slotFilter, setSlotFilter] = useState<number | null>(null);
  const [editing, setEditing] = useState<{
    characterId: number;
    slot: number;
  } | null>(null);

  const [finderSlot, setFinderSlot] = useState<number | ''>('');
  const [finderGrade, setFinderGrade] = useState<EngravingGrade | ''>('');
  const [finderValueId, setFinderValueId] = useState<number | ''>('');
  const [finderResult, setFinderResult] = useState<FinderResponse | null>(
    null,
  );
  const [finderLoading, setFinderLoading] = useState(false);
  const [finderError, setFinderError] = useState<string | null>(null);
  const [finderNonce, setFinderNonce] = useState(0);

  useEffect(() => {
    if (initialCharacterQuery !== undefined) {
      setCharacterQuery(initialCharacterQuery);
    }
  }, [initialCharacterQuery]);

  useEffect(() => {
    if (finderSlot === '' || finderValueId === '') {
      setFinderResult(null);
      setFinderError(null);
      setFinderLoading(false);
      return;
    }

    let cancelled = false;
    setFinderLoading(true);
    setFinderError(null);

    api
      .getEngravingFinder(Number(finderSlot), Number(finderValueId))
      .then((result) => {
        if (!cancelled) setFinderResult(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setFinderResult(null);
          setFinderError(errorMessage(caught));
        }
      })
      .finally(() => {
        if (!cancelled) setFinderLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [finderSlot, finderValueId, finderNonce]);

  if (loading && !state) return <LoadingState />;
  if (!state) return null;

  if (state.characters.length === 0) {
    return (
      <EmptyState
        title="No characters yet"
        description="Add your characters first, then track their engraving here."
        actionLabel="Add characters"
        onAction={() => onNavigate('manage')}
      />
    );
  }

  const engraving = state.engraving;

  const selectedSlotFilter =
    slotFilter !== null &&
    engraving.slotDefinitions.some((slot) => slot.slot === slotFilter)
      ? slotFilter
      : null;

  const visibleCharacters = filterEngravingCharacters(
    state.characters,
    characterQuery,
  );
  const characterFilterActive = isFilterActive(characterQuery);
  const filterActive =
    characterFilterActive || selectedSlotFilter !== null;
  const filterMessages = filterActive
    ? [
        `Showing ${visibleCharacters.length} of ${state.characters.length} characters`,
      ]
    : [];

  const clearFilters = () => {
    setCharacterQuery('');
    setSlotFilter(null);
  };

  const categoriesWithoutValues = engraving.categories.filter(
    (category) => engraving.valueTables[category.key].length === 0,
  );

  const editingSlot = editing
    ? engraving.slots.find(
        (slot) =>
          slot.characterId === editing.characterId &&
          slot.slot === editing.slot,
      )
    : undefined;
  const editingCharacter = editing
    ? state.characters.find(
        (character) => character.id === editing.characterId,
      )
    : undefined;
  const editingDefinition = editing
    ? engraving.slotDefinitions.find((slot) => slot.slot === editing.slot)
    : undefined;
  const editingCategory = editingDefinition
    ? engraving.categories.find(
        (category) => category.key === editingDefinition.category,
      )
    : undefined;

  const rerunFinderAfterMutation = async () => {
    await refresh();
    setFinderNonce((value) => value + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engraving</h1>
        <p className="muted mt-1">
          Track each character&apos;s {engraving.slotCount} engraving slots.
          Engraving persists across weekly resets.
        </p>
      </div>

      <EngravingFinder
        slotDefinitions={engraving.slotDefinitions}
        categories={engraving.categories}
        valueTables={engraving.valueTables}
        grades={engraving.grades}
        slot={finderSlot}
        grade={finderGrade}
        valueId={finderValueId}
        onSlotChange={(next) => {
          setFinderSlot(next);
          setFinderValueId('');
        }}
        onGradeChange={(next) => {
          setFinderGrade(next);
          setFinderValueId('');
        }}
        onValueChange={setFinderValueId}
        result={finderResult}
        loading={finderLoading}
        error={finderError}
      />

      <section className="card flex flex-col gap-3 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <SearchField
            value={characterQuery}
            onChange={setCharacterQuery}
            placeholder="Search characters"
            label="Search characters"
          />
          <select
            className="input"
            value={selectedSlotFilter === null ? '' : String(selectedSlotFilter)}
            onChange={(event) =>
              setSlotFilter(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
            aria-label="Filter by slot"
          >
            <option value="">All slots</option>
            {engraving.slotDefinitions.map((definition) => (
              <option key={definition.slot} value={definition.slot}>
                {definition.slot}. {definition.label}
              </option>
            ))}
          </select>
        </div>

        <FilterStatus messages={filterMessages} onClear={clearFilters} />
      </section>

      {categoriesWithoutValues.length > 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          No values for{' '}
          {categoriesWithoutValues
            .map((category) => category.label)
            .join(', ')}
          . Add values in Manage to fill those slots.
        </p>
      )}

      {visibleCharacters.length === 0 ? (
        <NoMatchState
          message={
            characterFilterActive
              ? `No characters match “${characterQuery.trim()}”.`
              : 'No characters match the current filters.'
          }
          onAction={clearFilters}
        />
      ) : (
        <EngravingGrid
          characters={visibleCharacters}
          engraving={engraving}
          slotFilter={selectedSlotFilter}
          onEdit={(characterId, slot) => setEditing({ characterId, slot })}
        />
      )}

      {editing &&
        editingCharacter &&
        editingSlot &&
        editingDefinition &&
        editingCategory && (
          <EngravingSlotEditor
            open
            character={editingCharacter}
            slot={editingSlot}
            definition={editingDefinition}
            category={editingCategory}
            grades={engraving.grades}
            values={engraving.valueTables[editingDefinition.category]}
            onClose={() => setEditing(null)}
            onSave={async (input) => {
              await api.setEngravingSlot(input);
              await rerunFinderAfterMutation();
              setEditing(null);
            }}
            onClear={async () => {
              if (!editing) return;
              await api.clearEngravingSlot(editing.characterId, editing.slot);
              await rerunFinderAfterMutation();
              setEditing(null);
            }}
          />
        )}
    </div>
  );
}
