# Dragon Nest Run Tracker

Local-only web app for tracking which characters have run which nests this week.
Single user, no login. Runs at <http://localhost:3000> and binds to `127.0.0.1`
only.

Weekly reset happens every Saturday 08:00 WIB (UTC+7). The reset is
non-destructive: past runs stay in the database, and a run counts as done only
when it was recorded for the current week.

## Requirements

- Node.js 22.12 or newer (tested on Node 24.15)
- npm

## First-time setup

```bash
npm install
```

`better-sqlite3` ships prebuilt binaries for common platforms, including
Windows x64. No C++ build tools are needed.

## Run in development

```bash
npm run dev
```

Open <http://localhost:3000>. Vite serves the frontend through the same Express
server and port (HMR included); no second port is opened.

Development uses a separate database directory, `data-dev/`, so testing never
touches your real data. Set `DN_DATA_DIR` before running if you want a different
location.

## Run in production locally

```bash
npm run build
npm start
```

Open <http://localhost:3000>. The built frontend is served from `dist/web`, and
the database lives in `data/`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API + frontend dev server on port 3000, data in `data-dev/` |
| `npm run build` | Typecheck server and web, build frontend into `dist/` |
| `npm start` | Serve the built app and API on port 3000, data in `data/` |
| `npm test` | Run unit and integration tests with Vitest |
| `npm run lint` | Run ESLint |

## Data and backups

- Production database: `data/app.db` (SQLite, WAL mode).
- Development database: `data-dev/app.db`.
- Automatic backups: `data/backups/app-YYYYMMDD-HHmmss.db`, created on server
  start when the newest is older than 24 hours, and then every 24 hours while
  the server runs. The newest 14 `app-*` backups are kept.
- Before every successful JSON import, a backup named
  `preimport-YYYYMMDD-HHmmss.db` is created. The newest 5 `preimport-*` backups
  are kept.
- Timestamps in backup filenames are WIB.
- The Backup page lists both kinds and can export or import all data as JSON.
  Importing replaces all current data after confirmation.

`data/` and `data-dev/` are gitignored. Do not commit or edit these files
manually.

## Restore from a backup (manual)

1. Stop the server with `Ctrl+C` (or close the terminal running it).
2. In `data/backups/`, pick the backup to restore, for example
   `app-20261017-114033.db`.
3. Copy that file over `data/app.db`, replacing the current database.
4. Delete `data/app.db-wal` and `data/app.db-shm` if they exist. Leaving stale
   WAL files next to a replaced database can corrupt the restore.
5. Start the server again with `npm start`.

For development data, repeat the same steps using `data-dev/` and
`data-dev/backups/`.

## Week rules

- A week starts Saturday 08:00 WIB and ends at the next Saturday 08:00 WIB.
- Exactly 08:00:00.000 WIB starts the new week.
- Runs from previous weeks are kept but do not count as done for the current
  week.
- Adding a character or nest needs no backfill: every character is tracked
  against every nest, and a missing run row means "not done".
- Deleting a character or nest also deletes its run records.
