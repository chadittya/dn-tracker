import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiRequestError, api, errorMessage } from '../api/client';
import type {
  EngravingAffectedSlot,
  EngravingCategory,
  EngravingCategoryMeta,
  EngravingGrade,
  EngravingGradeMeta,
  EngravingValue,
  EngravingValueTables,
} from '../api/types';
import {
  formatEngravingValue,
  formatPercentInput,
  parsePercentInput,
} from '../lib/engraving';
import { ConfirmDialog } from './ConfirmDialog';
import { EngravingGradeBadge } from './EngravingGradeBadge';

interface AddInput {
  category: EngravingCategory;
  grade: EngravingGrade;
  firstStatValue: number;
  secondStatValue?: number | null;
}

interface UpdateInput {
  firstStatValue: number;
  secondStatValue?: number | null;
}

interface EditingState {
  id: number;
  firstText: string;
  secondText: string;
}

interface DeleteUsage {
  valueId: number;
  affectedCount: number;
  affectedEngravingSlots: EngravingAffectedSlot[];
}

function usesSecondStat(category: EngravingCategory): boolean {
  return category === 'accessory' || category === 'wtd';
}

function editUsageNote(count: number): string {
  return count === 1
    ? '1 slot uses this value and will update'
    : `${count} slots use this value and will update`;
}

export function EngravingValuesSection({
  categories,
  grades,
  valueTables,
  onAdd,
  onUpdate,
  onDelete,
}: {
  categories: EngravingCategoryMeta[];
  grades: EngravingGradeMeta[];
  valueTables: EngravingValueTables;
  onAdd: (input: AddInput) => Promise<void>;
  onUpdate: (id: number, input: UpdateInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [activeCategory, setActiveCategory] = useState<EngravingCategory>(
    categories[0]?.key ?? 'weapon',
  );
  const categoryMeta =
    categories.find((category) => category.key === activeCategory) ??
    categories[0];
  const hasSecond = usesSecondStat(activeCategory);

  const [addGrade, setAddGrade] = useState<EngravingGrade>('rare');
  const [addFirst, setAddFirst] = useState('');
  const [addSecond, setAddSecond] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editNote, setEditNote] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<EngravingValue | null>(
    null,
  );
  const [deleteUsage, setDeleteUsage] = useState<DeleteUsage | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!categoryMeta) return null;

  const values = valueTables[activeCategory] ?? [];

  const setAddingReset = () => {
    setAddFirst('');
    setAddSecond('');
    setAddError(null);
  };

  const switchCategory = (category: EngravingCategory) => {
    setActiveCategory(category);
    setAddingReset();
    cancelEdit();
    setActionError(null);
  };

  const submitAdd = async (event: FormEvent) => {
    event.preventDefault();

    const first = parsePercentInput(addFirst);
    if (first === null) {
      setAddError('Enter a positive percent with up to two decimals.');
      return;
    }

    let second: number | null = null;
    if (hasSecond) {
      second = parsePercentInput(addSecond);
      if (second === null) {
        setAddError('Enter a positive second percent with up to two decimals.');
        return;
      }
    }

    setAddBusy(true);
    setAddError(null);
    try {
      await onAdd({
        category: activeCategory,
        grade: addGrade,
        firstStatValue: first,
        secondStatValue: second,
      });
      setAddingReset();
    } catch (caught) {
      setAddError(errorMessage(caught));
    } finally {
      setAddBusy(false);
    }
  };

  const startEdit = async (value: EngravingValue) => {
    setEditing({
      id: value.id,
      firstText: formatPercentInput(value.firstStatValue),
      secondText:
        value.secondStatValue === null
          ? ''
          : formatPercentInput(value.secondStatValue),
    });
    setEditError(null);
    setEditNote(null);
    setActionError(null);

    try {
      const usage = await api.getEngravingValueUsage(value.id);
      if (usage.affectedCount > 0) {
        setEditNote(editUsageNote(usage.affectedCount));
      }
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditNote(null);
    setEditError(null);
  };

  const saveEdit = async (value: EngravingValue) => {
    if (!editing) return;

    const first = parsePercentInput(editing.firstText);
    if (first === null) {
      setEditError('Enter a positive percent with up to two decimals.');
      return;
    }

    let second: number | null = null;
    if (usesSecondStat(value.category)) {
      second = parsePercentInput(editing.secondText);
      if (second === null) {
        setEditError('Enter a positive second percent with up to two decimals.');
        return;
      }
    }

    setEditBusy(true);
    setEditError(null);
    try {
      await onUpdate(value.id, {
        firstStatValue: first,
        secondStatValue: second,
      });
      cancelEdit();
    } catch (caught) {
      setEditError(errorMessage(caught));
    } finally {
      setEditBusy(false);
    }
  };

  const openDelete = async (value: EngravingValue) => {
    setDeleteTarget(value);
    setDeleteUsage(null);
    setDeleteError(null);
    setActionError(null);

    try {
      const usage = await api.getEngravingValueUsage(value.id);
      setDeleteUsage(usage);
    } catch (caught) {
      setDeleteTarget(null);
      setActionError(errorMessage(caught));
    }
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteUsage(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDelete(deleteTarget.id);
      if (editing?.id === deleteTarget.id) cancelEdit();
      closeDelete();
    } catch (caught) {
      if (
        caught instanceof ApiRequestError &&
        caught.code === 'ENGRAVING_VALUE_IN_USE'
      ) {
        const slots = caught.details?.affectedEngravingSlots ?? [];
        setDeleteUsage({
          valueId: deleteTarget.id,
          affectedCount: caught.details?.affectedCount ?? slots.length,
          affectedEngravingSlots: slots,
        });
        setDeleteError(slots.length === 0 ? caught.message : null);
      } else {
        setDeleteError(errorMessage(caught));
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <div>
        <h2 className="section-title">Engraving value tables</h2>
        <p className="muted mt-1">
          Each category has its own values. Editing a first stat can change the
          row order and the finder&apos;s lower-than results.
        </p>
      </div>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Engraving value category"
      >
        {categories.map((category) => (
          <button
            key={category.key}
            type="button"
            role="tab"
            aria-selected={activeCategory === category.key}
            className={`chip ${
              activeCategory === category.key
                ? 'chip-active'
                : 'chip-inactive'
            }`}
            onClick={() => switchCategory(category.key)}
          >
            {category.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => void submitAdd(event)}
        className="mt-4 grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-4"
      >
        <div>
          <label htmlFor="engraving-add-grade" className="text-sm font-medium">
            Grade
          </label>
          <select
            id="engraving-add-grade"
            className="input mt-1"
            value={addGrade}
            onChange={(event) =>
              setAddGrade(event.target.value as EngravingGrade)
            }
            disabled={addBusy}
          >
            {grades.map((grade) => (
              <option key={grade.key} value={grade.key}>
                {grade.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="engraving-add-first" className="text-sm font-medium">
            {categoryMeta.firstStatLabel} (%)
          </label>
          <input
            id="engraving-add-first"
            className="input mt-1"
            inputMode="decimal"
            value={addFirst}
            onChange={(event) => {
              setAddFirst(event.target.value);
              if (addError) setAddError(null);
            }}
            placeholder="e.g. 0.28"
            disabled={addBusy}
          />
        </div>
        {hasSecond && (
          <div>
            <label
              htmlFor="engraving-add-second"
              className="text-sm font-medium"
            >
              {categoryMeta.secondStatLabel} (%)
            </label>
            <input
              id="engraving-add-second"
              className="input mt-1"
              inputMode="decimal"
              value={addSecond}
              onChange={(event) => {
                setAddSecond(event.target.value);
                if (addError) setAddError(null);
              }}
              placeholder="e.g. 0.56"
              disabled={addBusy}
            />
          </div>
        )}
        <div className="flex items-end">
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={addBusy || addFirst.trim() === ''}
          >
            {addBusy ? 'Adding…' : 'Add value'}
          </button>
        </div>
      </form>

      {addError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {addError}
        </p>
      )}
      {actionError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {actionError}
        </p>
      )}

      <div className="mt-5 space-y-5">
        {grades.map((grade) => {
          const gradeValues = values.filter(
            (value) => value.grade === grade.key,
          );
          if (gradeValues.length === 0) return null;

          return (
            <div key={grade.key}>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <EngravingGradeBadge grade={grade.key} />
                <span className="muted font-normal">
                  {gradeValues.length} value
                  {gradeValues.length === 1 ? '' : 's'}
                </span>
              </h3>
              <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                {gradeValues.map((value) => {
                  const isEditing = editing?.id === value.id;

                  if (isEditing && editing) {
                    return (
                      <li key={value.id} className="py-3">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <label
                              htmlFor={`engraving-edit-first-${value.id}`}
                              className="text-xs font-medium"
                            >
                              {categoryMeta.firstStatLabel} (%)
                            </label>
                            <input
                              id={`engraving-edit-first-${value.id}`}
                              className="input mt-1"
                              inputMode="decimal"
                              value={editing.firstText}
                              onChange={(event) => {
                                setEditing({
                                  ...editing,
                                  firstText: event.target.value,
                                });
                                if (editError) setEditError(null);
                              }}
                              disabled={editBusy}
                            />
                          </div>
                          {usesSecondStat(value.category) && (
                            <div>
                              <label
                                htmlFor={`engraving-edit-second-${value.id}`}
                                className="text-xs font-medium"
                              >
                                {categoryMeta.secondStatLabel} (%)
                              </label>
                              <input
                                id={`engraving-edit-second-${value.id}`}
                                className="input mt-1"
                                inputMode="decimal"
                                value={editing.secondText}
                                onChange={(event) => {
                                  setEditing({
                                    ...editing,
                                    secondText: event.target.value,
                                  });
                                  if (editError) setEditError(null);
                                }}
                                disabled={editBusy}
                              />
                            </div>
                          )}
                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              className="btn btn-primary min-h-10 px-3"
                              onClick={() => void saveEdit(value)}
                              disabled={editBusy}
                            >
                              {editBusy ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary min-h-10 px-3"
                              onClick={cancelEdit}
                              disabled={editBusy}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        {editNote && (
                          <p
                            className="mt-2 text-sm text-amber-700 dark:text-amber-300"
                            role="status"
                          >
                            {editNote}
                          </p>
                        )}
                        {editError && (
                          <p
                            className="mt-2 text-sm text-rose-600 dark:text-rose-400"
                            role="alert"
                          >
                            {editError}
                          </p>
                        )}
                      </li>
                    );
                  }

                  return (
                    <li
                      key={value.id}
                      className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="tabular-nums">
                        {formatEngravingValue(value, categoryMeta)}
                      </span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          className="btn btn-secondary min-h-10 px-3"
                          onClick={() => void startEdit(value)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn min-h-10 px-3 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          onClick={() => void openDelete(value)}
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {values.length === 0 && (
          <p className="muted rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
            No {categoryMeta.label} values yet. Add one above.
          </p>
        )}
      </div>

      {deleteTarget && deleteUsage === null && (
        <ConfirmDialog
          open
          title="Checking usage…"
          message="Checking whether any character slots use this value."
          confirmLabel="Delete value"
          danger
          busy
          onConfirm={() => undefined}
          onCancel={closeDelete}
        />
      )}

      {deleteTarget && deleteUsage && deleteUsage.affectedCount > 0 && (
        <ConfirmDialog
          open
          title="Delete blocked"
          message={`This value is used by ${deleteUsage.affectedCount} slot${
            deleteUsage.affectedCount === 1 ? '' : 's'
          }. Empty those slots or assign another value first.`}
          confirmLabel="Close"
          onConfirm={closeDelete}
          onCancel={closeDelete}
        >
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/40">
            <ul className="space-y-0.5 text-rose-700 dark:text-rose-300">
              {deleteUsage.affectedEngravingSlots.slice(0, 5).map((slot) => (
                <li key={`${slot.characterId}:${slot.slot}`}>
                  {slot.characterName} — {slot.slotLabel}
                </li>
              ))}
            </ul>
            {deleteUsage.affectedCount > 5 && (
              <p className="mt-1 font-medium text-rose-700 dark:text-rose-300">
                +{deleteUsage.affectedCount - 5} more
              </p>
            )}
            {deleteError && (
              <p className="mt-2 text-rose-700 dark:text-rose-300">
                {deleteError}
              </p>
            )}
          </div>
        </ConfirmDialog>
      )}

      {deleteTarget && deleteUsage && deleteUsage.affectedCount === 0 && (
        <ConfirmDialog
          open
          title="Delete this value?"
          message="No character slots use it. This cannot be undone."
          confirmLabel="Delete value"
          danger
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={closeDelete}
        >
          {deleteError && (
            <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
              {deleteError}
            </p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
