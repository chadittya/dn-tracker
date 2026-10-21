import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiRequestError, errorMessage } from '../api/client';
import type { HeraldryAffectedSlot } from '../api/types';
import { ConfirmDialog } from './ConfirmDialog';

export function PlateLevelSection({
  levels,
  cap,
  onAdd,
  onDelete,
}: {
  levels: number[];
  cap: number | null;
  onAdd: (value: number) => Promise<void>;
  onDelete: (value: number) => Promise<void>;
}) {
  const [newValue, setNewValue] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [rankShiftNote, setRankShiftNote] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [affectedSlots, setAffectedSlots] = useState<HeraldryAffectedSlot[]>(
    [],
  );
  const [affectedCount, setAffectedCount] = useState(0);

  const parsed = Number(newValue);
  const exactDuplicate =
    newValue.trim() !== '' &&
    Number.isInteger(parsed) &&
    levels.includes(parsed);

  const submitAdd = async (event: FormEvent) => {
    event.preventDefault();

    if (!Number.isInteger(parsed) || parsed <= 0) {
      setAddError('Enter a whole number greater than 0.');
      return;
    }
    if (levels.includes(parsed)) {
      setAddError(`Level ${parsed} already exists.`);
      return;
    }

    const previousCap = cap;
    setAddBusy(true);
    setAddError(null);
    try {
      await onAdd(parsed);
      setNewValue('');
      if (previousCap !== null && parsed < previousCap) {
        setRankShiftNote(
          `Level ${parsed} was added below the cap (${previousCap}). Ranks shifted and all slot statuses were recalculated.`,
        );
      } else {
        setRankShiftNote(null);
      }
    } catch (caught) {
      setAddError(errorMessage(caught));
    } finally {
      setAddBusy(false);
    }
  };

  const openDelete = (value: number) => {
    setDeleteTarget(value);
    setDeleteError(null);
    setAffectedSlots([]);
    setAffectedCount(0);
  };

  const confirmDelete = async () => {
    if (deleteTarget === null) return;

    const deleted = deleteTarget;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDelete(deleted);
      setDeleteTarget(null);
      setAffectedSlots([]);
      setAffectedCount(0);

      const lowerLevels = levels.filter((value) => value < deleted);
      setRankShiftNote(
        lowerLevels.length > 0
          ? `Level ${deleted} was deleted. Lower levels moved up one rank and all slot statuses were recalculated.`
          : null,
      );
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === 'LEVEL_IN_USE') {
        const slots = caught.details?.affectedSlots ?? [];
        setAffectedSlots(slots);
        setAffectedCount(
          caught.details?.affectedCount ?? slots.length,
        );
        // A fallback error may have no joined slot details. Keep the dialog
        // open and show the server message instead of silently doing nothing.
        setDeleteError(slots.length === 0 ? caught.message : null);
      } else {
        setDeleteError(errorMessage(caught));
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  const remainingLevels =
    deleteTarget === null
      ? levels
      : levels.filter((value) => value !== deleteTarget);
  const capAfterDelete = remainingLevels[0] ?? null;

  return (
    <section className="card p-5">
      <div>
        <h2 className="section-title">Plate levels</h2>
        <p className="muted mt-1">
          Add the levels you can reach. The highest level is the current cap.
        </p>
      </div>

      <p className="mt-4 text-sm font-medium">
        Current cap:{' '}
        <span className="tabular-nums">
          {cap === null ? 'none' : cap}
        </span>
      </p>

      <form
        onSubmit={submitAdd}
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="number"
          min={1}
          step={1}
          className="input"
          value={newValue}
          onChange={(event) => {
            setNewValue(event.target.value);
            if (addError) setAddError(null);
          }}
          placeholder="e.g. 30"
          aria-label="New plate level"
        />
        <button
          type="submit"
          className="btn btn-primary shrink-0"
          disabled={addBusy || exactDuplicate || newValue.trim() === ''}
        >
          {addBusy ? 'Adding…' : 'Add level'}
        </button>
      </form>

      {exactDuplicate ? (
        <p
          className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300"
          role="status"
          aria-live="polite"
        >
          Level {parsed} already exists.
        </p>
      ) : null}

      {addError && (
        <p
          className="mt-2 text-sm text-rose-600 dark:text-rose-400"
          role="alert"
        >
          {addError}
        </p>
      )}

      {rankShiftNote && (
        <div
          className="mt-3 flex items-start justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          <span>{rankShiftNote}</span>
          <button
            type="button"
            className="btn btn-ghost min-h-8 shrink-0 px-2 text-xs"
            onClick={() => setRankShiftNote(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-5">
        {levels.length === 0 ? (
          <p className="muted rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
            No plate levels yet. Add the current cap to start.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {levels.map((value) => (
              <li
                key={value}
                className="flex min-h-12 items-center justify-between gap-2 py-1"
              >
                <span className="flex items-center gap-2 font-medium">
                  Level {value}
                  {value === cap && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Cap
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn min-h-10 px-3 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onClick={() => openDelete(value)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete level ${deleteTarget ?? ''}?`}
        message={
          deleteTarget === null
            ? ''
            : `${
                capAfterDelete === null
                  ? 'No cap will be set.'
                  : `Cap becomes ${capAfterDelete}.`
              } All slot statuses will be recalculated.`
        }
        confirmLabel="Delete level"
        danger
        busy={deleteBusy}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
          setAffectedSlots([]);
          setAffectedCount(0);
        }}
        onConfirm={() => void confirmDelete()}
      >
        {affectedSlots.length > 0 ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/40">
            <p className="font-medium text-rose-800 dark:text-rose-200">
              Delete blocked. This level is used by:
            </p>
            <ul className="mt-1 space-y-0.5 text-rose-700 dark:text-rose-300">
              {affectedSlots.slice(0, 5).map((slot) => (
                <li key={`${slot.characterId}:${slot.slot}`}>
                  {slot.characterName} - {slot.plateName}
                </li>
              ))}
            </ul>
            {affectedCount > 5 && (
              <p className="mt-1 font-medium text-rose-700 dark:text-rose-300">
                +{affectedCount - 5} more
              </p>
            )}
          </div>
        ) : null}
        {deleteError ? (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
            {deleteError}
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
