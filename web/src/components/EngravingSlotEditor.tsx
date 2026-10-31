import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import type {
  Character,
  EngravingCategoryMeta,
  EngravingGrade,
  EngravingGradeMeta,
  EngravingSlot,
  EngravingSlotDefinition,
  EngravingValue,
} from '../api/types';
import { formatEngravingValue, formatPercentInput, parsePercentInput } from '../lib/engraving';
import { ENGRAVING_GRADE_COLORS } from '../lib/engravingColors';

export interface EngravingSlotInput {
  characterId: number;
  slot: number;
  valueId: number;
  thirdStatName?: string | null;
  thirdStatValue?: number | null;
}

export function EngravingSlotEditor({
  open,
  character,
  slot,
  definition,
  category,
  grades,
  values,
  onClose,
  onSave,
  onClear,
}: {
  open: boolean;
  character: Character;
  slot: EngravingSlot;
  definition: EngravingSlotDefinition;
  category: EngravingCategoryMeta;
  grades: EngravingGradeMeta[];
  values: readonly EngravingValue[];
  onClose: () => void;
  onSave: (input: EngravingSlotInput) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [grade, setGrade] = useState<EngravingGrade>('rare');
  const [valueId, setValueId] = useState<number | ''>('');
  const [hasThirdStat, setHasThirdStat] = useState(false);
  const [thirdStatName, setThirdStatName] = useState('');
  const [thirdStatValueText, setThirdStatValueText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setGrade(slot.grade ?? 'rare');
    setValueId(slot.valueId ?? '');
    setHasThirdStat(slot.thirdStatName !== null);
    setThirdStatName(slot.thirdStatName ?? '');
    setThirdStatValueText(
      slot.thirdStatValue !== null
        ? formatPercentInput(slot.thirdStatValue)
        : '',
    );
    setBusy(false);
    setError(null);
  }, [
    open,
    slot.characterId,
    slot.slot,
    slot.grade,
    slot.valueId,
    slot.thirdStatName,
    slot.thirdStatValue,
  ]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const gradeValues = values.filter((value) => value.grade === grade);
  const selectedValue = values.find((value) => value.id === valueId);
  const trimmedName = thirdStatName.trim();
  const trimmedValueText = thirdStatValueText.trim();
  const parsedThirdValue =
    trimmedValueText === '' ? null : parsePercentInput(trimmedValueText);

  let thirdStatError: string | null = null;
  if (hasThirdStat) {
    if (trimmedName === '' && trimmedValueText === '') {
      thirdStatError = 'Enter a third stat name and value.';
    } else if (trimmedName === '') {
      thirdStatError = 'Enter a third stat name when a value is entered.';
    } else if (trimmedValueText === '') {
      thirdStatError = 'Enter a third stat value when a name is entered.';
    } else if (parsedThirdValue === null) {
      thirdStatError = 'Enter a percent value with up to two decimals.';
    }
  }

  const canSave =
    valueId !== '' &&
    selectedValue !== undefined &&
    !busy &&
    thirdStatError === null;

  const handleGradeChange = (next: EngravingGrade) => {
    setGrade(next);
    const stillValid = values.some(
      (value) => value.id === valueId && value.grade === next,
    );
    if (!stillValid) setValueId('');
  };

  const handleSave = async () => {
    if (
      valueId === '' ||
      selectedValue === undefined ||
      thirdStatError !== null
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSave({
        characterId: character.id,
        slot: slot.slot,
        valueId: Number(valueId),
        thirdStatName: hasThirdStat ? trimmedName : undefined,
        thirdStatValue:
          hasThirdStat && parsedThirdValue !== null
            ? parsedThirdValue
            : undefined,
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setError(null);
    try {
      await onClear();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="engraving-slot-editor-title"
        className="card max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="engraving-slot-editor-title"
              className="text-lg font-semibold"
            >
              {character.name} · {definition.label}
            </h2>
            <p className="muted mt-1 text-sm">
              {category.label} engraving · {category.firstStatLabel}
              {category.secondStatLabel
                ? ` / ${category.secondStatLabel}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost -mt-2 -mr-2 min-h-10 px-3 text-xl"
            onClick={onClose}
            disabled={busy}
            aria-label="Close slot editor"
          >
            ×
          </button>
        </div>

        {values.length === 0 && (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Add {category.label} engraving values in Manage before filling a
            slot.
          </p>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <span className="text-sm font-medium">Grade</span>
            <div
              className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="group"
              aria-label="Grade"
            >
              {grades.map((option) => {
                const colors = ENGRAVING_GRADE_COLORS[option.key];
                const selected = grade === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`btn ${
                      selected
                        ? colors.buttonSelectedClassName
                        : colors.buttonClassName
                    }`}
                    aria-pressed={selected}
                    onClick={() => handleGradeChange(option.key)}
                    disabled={busy}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="engraving-slot-value"
              className="text-sm font-medium"
            >
              Value
            </label>
            <select
              id="engraving-slot-value"
              className="input mt-1"
              value={valueId === '' ? '' : String(valueId)}
              onChange={(event) =>
                setValueId(
                  event.target.value === '' ? '' : Number(event.target.value),
                )
              }
              disabled={busy || gradeValues.length === 0}
            >
              <option value="" disabled>
                {gradeValues.length === 0
                  ? 'No values for this grade'
                  : 'Choose a value'}
              </option>
              {gradeValues.map((value) => (
                <option key={value.id} value={value.id}>
                  {formatEngravingValue(value, category)}
                </option>
              ))}
            </select>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-300 px-3 text-sm font-medium dark:border-slate-700">
            <span>Third stat</span>
            <span className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                {hasThirdStat ? 'Yes' : 'No'}
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
                checked={hasThirdStat}
                onChange={(event) => setHasThirdStat(event.target.checked)}
                disabled={busy}
              />
            </span>
          </label>

          {hasThirdStat && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="engraving-third-name"
                  className="text-sm font-medium"
                >
                  Third stat name
                </label>
                <input
                  id="engraving-third-name"
                  className="input mt-1"
                  value={thirdStatName}
                  maxLength={50}
                  onChange={(event) => setThirdStatName(event.target.value)}
                  placeholder="e.g. Critical Damage"
                  disabled={busy}
                />
              </div>
              <div>
                <label
                  htmlFor="engraving-third-value"
                  className="text-sm font-medium"
                >
                  Third stat value (%)
                </label>
                <input
                  id="engraving-third-value"
                  className="input mt-1"
                  inputMode="decimal"
                  value={thirdStatValueText}
                  onChange={(event) =>
                    setThirdStatValueText(event.target.value)
                  }
                  placeholder="e.g. 1.25"
                  disabled={busy}
                />
              </div>
              {thirdStatError && (
                <p
                  className="text-sm text-rose-600 dark:text-rose-400 sm:col-span-2"
                  role="alert"
                >
                  {thirdStatError}
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p
            className="mt-4 text-sm text-rose-600 dark:text-rose-400"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {!slot.isEmpty && (
              <button
                type="button"
                className="btn min-h-10 px-3 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                onClick={() => void handleClear()}
                disabled={busy}
              >
                Clear slot
              </button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              {busy ? 'Saving…' : 'Save slot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
