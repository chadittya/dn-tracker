import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { analyzeAddName } from '../lib/names';
import { addedNote } from '../lib/notes';
import { sortEntitiesForManage } from '../lib/ordering';
import { paginate } from '../lib/pagination';
import {
  filterByName,
  isFilterActive,
  matchesName,
} from '../lib/search';
import { ConfirmDialog } from './ConfirmDialog';
import { FilterStatus } from './FilterStatus';
import { NoMatchState } from './NoMatchState';
import { Pagination } from './Pagination';
import { SearchField } from './SearchField';

export interface Entity {
  id: number;
  name: string;
  createdAt: string;
}

function pluralized(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}

export function EntitySection({
  title,
  description,
  itemLabel,
  items,
  placeholder,
  addLabel,
  emptyText,
  deleteWarning,
  onAdd,
  onRename,
  onDelete,
}: {
  title: string;
  description: string;
  itemLabel: string;
  items: Entity[];
  placeholder: string;
  addLabel: string;
  emptyText: string;
  deleteWarning: (name: string) => string;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef(searchQuery);
  const [page, setPage] = useState(1);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const searchActive = isFilterActive(searchQuery);
  const sortedItems = sortEntitiesForManage(items);
  const filteredItems = filterByName(sortedItems, searchQuery);
  const paged = paginate(filteredItems, page);
  const itemPlural = `${itemLabel}s`;
  const itemLabelForCount = pluralized(itemLabel, items.length);
  const addAnalysis = analyzeAddName(items, newName);
  const visibleMatches = addAnalysis.matches.slice(0, 5);
  const hiddenMatches = addAnalysis.matches.length - visibleMatches.length;

  useEffect(() => {
    if (page !== paged.page) setPage(paged.page);
  }, [page, paged.page]);

  const changeSearch = (value: string) => {
    searchQueryRef.current = value;
    setSearchQuery(value);
    setPage(1);
    setStatusNote(null);
  };

  const submitAdd = async (event: FormEvent) => {
    event.preventDefault();
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

    setAddBusy(true);
    setAddError(null);
    try {
      await onAdd(name);
      const query = searchQueryRef.current;
      const hiddenBySearch = isFilterActive(query) && !matchesName(name, query);
      setNewName('');
      setPage(1);
      setStatusNote(addedNote(name, hiddenBySearch));
    } catch (caught) {
      setAddError(errorMessage(caught));
    } finally {
      setAddBusy(false);
    }
  };

  const startEditing = (item: Entity) => {
    setEditingId(item.id);
    setEditName(item.name);
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
      setStatusNote(null);
      cancelEditing();
    } catch (caught) {
      setEditError(errorMessage(caught));
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDelete(deleteTarget.id);
      setStatusNote(null);
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) cancelEditing();
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="muted mt-1">{description}</p>
      </div>

      <form onSubmit={submitAdd} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="input"
          value={newName}
          onChange={(event) => {
            setNewName(event.target.value);
            if (addError) setAddError(null);
          }}
          placeholder={placeholder}
          maxLength={50}
          aria-label={`New ${itemLabel} name`}
        />
        <button
          type="submit"
          className="btn btn-primary shrink-0"
          disabled={addBusy || addAnalysis.exactMatch !== undefined}
        >
          {addBusy ? 'Adding…' : addLabel}
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
          {visibleMatches.map((item) => item.name).join(', ')}
          {hiddenMatches > 0 ? ` +${hiddenMatches} more` : ''}
        </p>
      ) : null}

      {addError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {addError}
        </p>
      )}

      {statusNote && (
        <p className="muted mt-2" role="status" aria-live="polite">
          {statusNote}
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
            {emptyText}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <SearchField
                value={searchQuery}
                onChange={changeSearch}
                placeholder={`Search ${itemPlural}`}
                label={`Search ${itemPlural}`}
              />
              <FilterStatus
                messages={
                  searchActive
                    ? [
                        `Filtered to ${filteredItems.length} of ${items.length} ${itemLabelForCount}`,
                      ]
                    : []
                }
                onClear={() => changeSearch('')}
              />
            </div>

            <div className="mt-3">
              {searchActive && filteredItems.length === 0 ? (
                <NoMatchState
                  message={`No ${itemPlural} match “${searchQuery.trim()}”.`}
                  actionLabel="Clear search"
                  onAction={() => changeSearch('')}
                />
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paged.items.map((item) => (
                    <li key={item.id} className="py-2">
                      {editingId === item.id ? (
                        <form
                          onSubmit={submitEdit}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center"
                        >
                          <input
                            className="input"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            maxLength={50}
                            aria-label={`Rename ${item.name}`}
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
                            {item.name}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost min-h-10 px-3"
                            onClick={() => startEditing(item)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="btn min-h-10 px-3 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(item);
                            }}
                          >
                            Remove
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
              itemPlural={itemPlural}
              label={title}
              onPrevious={() => setPage(paged.page - 1)}
              onNext={() => setPage(paged.page + 1)}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Remove ${deleteTarget?.name ?? ''}?`}
        message={
          deleteTarget ? deleteWarning(deleteTarget.name) : ''
        }
        confirmLabel="Remove"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
