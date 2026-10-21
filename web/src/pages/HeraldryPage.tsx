import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Navigate } from '../lib/navigation';
import {
  filterHeraldryCharacters,
  type HeraldryStatusFilter,
} from '../lib/heraldry';
import { isFilterActive } from '../lib/search';
import { useAppState } from '../state/context';
import { EmptyState } from '../components/EmptyState';
import { FilterStatus } from '../components/FilterStatus';
import { HeraldryGrid } from '../components/HeraldryGrid';
import { HeraldrySlotEditor } from '../components/HeraldrySlotEditor';
import { LoadingState } from '../components/LoadingState';
import { NoMatchState } from '../components/NoMatchState';
import { SearchField } from '../components/SearchField';

const STATUS_OPTIONS: ReadonlyArray<{
  value: HeraldryStatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'needs-upgrade', label: 'Needs upgrade' },
  { value: 'recommended', label: 'Recommended' },
];

export function HeraldryPage({
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
  const [plateFilter, setPlateFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<HeraldryStatusFilter>('all');
  const [editing, setEditing] = useState<{
    characterId: number;
    slot: number;
  } | null>(null);

  useEffect(() => {
    if (initialCharacterQuery !== undefined) {
      setCharacterQuery(initialCharacterQuery);
    }
  }, [initialCharacterQuery]);

  useEffect(() => {
    if (
      state &&
      plateFilter !== null &&
      !state.heraldry.plates.some((plate) => plate.id === plateFilter)
    ) {
      setPlateFilter(null);
    }
  }, [state, plateFilter]);

  if (loading && !state) return <LoadingState />;
  if (!state) return null;

  if (state.characters.length === 0) {
    return (
      <EmptyState
        title="No characters yet"
        description="Add your characters first, then track their heraldry plates here."
        actionLabel="Add characters"
        onAction={() => onNavigate('manage')}
      />
    );
  }

  const heraldry = state.heraldry;

  if (heraldry.levels.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Heraldry</h1>
          <p className="muted mt-1">
            Track each character&apos;s {heraldry.slotCount} plates. Heraldry
            persists across weekly resets.
          </p>
        </div>
        <section className="card flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">Set the cap in Manage first</h2>
          <p className="muted max-w-md">
            Add at least one plate level in Manage, then come back to fill the{' '}
            {heraldry.slotCount} heraldry slots for each character.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-2"
            onClick={() => onNavigate('manage')}
          >
            Go to Manage
          </button>
        </section>
      </div>
    );
  }

  const selectedPlateId =
    plateFilter !== null &&
    heraldry.plates.some((plate) => plate.id === plateFilter)
      ? plateFilter
      : null;

  const visibleCharacters = filterHeraldryCharacters(
    state.characters,
    heraldry.slots,
    characterQuery,
    selectedPlateId,
    statusFilter,
  );

  const characterFilterActive = isFilterActive(characterQuery);
  const filterActive =
    characterFilterActive || selectedPlateId !== null || statusFilter !== 'all';
  const filterMessages = filterActive
    ? [
        `Showing ${visibleCharacters.length} of ${state.characters.length} characters`,
      ]
    : [];

  const clearFilters = () => {
    setCharacterQuery('');
    setPlateFilter(null);
    setStatusFilter('all');
  };

  const editingCharacter = editing
    ? state.characters.find(
        (character) => character.id === editing.characterId,
      )
    : undefined;
  const editingSlot = editing
    ? heraldry.slots.find(
        (slot) =>
          slot.characterId === editing.characterId &&
          slot.slot === editing.slot,
      )
    : undefined;

  const usedPlateIds = new Set<number>();
  if (editing) {
    for (const slot of heraldry.slots) {
      if (
        slot.characterId === editing.characterId &&
        slot.slot !== editing.slot &&
        slot.plateId !== null
      ) {
        usedPlateIds.add(slot.plateId);
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Heraldry</h1>
        <p className="muted mt-1">
          Track each character&apos;s {heraldry.slotCount} plates. Heraldry
          persists across weekly resets.
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
          <select
            className="input"
            value={selectedPlateId === null ? '' : String(selectedPlateId)}
            onChange={(event) =>
              setPlateFilter(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
            aria-label="Filter by plate"
          >
            <option value="">All plates</option>
            {heraldry.plates.map((plate) => (
              <option key={plate.id} value={plate.id}>
                {plate.name}
              </option>
            ))}
          </select>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chip ${
                statusFilter === option.value ? 'chip-active' : 'chip-inactive'
              }`}
              aria-pressed={statusFilter === option.value}
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <FilterStatus messages={filterMessages} onClear={clearFilters} />
      </section>

      {heraldry.plates.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Add plates in Manage to fill slots. Empty slots count as Needs
          upgrade.
        </p>
      )}

      {visibleCharacters.length === 0 ? (
        <NoMatchState
          message={
            characterFilterActive
              ? `No characters match “${characterQuery.trim()}”.`
              : 'No characters match the selected plate and status filters.'
          }
          onAction={clearFilters}
        />
      ) : (
        <HeraldryGrid
          characters={visibleCharacters}
          heraldry={heraldry}
          onEdit={(characterId, slot) => setEditing({ characterId, slot })}
        />
      )}

      {editing && editingCharacter && editingSlot && (
        <HeraldrySlotEditor
          open
          character={editingCharacter}
          slot={editingSlot}
          plateOptions={heraldry.plates}
          levels={heraldry.levels}
          cap={heraldry.cap}
          slotCount={heraldry.slotCount}
          usedPlateIds={usedPlateIds}
          characters={state.characters}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await api.setHeraldrySlot(input);
            await refresh();
            setEditing(null);
          }}
          onClear={async () => {
            if (!editing) return;
            await api.clearHeraldrySlot(editing.characterId, editing.slot);
            await refresh();
            setEditing(null);
          }}
          onCopy={async (sourceCharacterId) => {
            if (!editing) return;
            await api.copyHeraldry(sourceCharacterId, editing.characterId);
            await refresh();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
