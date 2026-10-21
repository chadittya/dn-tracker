import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import type {
  Character,
  HeraldryPlate,
  HeraldryRarity,
  HeraldrySlot,
} from '../api/types';
import { HeraldryStatusBadge } from './HeraldryStatusBadge';

export interface HeraldrySlotInput {
  characterId: number;
  slot: number;
  plateId: number;
  level: number;
  rarity: HeraldryRarity;
  hasThirdStat: boolean;
}

export function HeraldrySlotEditor({
  open,
  character,
  slot,
  plateOptions,
  levels,
  cap,
  slotCount,
  usedPlateIds,
  characters,
  onClose,
  onSave,
  onClear,
  onCopy,
}: {
  open: boolean;
  character: Character;
  slot: HeraldrySlot;
  plateOptions: readonly HeraldryPlate[];
  levels: readonly number[];
  cap: number | null;
  slotCount: number;
  usedPlateIds: ReadonlySet<number>;
  characters: readonly Character[];
  onClose: () => void;
  onSave: (input: HeraldrySlotInput) => Promise<void>;
  onClear: () => Promise<void>;
  onCopy: (sourceCharacterId: number) => Promise<void>;
}) {
  const [plateId, setPlateId] = useState<number | ''>('');
  const [level, setLevel] = useState<number | ''>('');
  const [rarity, setRarity] = useState<HeraldryRarity>('epic');
  const [hasThirdStat, setHasThirdStat] = useState(false);
  const [copySourceId, setCopySourceId] = useState<number | ''>('');
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setPlateId(slot.plateId ?? '');
    setLevel(slot.level ?? '');
    setRarity(slot.rarity ?? 'epic');
    setHasThirdStat(slot.hasThirdStat);
    setCopySourceId('');
    setConfirmCopy(false);
    setBusy(false);
    setError(null);
  }, [
    open,
    slot.characterId,
    slot.slot,
    slot.plateId,
    slot.level,
    slot.rarity,
    slot.hasThirdStat,
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

  const copyCandidates = characters.filter(
    (candidate) => candidate.id !== character.id,
  );
  const selectedSource = copyCandidates.find(
    (candidate) => candidate.id === copySourceId,
  );
  const canSave =
    plateId !== '' &&
    level !== '' &&
    !busy &&
    plateOptions.length > 0 &&
    levels.length > 0;

  const handleSave = async () => {
    if (plateId === '' || level === '') return;

    setBusy(true);
    setError(null);
    try {
      await onSave({
        characterId: character.id,
        slot: slot.slot,
        plateId: Number(plateId),
        level: Number(level),
        rarity,
        hasThirdStat,
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

  const handleCopy = async () => {
    if (copySourceId === '') return;

    setBusy(true);
    setError(null);
    try {
      await onCopy(Number(copySourceId));
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
        aria-labelledby="heraldry-slot-editor-title"
        className="card max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="heraldry-slot-editor-title" className="text-lg font-semibold">
              {character.name} · Slot {slot.slot}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <HeraldryStatusBadge status={slot.status} />
            </div>
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

        {plateOptions.length === 0 && (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Add plates in Manage before filling a slot.
          </p>
        )}
        {levels.length === 0 && (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Set a plate level in Manage before filling a slot.
          </p>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="heraldry-slot-plate"
              className="text-sm font-medium"
            >
              Plate
            </label>
            <select
              id="heraldry-slot-plate"
              className="input mt-1"
              value={plateId === '' ? '' : String(plateId)}
              onChange={(event) =>
                setPlateId(
                  event.target.value === '' ? '' : Number(event.target.value),
                )
              }
              disabled={busy || plateOptions.length === 0}
            >
              <option value="" disabled>
                Choose a plate
              </option>
              {plateOptions.map((plate) => {
                const usedElsewhere =
                  usedPlateIds.has(plate.id) && plate.id !== slot.plateId;
                return (
                  <option
                    key={plate.id}
                    value={plate.id}
                    disabled={usedElsewhere}
                  >
                    {plate.name}
                    {usedElsewhere ? ' (used)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label
              htmlFor="heraldry-slot-level"
              className="text-sm font-medium"
            >
              Level
            </label>
            <div className="mt-1 flex gap-2">
              <select
                id="heraldry-slot-level"
                className="input"
                value={level === '' ? '' : String(level)}
                onChange={(event) =>
                  setLevel(
                    event.target.value === ''
                      ? ''
                      : Number(event.target.value),
                  )
                }
                disabled={busy || levels.length === 0}
              >
                <option value="" disabled>
                  Choose a level
                </option>
                {levels.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary shrink-0"
                onClick={() => {
                  if (cap !== null) setLevel(cap);
                }}
                disabled={busy || cap === null}
              >
                Set to cap
              </button>
            </div>
          </div>

          <div>
            <span className="text-sm font-medium">Rarity</span>
            <div
              className="mt-1 grid grid-cols-2 gap-2"
              role="group"
              aria-label="Rarity"
            >
              <button
                type="button"
                className={`btn ${
                  rarity === 'epic' ? 'btn-primary' : 'btn-secondary'
                }`}
                aria-pressed={rarity === 'epic'}
                onClick={() => setRarity('epic')}
                disabled={busy}
              >
                Epic
              </button>
              <button
                type="button"
                className={`btn ${
                  rarity === 'rare' ? 'btn-primary' : 'btn-secondary'
                }`}
                aria-pressed={rarity === 'rare'}
                onClick={() => setRarity('rare')}
                disabled={busy}
              >
                Rare
              </button>
            </div>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-300 px-3 text-sm font-medium dark:border-slate-700">
            <span>3rd stat</span>
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

        {copyCandidates.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold">Copy from another character</h3>
            {confirmCopy ? (
              <div className="mt-2 space-y-2">
                <p className="muted">
                  Replace all {slotCount} slots for {character.name} with{' '}
                  {selectedSource?.name}'s loadout? Empty source slots will also
                  be empty.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setConfirmCopy(false)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void handleCopy()}
                    disabled={busy}
                  >
                    Replace {slotCount} slots
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <select
                  className="input"
                  value={copySourceId === '' ? '' : String(copySourceId)}
                  onChange={(event) =>
                    setCopySourceId(
                      event.target.value === ''
                        ? ''
                        : Number(event.target.value),
                    )
                  }
                  aria-label="Character to copy heraldry from"
                  disabled={busy}
                >
                  <option value="" disabled>
                    Choose a character
                  </option>
                  {copyCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  onClick={() => setConfirmCopy(true)}
                  disabled={busy || copySourceId === ''}
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
