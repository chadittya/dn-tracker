import { api } from '../api/client';
import { EntitySection } from '../components/EntitySection';
import { LoadingState } from '../components/LoadingState';
import { useAppState } from '../state/context';

export function ManagePage() {
  const { state, loading, refresh } = useAppState();

  if (loading && !state) return <LoadingState />;
  if (!state) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manage</h1>
        <p className="muted mt-1">
          Characters and nests have a name only. Every character is tracked on
          every nest.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EntitySection
          title="Characters"
          description="Add each character you play."
          itemLabel="character"
          items={state.characters}
          placeholder="e.g. Raven"
          addLabel="Add character"
          emptyText="No characters yet."
          deleteWarning={(name) =>
            `All recorded runs for ${name} across all weeks will also be deleted. This cannot be undone.`
          }
          onAdd={async (name) => {
            await api.createCharacter(name);
            await refresh();
          }}
          onRename={async (id, name) => {
            await api.renameCharacter(id, name);
            await refresh();
          }}
          onDelete={async (id) => {
            await api.deleteCharacter(id);
            await refresh();
          }}
        />

        <EntitySection
          title="Nests"
          description="Add the nests you run each week."
          itemLabel="nest"
          items={state.nests}
          placeholder="e.g. Abyss"
          addLabel="Add nest"
          emptyText="No nests yet."
          deleteWarning={(name) =>
            `All recorded runs on ${name} across all weeks will also be deleted. This cannot be undone.`
          }
          onAdd={async (name) => {
            await api.createNest(name);
            await refresh();
          }}
          onRename={async (id, name) => {
            await api.renameNest(id, name);
            await refresh();
          }}
          onDelete={async (id) => {
            await api.deleteNest(id);
            await refresh();
          }}
        />
      </div>
    </div>
  );
}
