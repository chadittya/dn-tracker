import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { ConfirmDialog } from './ConfirmDialog';

export interface Entity {
  id: number;
  name: string;
}

export function EntitySection({
  title,
  description,
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

  const submitAdd = async (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setAddError('Name must not be empty.');
      return;
    }

    setAddBusy(true);
    setAddError(null);
    try {
      await onAdd(name);
      setNewName('');
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
          onChange={(event) => setNewName(event.target.value)}
          placeholder={placeholder}
          maxLength={50}
          aria-label={`New ${title.toLowerCase()} name`}
        />
        <button
          type="submit"
          className="btn btn-primary shrink-0"
          disabled={addBusy}
        >
          {addBusy ? 'Adding…' : addLabel}
        </button>
      </form>
      {addError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {addError}
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
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((item) => (
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
