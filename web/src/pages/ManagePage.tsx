import { api } from '../api/client';
import { CardsSection } from '../components/CardsSection';
import { EngravingValuesSection } from '../components/EngravingValuesSection';
import { EntitySection } from '../components/EntitySection';
import { LoadingState } from '../components/LoadingState';
import { PlateLevelSection } from '../components/PlateLevelSection';
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
          every nest. Plate levels and plates are used by the Heraldry tab.
          Engraving value tables are used by the Engraving tab. Cards are used
          by the Cards tab.
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
            `All recorded runs for ${name} across all weeks, all heraldry slots for ${name}, all engraving slots for ${name}, and all cards for ${name} will also be deleted. This cannot be undone.`
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

      <div className="grid gap-4 lg:grid-cols-2">
        <PlateLevelSection
          levels={state.heraldry.levels}
          cap={state.heraldry.cap}
          onAdd={async (value) => {
            await api.addHeraldryLevel(value);
            await refresh();
          }}
          onDelete={async (value) => {
            await api.deleteHeraldryLevel(value);
            await refresh();
          }}
        />

        <EntitySection
          title="Plates"
          description="Add the heraldry plates you use. A character cannot use the same plate twice."
          itemLabel="plate"
          items={state.heraldry.plates}
          placeholder="e.g. Bear"
          addLabel="Add plate"
          emptyText="No plates yet."
          deleteWarning={(name) => {
            const count = state.heraldry.slots.filter(
              (slot) => slot.plateName === name,
            ).length;
            return count === 0
              ? `No heraldry slots use ${name}. This cannot be undone.`
              : `${name} is used by ${count} heraldry slot${
                  count === 1 ? '' : 's'
                }. Those slots will become empty. This cannot be undone.`;
          }}
          onAdd={async (name) => {
            await api.createHeraldryPlate(name);
            await refresh();
          }}
          onRename={async (id, name) => {
            await api.renameHeraldryPlate(id, name);
            await refresh();
          }}
          onDelete={async (id) => {
            await api.deleteHeraldryPlate(id);
            await refresh();
          }}
        />
      </div>

      <EngravingValuesSection
        categories={state.engraving.categories}
        grades={state.engraving.grades}
        valueTables={state.engraving.valueTables}
        onAdd={async (input) => {
          await api.createEngravingValue(input);
          await refresh();
        }}
        onUpdate={async (id, input) => {
          await api.updateEngravingValue(id, input);
          await refresh();
        }}
        onDelete={async (id) => {
          await api.deleteEngravingValue(id);
          await refresh();
        }}
      />

      <CardsSection
        items={state.cards.catalog}
        getUsage={(id) => api.getCardUsage(id)}
        onAdd={async (name) => {
          await api.createCard(name);
          await refresh();
        }}
        onRename={async (id, name) => {
          await api.renameCard(id, name);
          await refresh();
        }}
        onDelete={async (id) => {
          await api.deleteCard(id);
          await refresh();
        }}
        onBulkImport={async (text) => {
          const result = await api.importCards(text);
          await refresh();
          return result;
        }}
      />
    </div>
  );
}
