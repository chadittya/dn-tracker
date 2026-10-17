# Review — Dragon Nest Run Tracker v1

## 1. Requirement checklist

All nine v1 scope items are implemented.

| # | Requirement | Status | Implemented in |
| --- | --- | --- | --- |
| 1 | Characters: add, rename, remove; name only | Done | `server/src/routes/characters.ts`, `server/src/migrations.ts`, `server/src/validation.ts`, `web/src/pages/ManagePage.tsx`, `web/src/components/EntitySection.tsx` |
| 2 | Nests: add, rename, remove; name only | Done | `server/src/routes/nests.ts`, `server/src/migrations.ts`, `server/src/validation.ts`, `web/src/pages/ManagePage.tsx`, `web/src/components/EntitySection.tsx` |
| 3 | Nest Run page: nest selector, "Not yet"/"Done" columns, one-click toggle, counts | Done | `web/src/pages/RunPage.tsx`, `web/src/components/CharacterToggleCard.tsx`, `server/src/routes/runs.ts` |
| 4 | Matrix page with sticky header row and first column | Done | `web/src/pages/MatrixPage.tsx`, `web/src/components/MatrixGrid.tsx` |
| 5 | Dashboard: overall, per nest, per character, most remaining, reset countdown | Done | `web/src/pages/DashboardPage.tsx`, `web/src/components/ProgressBar.tsx`, `web/src/components/StatCard.tsx`, `server/src/progress.ts`, `web/src/hooks/useCountdown.ts` |
| 6 | Saturday 08:00 WIB non-destructive reset; automatic UI refresh by timer and tab visibility | Done | `server/src/week.ts`, `server/src/routes/state.ts`, `web/src/state/AppStateProvider.tsx`, `web/src/hooks/useCountdown.ts`, `server/tests/week.test.ts` |
| 7 | Backup page: export JSON, validated import with overwrite confirmation, automatic backup list with timestamps | Done | `web/src/pages/BackupPage.tsx`, `server/src/transfer.ts`, `server/src/routes/data.ts`, `server/src/routes/backups.ts` |
| 8 | Automatic SQLite backups per CLAUDE.md | Done | `server/src/backup.ts`, `server/src/runtime.ts`, `server/tests/backup.test.ts` |
| 9 | Empty states with calls to action for no characters or no nests | Done | `web/src/components/EmptyState.tsx`, `web/src/pages/RunPage.tsx`, `web/src/pages/MatrixPage.tsx`, `web/src/pages/DashboardPage.tsx` |

## 2. Business rules compliance

### Business rules

- **Characters and nests have only `name`, `id`, `created_at`.** Enforced by the
  table definitions in `server/src/migrations.ts`; the API never accepts extra
  fields for these entities.
- **Every character is tracked on every nest, with no exclusion.** Progress is
  computed as a full cross-product in `server/src/progress.ts`; the Run and
  Matrix pages render every character/nest pair.
- **Run status is binary, set with idempotent `PUT /api/runs`.** Implemented in
  `server/src/routes/runs.ts` with `INSERT OR IGNORE` / `DELETE`. The server
  computes the week; the client never sends a week key.
- **Weekly reset is Saturday 08:00 WIB.** All week-boundary logic is in
  `server/src/week.ts`; routes obtain the week through `getWeekInfo()`.
- **Reset is non-destructive.** No delete-on-reset code exists. Current status
  is determined by filtering `runs.week_key = current week key` in
  `server/src/routes/state.ts`; old rows remain.
- **Adding a character or nest needs no backfill.** Missing `runs` rows are
  treated as not done in `server/src/progress.ts` and in the Run/Matrix pages.
- **Removing a character or nest cascades to its runs; UI confirms first.**
  `ON DELETE CASCADE` is in `server/src/migrations.ts`; confirmation dialogs are
  in `web/src/components/EntitySection.tsx` and the copy states that run records
  will also be deleted.
- **Names are trimmed, at most 50 characters, and unique case-insensitively.**
  Trim and length checks are in `server/src/validation.ts`; the
  `COLLATE NOCASE UNIQUE` constraints are in `server/src/migrations.ts`;
  import uses the same checks in `server/src/transfer.ts`; inputs use
  `maxLength={50}` in `web/src/components/EntitySection.tsx`.

### Database rules

- **Tables and run composite primary key.** `server/src/migrations.ts` creates
  `characters`, `nests`, and `runs` with
  `PRIMARY KEY (character_id, nest_id, week_key)`.
- **`PRAGMA foreign_keys = ON` and `ON DELETE CASCADE`.** Set per connection in
  `server/src/db.ts` and declared on both `runs` foreign keys in
  `server/src/migrations.ts`.
- **Names use `COLLATE NOCASE` with `UNIQUE`.** Declared in
  `server/src/migrations.ts`.
- **Ordered migrations tracked with `PRAGMA user_version`, run inside a
  transaction.** `server/src/migrations.ts` reads `user_version`, refuses a
  newer schema, and runs each migration and its version bump in one
  `db.transaction()`.
- **Parameterized queries only.** Every SQL statement in `server/src/routes/`,
  `server/src/transfer.ts`, and `server/src/progress.ts` passes values through
  parameters. No SQL is built by string concatenation.

### Backup rules

- **Conditional startup backup and 24-hour timer.** `server/src/runtime.ts`
  calls `needsStartupBackup()` from `server/src/backup.ts`, then schedules a
  24-hour interval.
- **`db.backup()` into `app-YYYYMMDD-HHmmss.db` with WIB timestamps.**
  `server/src/backup.ts` writes to a temporary file with SQLite's online backup,
  then renames atomically.
- **Always create `preimport-*` before a valid import.** `server/src/transfer.ts`
  validates the payload first, then awaits `backupService.create('preimport')`
  and aborts on backup failure.
- **Retention: newest 14 `app-*` and newest 5 `preimport-*`, pruned
  independently.** `server/src/backup.ts` prunes by kind after each backup.
- **Backup page lists both kinds.** `server/src/routes/backups.ts` returns all
  backups; `web/src/pages/BackupPage.tsx` shows the kind.

### Code rules

- **All week/time logic in `server/src/week.ts`, pure, with injectable `now`.**
  No other module calls `new Date()` for week calculations; routes receive a
  clock from `createApp`.
- **API returns `weekKey` and `nextResetAt`; frontend never computes week
  boundaries.** Returned by `server/src/routes/state.ts`, `health`, and
  `PUT /api/runs`; consumed by `web/src/state/AppStateProvider.tsx` and
  `web/src/hooks/useCountdown.ts`.
- **Bind only to `127.0.0.1`; dev uses the same port 3000 with Vite through the
  same HTTP server.** Enforced in `server/src/config.ts`,
  `server/src/index.ts`, and `server/src/dev.mts`.
- **Dev uses `data-dev/`; production uses `data/`.** Defaulted in
  `server/src/dev.mts`; both paths are resolved in `server/src/config.ts`.
- **UI components hold no business logic.** Pages use hooks and
  `web/src/api/client.ts`; week and progress calculations stay on the server.
- **Validate all input and return consistent JSON errors; import limit 25 MB,
  other routes default.** `server/src/validation.ts`,
  `server/src/errors.ts`, and `server/src/app.ts`.
- **Keep dependencies minimal.** Only four runtime dependencies; see section 9.
- **Do not invent requirements.** Ambiguities are listed in section 11.

### Design rules

- **Modern, clean, simple; dark mode default with light toggle.** Dark is set on
  `<html>` before paint in `web/index.html`; `web/src/hooks/useTheme.ts` and
  `web/src/components/ThemeToggle.tsx` toggle and persist it.
- **Large tap/click targets; one-click run toggling.** `btn`/`chip`/card styles
  in `web/src/index.css`; each character card or matrix cell is a single button.

## 3. Database

### Schema (migration 1)

```sql
CREATE TABLE characters (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE nests (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE runs (
  character_id  INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  nest_id       INTEGER NOT NULL REFERENCES nests(id) ON DELETE CASCADE,
  week_key      TEXT NOT NULL,
  completed_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (character_id, nest_id, week_key)
);

CREATE INDEX idx_runs_week_key ON runs(week_key);
CREATE INDEX idx_runs_nest_id ON runs(nest_id);
```

`id` is a plain `INTEGER PRIMARY KEY` (rowid alias) so JSON import can preserve
ids without an autoincrement sequence.

### Migration list

| Version | Change |
| --- | --- |
| 1 | Create `characters`, `nests`, `runs`, `idx_runs_week_key`, `idx_runs_nest_id` |

Migrations are ordered and contiguous, tracked with `PRAGMA user_version`, and
executed one transaction per migration. The server refuses to start if the
database schema version is newer than the app supports.

### PRAGMA settings

| PRAGMA | Setting | Where |
| --- | --- | --- |
| `foreign_keys` | `ON` | Each connection in `server/src/db.ts` |
| `journal_mode` | `WAL` | Each file-backed connection in `server/src/db.ts` (in-memory DBs remain in memory mode) |
| `user_version` | Read, validated, and incremented per migration | `server/src/migrations.ts` |

## 4. API

All errors use:

```json
{ "error": { "code": "CODE", "message": "Human-readable message." } }
```

Common codes: `VALIDATION_ERROR` (400), `INVALID_JSON` (400),
`INVALID_IMPORT` (400), `NOT_FOUND` (404), `DUPLICATE_NAME` (409),
`PAYLOAD_TOO_LARGE` (413), `INTERNAL_ERROR` (500).

### `GET /api/state`

Response `200`:

```ts
{
  weekKey: string;          // YYYY-MM-DD
  weekStartAt: string;      // ISO instant
  nextResetAt: string;      // ISO instant
  serverNow: string;        // ISO instant
  characters: Array<{ id: number; name: string; createdAt: string }>;
  nests: Array<{ id: number; name: string; createdAt: string }>;
  runs: Array<{             // current week only
    characterId: number;
    nestId: number;
    weekKey: string;
    completedAt: string;
  }>;
  dashboard: {
    done: number;
    total: number;          // characters.length * nests.length
    perNest: Array<{ nestId: number; name: string; done: number; total: number }>;
    perCharacter: Array<{
      characterId: number;
      name: string;
      done: number;
      total: number;
      remaining: number;
    }>;
    mostRemaining: Array<{ characterId: number; name: string; remaining: number }>;
  };
}
```

### Characters

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `POST` | `/api/characters` | `{ name: string }` | `201 { character: { id, name, createdAt } }` |
| `PATCH` | `/api/characters/:id` | `{ name: string }` | `200 { character: { id, name, createdAt } }` |
| `DELETE` | `/api/characters/:id` | none | `204` empty body |

### Nests

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `POST` | `/api/nests` | `{ name: string }` | `201 { nest: { id, name, createdAt } }` |
| `PATCH` | `/api/nests/:id` | `{ name: string }` | `200 { nest: { id, name, createdAt } }` |
| `DELETE` | `/api/nests/:id` | none | `204` empty body |

### `PUT /api/runs`

Request:

```ts
{ characterId: number; nestId: number; done: boolean }
```

Response `200`:

```ts
{ done: boolean; weekKey: string; nextResetAt: string }
```

Idempotent: `done: true` inserts the current-week row if absent and is a no-op
if present; `done: false` deletes it if present and is a no-op otherwise. A
missing character or nest returns `404 NOT_FOUND`.

### `GET /api/backups`

Response `200`:

```ts
{
  backups: Array<{
    filename: string;
    kind: 'app' | 'preimport';
    createdAt: string;   // ISO instant derived from the WIB filename
    sizeBytes: number;
  }>;
}
```

Newest first. Both automatic and pre-import backups are included.

### `GET /api/data/export`

Response `200`:

```ts
{
  version: 1;
  exportedAt: string;
  characters: Array<{ id: number; name: string; createdAt: string }>;
  nests: Array<{ id: number; name: string; createdAt: string }>;
  runs: Array<{               // all weeks
    characterId: number;
    nestId: number;
    weekKey: string;
    completedAt: string;
  }>;
}
```

### `POST /api/data/import`

Request body has the same shape as the export. `version` must be `1`; each
entity needs a unique positive integer id and a valid name; runs must reference
existing ids, use a Saturday `weekKey`, and be unique per
`(characterId, nestId, weekKey)`. `createdAt` and `completedAt` are optional;
if omitted, the import time is used. Unknown fields are ignored. Body limit is
25 MB.

Response `200`:

```ts
{
  imported: { characters: number; nests: number; runs: number };
  backup: string; // preimport filename
}
```

The whole payload is validated before anything is written. On success a
`preimport-*` backup is created and all existing data is replaced in one
transaction. Invalid input returns `400 INVALID_IMPORT` and leaves both the
database and the backup directory untouched.

### `GET /api/health`

Response `200`:

```ts
{ ok: true; weekKey: string; nextResetAt: string; serverNow: string }
```

Unknown `/api/*` paths return a JSON `404 NOT_FOUND`, never SPA HTML.

## 5. Week logic

Full contents of `server/src/week.ts`:

```ts
/**
 * All week/reset logic lives here.
 *
 * The app's week boundary is Saturday 08:00 WIB (UTC+7, no DST). A week_key is
 * the WIB calendar date (YYYY-MM-DD) of the Saturday that started the week.
 *
 * Everything below uses epoch milliseconds and UTC getters only. WIB has a
 * fixed offset, so the host machine's timezone can never affect the result.
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const RESET_HOUR_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface WeekInfo {
  /** YYYY-MM-DD date of the active Saturday 08:00 WIB. */
  weekKey: string;
  /** The active Saturday 08:00 WIB as a real instant. */
  weekStartAt: Date;
  /** The next Saturday 08:00 WIB as a real instant. */
  nextResetAt: Date;
}

function formatDateKey(ms: number): string {
  const d = new Date(ms);
  const year = String(d.getUTCFullYear()).padStart(4, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekInfo(now: Date = new Date()): WeekInfo {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new RangeError('Invalid date passed to getWeekInfo');
  }

  // Express the WIB wall clock as if it were UTC.
  const wibShiftedMs = nowMs + WIB_OFFSET_MS;
  const wibDay = new Date(wibShiftedMs).getUTCDay(); // 0 = Sunday, 6 = Saturday
  const daysSinceSaturday = (wibDay + 1) % 7;
  const startOfWibDayMs = Math.floor(wibShiftedMs / DAY_MS) * DAY_MS;

  let candidateShiftedMs =
    startOfWibDayMs - daysSinceSaturday * DAY_MS + RESET_HOUR_MS;

  // Before Saturday 08:00 WIB the most recent reset is a week earlier.
  if (wibShiftedMs < candidateShiftedMs) {
    candidateShiftedMs -= WEEK_MS;
  }

  const weekStartMs = candidateShiftedMs - WIB_OFFSET_MS;

  return {
    weekKey: formatDateKey(candidateShiftedMs),
    weekStartAt: new Date(weekStartMs),
    nextResetAt: new Date(weekStartMs + WEEK_MS),
  };
}

export function getWeekKey(now: Date): string {
  return getWeekInfo(now).weekKey;
}

export function getNextResetAt(now: Date): Date {
  return getWeekInfo(now).nextResetAt;
}

/**
 * A valid week_key is a real calendar date (YYYY-MM-DD) that falls on a
 * Saturday, because week keys are always reset Saturdays in WIB.
 */
export function isValidWeekKey(key: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || year > 9999) return false;

  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);

  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return false;
  }

  return d.getUTCDay() === 6;
}
```

## 6. Backup behavior

### Schedule

- On server start, `server/src/runtime.ts` lists existing `app-*` backups. It
  creates a new one only if none exists or the newest is at least 24 hours old.
- While the server runs, a `setInterval` creates an `app-*` backup every 24
  hours from the start time. The timer is `.unref()`ed.
- Startup backup failures are logged and non-fatal. Import-triggered backup
  failures abort the import.
- `BackupService` serializes all backup work through a promise queue, so
  scheduled, startup, and pre-import backups cannot overlap.

### Creation

`server/src/backup.ts`:

1. Ensures `data/backups/` exists.
2. Picks `app-YYYYMMDD-HHmmss.db` or `preimport-YYYYMMDD-HHmmss.db` using WIB
   time; same-second collisions get `-1`, `-2`, etc.
3. Removes any stale `.tmp` file, calls better-sqlite3 `db.backup()` to a
   temporary path, then renames it to the final name.
4. Prunes that kind to its retention limit.
5. Returns filename, kind, creation time, and size.

SQLite's online backup API keeps the copy consistent while the database is in
use; plain file copying is never used.

### Retention

- Newest 14 `app-*` backups.
- Newest 5 `preimport-*` backups.
- The two kinds are pruned independently and never count against each other.
- Pruning ignores `.tmp` files and unrelated filenames; a failed unlink is logged
  and does not fail the backup.

### Pre-import backup

`server/src/transfer.ts` validates the complete import payload first. Only for
valid payloads does it create a `preimport-*` backup, and it waits for that
backup to succeed before opening the replace transaction. Invalid imports create
no backup and change no rows. If the backup fails, the import is aborted.

## 7. Test results

### `npm test`

```text
> dn-tracker@1.0.0 test
> vitest run

 RUN  v5.0.5 C:/Users/Nyan/Desktop/DEVMODE/dn-tracker

 Test Files  5 passed (5)
      Tests  51 passed (51)
   Start at  11:45:06
   Duration  625ms (import 47%, tests 45%, transform 6%, worker 1%)
```

Coverage includes week boundary and timezone independence, migration idempotency
and cascades, idempotent run puts, week isolation, duplicate names, backup
creation/retention/collisions, startup-backup decisions, import validation with
untouched state, and body-size limits.

### `npm run build`

```text
> dn-tracker@1.0.0 build
> tsc -p server/tsconfig.json && tsc -p server/tsconfig.dev.json && tsc -p web/tsconfig.json --noEmit && vite build

vite v8.3.4 building client environment for production...
transforming...
✓ 40 modules transformed.
rendering chunks...
computing gzip size...
dist/web/index.html                   0.78 kB │ gzip:  0.42 kB
dist/web/assets/index-Hk3klQZO.css   33.39 kB │ gzip:  6.57 kB
dist/web/assets/index-CwlKvlgn.js   252.39 kB │ gzip: 76.97 kB

✓ built in 155ms
```

`npm run lint` also passes with no output. The server, dev-entry, and web
tsconfigs were additionally checked with TypeScript 5.9.3, 6.0.3, and 7.0.2
(`npx -p typescript@<version> tsc -p ... --noEmit`); all three versions produce
no errors or deprecation warnings.

## 8. File tree

Excludes `node_modules/`, `data/`, `data-dev/`, `dist/`, and `.claude/`.

```text
dn-tracker/
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── backups.ts
│   │   │   ├── characters.ts
│   │   │   ├── data.ts
│   │   │   ├── nests.ts
│   │   │   ├── runs.ts
│   │   │   └── state.ts
│   │   ├── app.ts
│   │   ├── backup.ts
│   │   ├── config.ts
│   │   ├── db.ts
│   │   ├── dev.mts
│   │   ├── errors.ts
│   │   ├── index.ts
│   │   ├── migrations.ts
│   │   ├── progress.ts
│   │   ├── runtime.ts
│   │   ├── transfer.ts
│   │   ├── validation.ts
│   │   └── week.ts
│   ├── tests/
│   │   ├── api.test.ts
│   │   ├── backup.test.ts
│   │   ├── helpers.ts
│   │   ├── import.test.ts
│   │   ├── migrations.test.ts
│   │   └── week.test.ts
│   ├── tsconfig.dev.json
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   ├── components/
│   │   │   ├── AppShell.tsx
│   │   │   ├── CharacterToggleCard.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── EntitySection.tsx
│   │   │   ├── ErrorBanner.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── MatrixGrid.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── ResetCountdown.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── hooks/
│   │   │   ├── useCountdown.ts
│   │   │   └── useTheme.ts
│   │   ├── lib/
│   │   │   ├── format.ts
│   │   │   └── navigation.ts
│   │   ├── pages/
│   │   │   ├── BackupPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ManagePage.tsx
│   │   │   ├── MatrixPage.tsx
│   │   │   └── RunPage.tsx
│   │   ├── state/
│   │   │   ├── AppStateProvider.tsx
│   │   │   └── context.ts
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── index.html
│   └── tsconfig.json
├── .gitignore
├── CLAUDE.md
├── eslint.config.mjs
├── package-lock.json
├── package.json
├── README.md
├── REVIEW.md
├── tsconfig.base.json
├── vite.config.mts
└── vitest.config.mts
```

## 9. Dependencies added and why

Runtime:

| Package | Version | Why |
| --- | --- | --- |
| `better-sqlite3` | 13.0.3 | Synchronous SQLite access and consistent online `db.backup()` |
| `express` | 5.3.0 | HTTP API and static serving |
| `react` | 19.3.1 | Frontend UI |
| `react-dom` | 19.3.1 | React DOM renderer |

Development:

| Package | Version | Why |
| --- | --- | --- |
| `typescript` | 5.9.3 (pinned) | Type checking. Pinned because `typescript-eslint@8` requires `<6.1.0`; configs are compatible with TypeScript 7. |
| `vite` | 8.3.4 | Frontend dev server/build |
| `@vitejs/plugin-react` | 6.1.2 | React JSX transform and Fast Refresh |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | Styling and Vite integration |
| `tsx` | 4.23.15 | Runs the TypeScript dev entry with watch mode |
| `vitest` | 5.0.5 | Unit/integration test runner |
| `supertest` | 7.3.1 | HTTP assertions against the Express app |
| `eslint` + `@eslint/js` | 10.13.0 / 10.0.1 | Linting |
| `typescript-eslint` | 8.71.2 | TypeScript ESLint rules |
| `eslint-plugin-react-hooks` | 7.1.1 | Hook rule enforcement |
| `eslint-plugin-react-refresh` | 0.5.7 | HMR-safe component exports |
| `globals` | 17.13.0 | Browser/Node global definitions for ESLint |
| `@types/node` | 24.19.2 | Node type definitions |
| `@types/express` | 5.0.6 | Express types |
| `@types/better-sqlite3` | 9.6.0 | better-sqlite3 types |
| `@types/react` / `@types/react-dom` | 19.3.0 | React types |
| `@types/supertest` | 7.2.1 | Supertest types |

No dependency was added to fix the TypeScript errors; the fix was a config
change.

## 10. Deviations

### Changes requested during plan approval

1. **Conditional startup backup**: only when no `app-*` backup exists or the
   newest is at least 24 hours old. The running 24-hour timer remains.
2. **Pre-import backups** use the `preimport-` prefix, are always created for a
   valid import, and are retained separately (newest 5). Automatic backups keep
   the newest 14.
3. **Dev data isolation**: `npm run dev` defaults `DN_DATA_DIR` to `data-dev/`;
   the production server uses `data/`. `data-dev/` is gitignored.
4. **Idempotent run API**: `POST /api/runs/toggle` was replaced by
   `PUT /api/runs { characterId, nestId, done }`, returning
   `{ done, weekKey, nextResetAt }`. Tests cover repeated same-state calls.
5. **Name limit**: maximum 50 characters after trimming, enforced in API
   validation, import validation, and UI inputs.
6. **Single-port dev server**: Vite runs in middleware mode with HMR attached
   to the same HTTP server on `127.0.0.1:3000`; no second port is opened.
7. **`README.md`** added with setup, commands, data locations, and manual
   restore steps.
8. **Default tab** is Runs.
9. **Dependency/audit reporting** added to this review; `npm audit` reports
   `found 0 vulnerabilities`.

### Technical deviations and decisions

- **`server/tsconfig.json` now uses `module: "NodeNext"` and
  `moduleResolution: "NodeNext"`** instead of `CommonJS` / `Node`. The old
  `Node` alias resolves to deprecated `node10` resolution, which TypeScript 6+
  warns about and TypeScript 7 removes; NodeNext also makes `@types/node`
  resolution stable. Output remains CommonJS because `package.json` has no
  `"type": "module"`. No `ignoreDeprecations` setting is used: the `"6.0"`
  value is rejected by TypeScript 5.9 (installed locally), and NodeNext needs
  no suppression. This fixes both reported type errors.
- **`.mts` config files**: `vite.config.mts` and `vitest.config.mts` avoid the
  CommonJS config deprecation warning. `server/src/dev.mts` plus
  `server/tsconfig.dev.json` let the ESM Vite entry typecheck while the
  production server stays CommonJS.
- **Express 5 SPA fallback**: a path-less middleware is used instead of
  `app.get('*')`, which Express 5 rejects. It only returns `index.html` for
  HTML GET/HEAD requests without a file extension; missing assets and unknown
  API paths still return 404.
- **Import behavior**: unknown fields are ignored; ids and timestamps are
  preserved; missing timestamps use the import time. Imported `weekKey` must be
  a valid Saturday date.
- **Backup list** includes `kind` in addition to the originally planned fields
  so the UI can distinguish automatic and pre-import backups.
- **Backup timestamps** use WIB and are parsed from the filename rather than
  filesystem mtime.
- **Smoke-test artifacts**: verification created character `Alpha` and nest
  `Manticore` (zero current-week runs) in `data/app.db`, plus one `app-*` and two
  `preimport-*` backups in `data/backups/`. They are inert and can be removed
  through the Manage tab or by deleting the data directory while the server is
  stopped.

## 11. Open questions and assumptions

1. **Unicode duplicate names.** SQLite `NOCASE` and
   `foldNameForComparison()` fold ASCII letters only. Names differing only by
   non-ASCII case (for example `Ä` vs `ä`) can both be stored. Is full Unicode
   case folding wanted? It would require a schema/validation change.
2. **Future imported weeks.** Import accepts any valid Saturday `weekKey`,
   including future dates. Should future weeks be rejected?
3. **Most-remaining cutoff.** The dashboard ranks every character by remaining
   runs; there is no top-N limit. Is a limit wanted for large rosters?
4. **Restore UI.** The Backup page lists backups but does not download or
   restore them. Restoration is manual, as documented in `README.md`. Is an
   in-app restore action needed later?
5. **Startup backup failure.** A startup backup failure is logged but the
   server continues. A pre-import backup failure aborts the import. Confirm the
   non-fatal startup behavior is acceptable.
6. **Reset boundary.** Exactly `08:00:00.000` WIB starts the new week;
   `07:59:59.999` belongs to the previous week. Confirm this convention.
7. **`localhost` and IPv6.** The server binds only to `127.0.0.1`, as required.
   If Windows resolves `localhost` to `::1` first and the browser does not fall
   back, use `http://127.0.0.1:3000`.
8. **Import size asymmetry.** Import bodies are capped at 25 MB, but export has
   no matching cap. A very large export may need to be split before import.
9. **Import identity semantics.** Import preserves ids and timestamps and
   ignores unknown fields. Confirm this replacement behavior is desired.
10. **Backup timestamps source.** Displayed times come from WIB filenames, not
    file modification times. Confirm filename-based timestamps are preferred.
11. **Imported `completedAt`.** Imported run timestamps are accepted if they
    parse as dates; no timezone or range validation beyond that is performed.
12. **Name comparison on the dashboard.** Dashboard tie-breaking uses
    `localeCompare(..., 'en', { sensitivity: 'base' })`, while uniqueness uses
    SQLite NOCASE. These can order or compare non-ASCII names differently.

## 12. How to run

### First-time setup

```bash
cd C:\Users\Nyan\Desktop\DEVMODE\dn-tracker
npm install
```

Requires Node.js 22.12 or newer; tested on Node 24.15.0 with npm 11.12.1.
`better-sqlite3` ships a prebuilt Windows x64 binary.

### Development

```bash
npm run dev
```

Open <http://localhost:3000>. Development data is stored in `data-dev/`.
Vite HMR runs through the same server and port.

### Production (local)

```bash
npm run build
npm start
```

Open <http://localhost:3000>. Production data is stored in `data/`.

### Tests, lint, and type checking

```bash
npm test
npm run lint
npm run build
```

### Manual restore from a backup

1. Stop the server (`Ctrl+C`).
2. Copy the chosen `data/backups/app-*.db` over `data/app.db`.
3. Delete `data/app.db-wal` and `data/app.db-shm` if they exist.
4. Run `npm start` again.

For development data, use `data-dev/` and `data-dev/backups/` instead.
