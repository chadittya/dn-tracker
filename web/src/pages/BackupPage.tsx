import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api, errorMessage } from '../api/client';
import type { BackupInfo } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatBytes, formatWib, exportFilename } from '../lib/format';
import { useAppState } from '../state/context';

interface PendingImport {
  fileName: string;
  data: unknown;
}

function importVersion(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null;
  const version = (data as { version?: unknown }).version;
  return typeof version === 'number' ? version : null;
}

function importConfirmMessage(
  fileName: string,
  version: number | null,
): string {
  const replaced =
    'every current character, nest, run, plate level, plate, and heraldry slot';

  if (version === 3) {
    return `Importing "${fileName}" will delete ${replaced}, every engraving value, and every character engraving slot, then replace them with the file's contents. A pre-import backup is created first.`;
  }
  if (version === 1) {
    return `Importing "${fileName}" will delete ${replaced} plus every character engraving slot, then replace them with the file's contents. Version 1 files have no heraldry or engraving data, so current heraldry is cleared; current engraving value tables are kept. A pre-import backup is created first.`;
  }
  if (version === 2) {
    return `Importing "${fileName}" will delete ${replaced} plus every character engraving slot, then replace them with the file's contents. Version 2 files have no engraving data, so current character engraving is cleared; current engraving value tables are kept. A pre-import backup is created first.`;
  }
  return `Importing "${fileName}" will replace ${replaced}. Older files without heraldry or engraving data clear character engraving and may clear heraldry. A pre-import backup is created first.`;
}

export function BackupPage() {
  const { refresh } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupsError, setBackupsError] = useState<string | null>(null);
  const [loadingBackups, setLoadingBackups] = useState(true);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const loadBackups = useCallback(async () => {
    try {
      const result = await api.getBackups();
      setBackups(result.backups);
      setBackupsError(null);
    } catch (caught) {
      setBackupsError(errorMessage(caught));
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setExportError(errorMessage(caught));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new Error('That file is not valid JSON.');
      }
      setPendingImport({ fileName: file.name, data: parsed });
    } catch (caught) {
      setImportError(errorMessage(caught));
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;

    setImporting(true);
    setImportError(null);
    try {
      const result = await api.importData(pendingImport.data);
      setPendingImport(null);
      setImportSuccess(
        `Imported ${result.imported.characters} characters, ${
          result.imported.nests
        } nests, ${result.imported.runs} runs, ${
          result.imported.plateLevels
        } plate levels, ${result.imported.plates} plates, ${
          result.imported.heraldrySlots
        } heraldry slots, ${
          result.imported.engravingValues
        } engraving values, and ${
          result.imported.engravingSlots
        } engraving slots. Pre-import backup: ${result.backup}.`,
      );
      await Promise.all([refresh(), loadBackups()]);
    } catch (caught) {
      setImportError(errorMessage(caught));
      setPendingImport(null);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Backup</h1>
        <p className="muted mt-1">
          Export or import all data as JSON, and see the automatic SQLite
          backups.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="section-title">Export data</h2>
          <p className="muted mt-1">
            Download every character, nest, run, plate level, plate, heraldry
            slot, engraving value, and character engraving slot from all weeks
            as a JSON file.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-4"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? 'Preparing…' : 'Export JSON'}
          </button>
          {exportError && (
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
              {exportError}
            </p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="section-title">Import data</h2>
          <p className="muted mt-1">
            Replaces all current characters, nests, runs, plate levels, plates,
            heraldry slots, engraving values, and character engraving slots.
            The file is fully validated first, and a pre-import backup is
            created. Version 3 files replace everything; version 1 and 2 files
            clear character engraving but keep current engraving value tables.
            Version 1 files also clear heraldry.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleFileSelected(event)}
          />
          <button
            type="button"
            className="btn btn-secondary mt-4"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose JSON file…
          </button>
          {importError && (
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
              {importError}
            </p>
          )}
          {importSuccess && (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              {importSuccess}
            </p>
          )}
        </section>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">Automatic backups</h2>
            <p className="muted mt-1">
              Kept in <code>data/backups/</code>: newest 14 automatic and newest
              5 pre-import backups.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost min-h-10 px-3"
            onClick={() => void loadBackups()}
          >
            Refresh
          </button>
        </div>

        {backupsError && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
            {backupsError}
          </p>
        )}

        {loadingBackups ? (
          <p className="muted mt-4">Loading backups…</p>
        ) : backups.length === 0 ? (
          <p className="muted mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
            No automatic backups yet. One is created when the server starts,
            then every 24 hours while it runs.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-140 text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2 pr-4">File</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 text-right">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {backups.map((backup) => (
                  <tr key={backup.filename}>
                    <td className="max-w-80 truncate py-2.5 pr-4 font-mono text-xs">
                      {backup.filename}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          backup.kind === 'app'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                      >
                        {backup.kind === 'app' ? 'Automatic' : 'Pre-import'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-slate-600 dark:text-slate-300">
                      {formatWib(backup.createdAt)}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                      {formatBytes(backup.sizeBytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted mt-4">
          To restore a backup, stop the server, copy the chosen file over{' '}
          <code>data/app.db</code>, delete <code>app.db-wal</code> and{' '}
          <code>app.db-shm</code> if present, then start the server. See README.
        </p>
      </section>

      <ConfirmDialog
        open={pendingImport !== null}
        title="Replace all data?"
        message={importConfirmMessage(
          pendingImport?.fileName ?? '',
          pendingImport ? importVersion(pendingImport.data) : null,
        )}
        confirmLabel="Import and replace"
        danger
        busy={importing}
        onCancel={() => setPendingImport(null)}
        onConfirm={() => void confirmImport()}
      />
    </div>
  );
}
