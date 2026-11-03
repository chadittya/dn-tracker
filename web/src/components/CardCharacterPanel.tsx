import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type {
  CardGrade,
  CardsState,
  Character,
  CharacterCardEntry,
} from '../api/types';
import {
  buildCardOptions,
  buildCharacterCardList,
  formatCardCount,
  formatCharacterCardImportSummary,
} from '../lib/cards';
import { isFilterActive, matchesName } from '../lib/search';
import { CARD_GRADE_COLORS } from '../lib/engravingColors';
import {
  addedNote,
  changedCardGradeNote,
  removedCardNote,
} from '../lib/notes';
import { CardGradeBadge } from './CardGradeBadge';
import { ComboBox } from './ComboBox';
import { Pagination } from './Pagination';
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
  const cardQueryRef = useRef(cardQuery);
  const [cardPage, setCardPage] = useState(1);
  const [addCardId, setAddCardId] = useState<number | null>(null);
  const [addGrade, setAddGrade] = useState<CardGrade | null>(null);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editingGrade, setEditingGrade] = useState<CardGrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const {
    owned: ownedEntries,
    filtered: visibleEntries,
    paged,
  } = buildCharacterCardList(
    cards.entries,
    character.id,
    cardQuery,
    cardPage,
  );
  const filterActive = isFilterActive(cardQuery);
  const ownedIds = new Set(ownedEntries.map((entry) => entry.cardId));
  const addOptions = buildCardOptions(cards.catalog, ownedIds);
  const editingEntry = ownedEntries.find(
    (entry) => entry.cardId === editingCardId,
  );
  const summary = cards.perCharacter.find(
    (item) => item.characterId === character.id,
  );
  const importHasText = importOpen && importText.trim() !== '';

  const gradeLabel = (grade: CardGrade): string =>
    cards.grades.find((item) => item.key === grade)?.label ?? grade;

  useEffect(() => {
    if (cardPage !== paged.page) setCardPage(paged.page);
  }, [cardPage, paged.page]);

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
      if (event.key === 'Escape' && !busy && !importHasText) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, importHasText, onClose]);

  const changeCardSearch = (value: string) => {
    cardQueryRef.current = value;
    setCardQuery(value);
    setCardPage(1);
    setNote(null);
  };

  const resetImport = () => {
    setImportOpen(false);
    setImportText('');
    setImportError(null);
  };

  const toggleImport = () => {
    if (importOpen) {
      resetImport();
      return;
    }
    setImportError(null);
    setImportOpen(true);
  };

  const startEditing = (entry: CharacterCardEntry) => {
    if (busy) return;
    setEditingCardId(entry.cardId);
    setEditingGrade(entry.grade);
    setError(null);
  };

  const saveGrade = async () => {
    if (editingCardId === null || editingGrade === null || !editingEntry) {
      return;
    }
    const cardName = editingEntry.cardName;
    const grade = editingGrade;
    setBusy(true);
    setError(null);
    try {
      await api.setCharacterCard({
        characterId: character.id,
        cardId: editingCardId,
        grade,
      });
      await onChanged();
      setNote(changedCardGradeNote(cardName, gradeLabel(grade)));
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
      setNote(removedCardNote(entry.cardName, character.name));
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
      const response = await api.setCharacterCard({
        characterId: character.id,
        cardId: addCardId,
        grade: addGrade,
      });
      const query = cardQueryRef.current;
      const hiddenBySearch =
        isFilterActive(query) &&
        !matchesName(response.entry.cardName, query);
      await onChanged();
      setNote(addedNote(response.entry.cardName, hiddenBySearch));
      setCardPage(1);
      setAddCardId(null);
      setAddGrade(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const importCards = async () => {
    if (importText.trim() === '') return;
    setBusy(true);
    setImportError(null);
    try {
      const result = await api.importCharacterCards(
        character.id,
        importText,
      );
      await onChanged();
      setNote(formatCharacterCardImportSummary(result));
      setCardPage(1);
      if (result.invalid === 0) {
        resetImport();
      } else {
        setImportText(result.invalidLines.join('\n'));
        setImportError(null);
      }
    } catch (caught) {
      setImportError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-stretch sm:justify-end sm:p-0"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !busy &&
          !importHasText
        ) {
          onClose();
        }
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
            disabled={busy || importHasText}
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

        <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Add a card</h3>
          {cards.catalog.length === 0 ? (
            <p className="muted mt-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm dark:border-slate-700">
              No cards in the catalog yet. Add cards in Manage.
            </p>
          ) : (
            <>
              {addOptions.length === 0 ? (
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
                </>
              )}

              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={toggleImport}
                  disabled={busy}
                  aria-expanded={importOpen}
                  aria-controls="card-import-form"
                >
                  Import cards
                </button>
                {addOptions.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void addCard()}
                    disabled={busy || addCardId === null || addGrade === null}
                  >
                    {busy ? 'Saving…' : 'Add card'}
                  </button>
                )}
              </div>

              {importOpen && (
                <div
                  id="card-import-form"
                  className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <label
                    htmlFor="card-import-text"
                    className="text-sm font-medium"
                  >
                    One card per line: Card name, Grade
                  </label>
                  <textarea
                    id="card-import-text"
                    className="input mt-2 min-h-28 w-full"
                    value={importText}
                    onChange={(event) => {
                      setImportText(event.target.value);
                      if (importError) setImportError(null);
                    }}
                    placeholder={'Red Dragon, Epic\nBlue Dragon, Rare'}
                    disabled={busy}
                  />
                  {importError && (
                    <p
                      className="mt-2 text-sm text-rose-600 dark:text-rose-400"
                      role="alert"
                    >
                      {importError}
                    </p>
                  )}
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={resetImport}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void importCards()}
                      disabled={busy || importText.trim() === ''}
                    >
                      {busy ? 'Importing…' : 'Import'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <SearchField
            value={cardQuery}
            onChange={changeCardSearch}
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
          <>
            <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
              {paged.items.map((entry) => (
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

            <Pagination
              summary={paged}
              itemPlural="cards"
              label={`${character.name} cards`}
              onPrevious={() => setCardPage(paged.page - 1)}
              onNext={() => setCardPage(paged.page + 1)}
            />
          </>
        )}
      </div>
    </div>
  );
}
