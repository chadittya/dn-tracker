import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type {
  CardGrade,
  CardsState,
  Character,
  CharacterCardEntry,
} from '../api/types';
import {
  buildCardOptions,
  filterCharacterCards,
  formatCardCount,
  sortCharacterCardEntries,
} from '../lib/cards';
import { isFilterActive } from '../lib/search';
import { CARD_GRADE_COLORS } from '../lib/engravingColors';
import { CardGradeBadge } from './CardGradeBadge';
import { ComboBox } from './ComboBox';
import { SearchField } from './SearchField';

function GradeButtons({
  value,
  onChange,
  disabled,
  label,
}: {
  value: CardGrade | null;
  onChange: (grade: CardGrade) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label={label}>
      {Object.entries(CARD_GRADE_COLORS).map(([key, colors]) => {
        const grade = key as CardGrade;
        const selected = value === grade;
        return (
          <button
            key={key}
            type="button"
            className={`btn ${
              selected ? colors.buttonSelectedClassName : colors.buttonClassName
            }`}
            aria-pressed={selected}
            onClick={() => onChange(grade)}
            disabled={disabled}
          >
            {colors.label}
          </button>
        );
      })}
    </div>
  );
}

export function CardCharacterPanel({
  character,
  cards,
  onClose,
  onChanged,
}: {
  character: Character;
  cards: CardsState;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [cardQuery, setCardQuery] = useState('');
  const [addCardId, setAddCardId] = useState<number | null>(null);
  const [addGrade, setAddGrade] = useState<CardGrade | null>(null);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editingGrade, setEditingGrade] = useState<CardGrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const ownedEntries = sortCharacterCardEntries(
    cards.entries.filter((entry) => entry.characterId === character.id),
  );
  const visibleEntries = filterCharacterCards(ownedEntries, cardQuery);
  const filterActive = isFilterActive(cardQuery);
  const ownedIds = new Set(ownedEntries.map((entry) => entry.cardId));
  const addOptions = buildCardOptions(cards.catalog, ownedIds);
  const editingEntry = ownedEntries.find(
    (entry) => entry.cardId === editingCardId,
  );
  const summary = cards.perCharacter.find(
    (item) => item.characterId === character.id,
  );

  useEffect(() => {
    if (
      addCardId !== null &&
      !cards.catalog.some((card) => card.id === addCardId)
    ) {
      setAddCardId(null);
    }
  }, [addCardId, cards.catalog]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const startEditing = (entry: CharacterCardEntry) => {
    if (busy) return;
    setEditingCardId(entry.cardId);
    setEditingGrade(entry.grade);
    setNote(null);
    setError(null);
  };

  const saveGrade = async () => {
    if (editingCardId === null || editingGrade === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.setCharacterCard({
        characterId: character.id,
        cardId: editingCardId,
        grade: editingGrade,
      });
      await onChanged();
      setNote(null);
      setEditingCardId(null);
      setEditingGrade(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const removeCard = async (entry: CharacterCardEntry) => {
    setBusy(true);
    setError(null);
    try {
      await api.removeCharacterCard(character.id, entry.cardId);
      await onChanged();
      setNote(`Removed ${entry.cardName} from ${character.name}`);
      setEditingCardId(null);
      setEditingGrade(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const addCard = async () => {
    if (addCardId === null || addGrade === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.setCharacterCard({
        characterId: character.id,
        cardId: addCardId,
        grade: addGrade,
      });
      await onChanged();
      setNote(null);
      setAddCardId(null);
      setAddGrade(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-stretch sm:justify-end sm:p-0"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-panel-title"
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-5 shadow-2xl sm:max-h-none sm:h-full sm:rounded-none sm:border-y-0 sm:border-r-0"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="card-panel-title" className="text-lg font-semibold">
              {character.name}
            </h2>
            <p className="muted mt-1 text-sm">
              {formatCardCount(summary?.count ?? 0, summary?.total ?? 0)}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost -mt-2 -mr-2 min-h-10 px-3 text-xl"
            onClick={onClose}
            disabled={busy}
            aria-label="Close card panel"
          >
            ×
          </button>
        </div>

        {note && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            {note}
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4">
          <SearchField
            value={cardQuery}
            onChange={setCardQuery}
            placeholder="Search this character's cards"
            label="Search this character's cards"
          />
          {filterActive && (
            <p className="muted mt-1 text-sm">
              {visibleEntries.length} of {ownedEntries.length} cards
            </p>
          )}
        </div>

        {ownedEntries.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            No cards yet for {character.name}.
          </p>
        ) : visibleEntries.length === 0 ? (
          <p className="muted mt-3 text-sm">
            No cards match “{cardQuery.trim()}”.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
            {visibleEntries.map((entry) => (
              <li key={entry.cardId} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="min-h-10 flex-1 text-left font-medium"
                    onClick={() => startEditing(entry)}
                    disabled={busy}
                  >
                    {entry.cardName}
                  </button>
                  <span className="flex items-center gap-2">
                    <CardGradeBadge grade={entry.grade} />
                    <button
                      type="button"
                      className="btn min-h-9 px-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      onClick={() => void removeCard(entry)}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </span>
                </div>

                {editingEntry?.cardId === entry.cardId && (
                  <div className="mt-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <span className="text-sm font-medium">Change grade</span>
                    <GradeButtons
                      value={editingGrade}
                      onChange={setEditingGrade}
                      disabled={busy}
                      label={`Change grade for ${entry.cardName}`}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary min-h-9 px-3"
                        onClick={() => {
                          setEditingCardId(null);
                          setEditingGrade(null);
                        }}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary min-h-9 px-3"
                        onClick={() => void saveGrade()}
                        disabled={
                          busy ||
                          editingGrade === null ||
                          editingGrade === entry.grade
                        }
                      >
                        {busy ? 'Saving…' : 'Save grade'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Add a card</h3>
          {cards.catalog.length === 0 ? (
            <p className="muted mt-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm dark:border-slate-700">
              No cards in the catalog yet. Add cards in Manage.
            </p>
          ) : addOptions.length === 0 ? (
            <p className="muted mt-2 text-sm">
              {character.name} already has every card in the catalog.
            </p>
          ) : (
            <>
              <ComboBox
                label={`Add a card to ${character.name}`}
                placeholder="Search cards"
                options={addOptions}
                value={addCardId}
                onChange={setAddCardId}
                emptyText="No matching cards."
                disabled={busy}
                className="mt-2"
              />
              <div className="mt-3">
                <span className="text-sm font-medium">Grade</span>
                <GradeButtons
                  value={addGrade}
                  onChange={setAddGrade}
                  disabled={busy}
                  label="New card grade"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void addCard()}
                  disabled={busy || addCardId === null || addGrade === null}
                >
                  {busy ? 'Saving…' : 'Add card'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
