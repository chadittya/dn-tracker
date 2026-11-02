import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import type {
  CardBulkImportResult,
  CardCatalogEntry,
  CardUsageResponse,
} from '../api/types';
import {
  filterCards,
  formatCardImportSummary,
  sortCardsAZ,
} from '../lib/cards';
import { analyzeAddName } from '../lib/names';
import { paginate } from '../lib/pagination';
import {
  isFilterActive,
  matchesName,
} from '../lib/search';
import { ConfirmDialog } from './ConfirmDialog';
import { FilterStatus } from './FilterStatus';
import { NoMatchState } from './NoMatchState';
import { Pagination } from './Pagination';
import { SearchField } from './SearchField';

interface DeleteTarget {
  card: CardCatalogEntry;
  affectedCount: number;
}

function deleteMessage(target: DeleteTarget): string {
  const { card, affectedCount } = target;
  if (affectedCount === 0) {
    return `No characters have ${card.name}. This cannot be undone.`;
  }
  if (affectedCount === 1) {
    return `1 character has this card and it will be removed from them. This cannot be undone.`;
  }
  return `${affectedCount} characters have this card and it will be removed from them. This cannot be undone.`;
}

export function CardsSection({
  items,
  onAdd,
  onRename,
  onDelete,
  getUsage,
  onBulkImport,
}: {
  items: CardCatalogEntry[];
  onAdd: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  getUsage: (id: number) => Promise<CardUsageResponse>;
  onBulkImport: (text: string) => Promise<CardBulkImportResult>;
}) {
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addStatusNote, setAddStatusNote] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLookupId, setDeleteLookupId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  const searchActive = isFilterActive(searchQuery);
  const sortedItems = sortCardsAZ(items);
  const filteredItems = filterCards(sortedItems, searchQuery);
  const paged = paginate(filteredItems, page);
  const addAnalysis = analyzeAddName(items, newName);
  const visibleMatches = addAnalysis.matches.slice(0, 5);
  const hiddenMatches = addAnalysis.matches.length - visibleMatches.length;

  useEffect(() => {
    if (page !== paged.page) setPage(paged.page);
  }, [page, paged.page]);

  const changeSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    setAddStatusNote(null);
  };

  const submitAdd = async (event: FormEvent) => {
    event.preventDefault();
    setAddStatusNote(null);
    const name = newName.trim();
    if (!name) {
      setAddError('Name must not be empty.');
      return;
    }

    const duplicate = analyzeAddName(items, name).exactMatch;
    if (duplicate) {
      setAddError(
        `“${duplicate.name}” already exists. Names are unique (case-insensitive).`,
      );
      return;
    }

    const hiddenBySearch =
      isFilterActive(searchQuery) && !matchesName(name, searchQuery);

    setAddBusy(true);
    setAddError(null);
    try {
      await onAdd(name);
      setNewName('');
      setPage(1);
      setAddStatusNote(
        hiddenBySearch
          ? `Added “${name}”. It does not match the current search, so it is hidden.`
          : null,
      );
    } catch (caught) {
      setAddError(errorMessage(caught));
    } finally {
      setAddBusy(false);
    }
  };

  const startEditing = (card: CardCatalogEntry) => {
    setEditingId(card.id);
    setEditName(card.name);
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditError(null);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (editingId === null) return;

    const name = editName.trim();
    if (!name) {
      setEditError('Name must not be empty.');
      return;
    }

    setEditBusy(true);
    setEditError(null);
    try {
      await onRename(editingId, name);
      cancelEditing();
    } catch (caught) {
      setEditError(errorMessage(caught));
    } finally {
      setEditBusy(false);
    }
  };

  const requestDelete = async (card: CardCatalogEntry) => {
    setDeleteError(null);
    setDeleteLookupId(card.id);
    try {
      const usage = await getUsage(card.id);
      setDeleteTarget({ card, affectedCount: usage.affectedCount });
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeleteLookupId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDelete(deleteTarget.card.id);
      if (editingId === deleteTarget.card.id) cancelEditing();
      setDeleteTarget(null);
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeleteBusy(false);
    }
  };

  const submitBulkImport = async (event: FormEvent) => {
    event.preventDefault();
    if (bulkText.trim() === '') return;

    setBulkBusy(true);
    setBulkError(null);
    setBulkSummary(null);
    try {
      const result = await onBulkImport(bulkText);
      setBulkSummary(formatCardImportSummary(result));
      setPage(1);
      if (result.invalid === 0) setBulkText('');
    } catch (caught) {
      setBulkError(errorMessage(caught));
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <div>
        <h2 className="section-title">Cards</h2>
        <p className="muted mt-1">
          Add the cards characters can collect. Cards are sorted A to Z.
        </p>
      </div>

      <form onSubmit={submitAdd} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="input"
          value={newName}
          onChange={(event) => {
            setNewName(event.target.value);
            if (addError) setAddError(null);
            if (addStatusNote) setAddStatusNote(null);
          }}
          placeholder="e.g. Red Dragon"
          maxLength={50}
          aria-label="New card name"
        />
        <button
          type="submit"
          className="btn btn-primary shrink-0"
          disabled={addBusy || addAnalysis.exactMatch !== undefined}
        >
          {addBusy ? 'Adding…' : 'Add card'}
        </button>
      </form>

      {addAnalysis.exactMatch ? (
        <p
          className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300"
          role="status"
          aria-live="polite"
        >
          “{addAnalysis.exactMatch.name}” already exists. Names are unique
          (case-insensitive).
        </p>
      ) : addAnalysis.matches.length > 0 ? (
        <p className="muted mt-2" role="status" aria-live="polite">
          Existing matches:{' '}
          {visibleMatches.map((card) => card.name).join(', ')}
          {hiddenMatches > 0 ? ` +${hiddenMatches} more` : ''}
        </p>
      ) : null}

      {addError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {addError}
        </p>
      )}

      {addStatusNote && (
        <p className="muted mt-2" role="status" aria-live="polite">
          {addStatusNote}
        </p>
      )}

      {deleteError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {deleteError}
        </p>
      )}

      <div className="mt-5">
        {items.length === 0 ? (
          <p className="muted rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
            No cards yet.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <SearchField
                value={searchQuery}
                onChange={changeSearch}
                placeholder="Search cards"
                label="Search cards"
              />
              <FilterStatus
                messages={
                  searchActive
                    ? [
                        `Filtered to ${filteredItems.length} of ${items.length} cards`,
                      ]
                    : []
                }
                onClear={() => changeSearch('')}
              />
            </div>

            <div className="mt-3">
              {searchActive && filteredItems.length === 0 ? (
                <NoMatchState
                  message={`No cards match “${searchQuery.trim()}”.`}
                  actionLabel="Clear search"
                  onAction={() => changeSearch('')}
                />
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paged.items.map((card) => (
                    <li key={card.id} className="py-2">
                      {editingId === card.id ? (
                        <form
                          onSubmit={submitEdit}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center"
                        >
                          <input
                            className="input"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            maxLength={50}
                            aria-label={`Rename ${card.name}`}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="btn btn-primary shrink-0"
                              disabled={editBusy}
                            >
                              {editBusy ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary shrink-0"
                              onClick={cancelEditing}
                              disabled={editBusy}
                            >
                              Cancel
                            </button>
                          </div>
                          {editError && (
                            <p
                              className="text-sm text-rose-600 dark:text-rose-400 sm:w-full"
                              role="alert"
                            >
                              {editError}
                            </p>
                          )}
                        </form>
                      ) : (
                        <div className="flex min-h-12 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {card.name}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost min-h-10 px-3"
                            onClick={() => startEditing(card)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="btn min-h-10 px-3 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            onClick={() => void requestDelete(card)}
                            disabled={deleteLookupId !== null}
                          >
                            {deleteLookupId === card.id ? 'Checking…' : 'Remove'}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Pagination
              summary={paged}
              itemPlural="cards"
              label="Cards"
              onPrevious={() => setPage(paged.page - 1)}
              onNext={() => setPage(paged.page + 1)}
            />
          </>
        )}
      </div>

      <form
        onSubmit={submitBulkImport}
        className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800"
      >
        <h3 className="text-sm font-semibold">Bulk import</h3>
        <p className="muted mt-1">
          Paste card names, one per line. Empty lines are ignored. Names over
          50 characters are not added.
        </p>
        <textarea
          className="input mt-2 min-h-28"
          value={bulkText}
          onChange={(event) => {
            setBulkText(event.target.value);
            if (bulkError) setBulkError(null);
          }}
          aria-label="Card names to import"
          placeholder={'Red Dragon\nBlue Dragon'}
          disabled={bulkBusy}
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={bulkBusy || bulkText.trim() === ''}
          >
            {bulkBusy ? 'Importing…' : 'Import cards'}
          </button>
        </div>
        {bulkError && (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
            {bulkError}
          </p>
        )}
        {bulkSummary && (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300" role="status">
            {bulkSummary}
          </p>
        )}
      </form>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Remove ${deleteTarget?.card.name ?? ''}?`}
        message={deleteTarget ? deleteMessage(deleteTarget) : ''}
        confirmLabel="Remove"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
