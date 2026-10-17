# Dragon Nest Run Tracker

Local-only web app to track which characters have run which nests this week.
Single user, runs on one PC at http://localhost:3000. No login.

## Stack

- Frontend: Vite + React + TypeScript (strict) + Tailwind CSS
- Backend: Node + Express + TypeScript + better-sqlite3
- Database: SQLite file at `data/app.db` (gitignored)
- Tests: Vitest

## Layout

- `server/` API, DB access, migrations, backup job, week logic
- `web/` React frontend
- `data/` production app.db and `data/backups/` (never commit)
- `data-dev/` development app.db and `data/backups/` (never commit)

## Commands (root package.json)

- `npm run dev` run API + web dev server together
- `npm run build` typecheck + build web
- `npm start` serve API + built web on http://localhost:3000
- `npm test` run all unit/integration tests
- `npm run lint`

## Business rules (do not change without asking)

- Characters and nests have only a `name` (plus id, created_at). No extra fields in v1.
- Every character is tracked on every nest. No per-character nest exclusion.
- Run status is binary: done / not done. Set it with the idempotent
  `PUT /api/runs { characterId, nestId, done }`; the server always computes
  the current `week_key`.
- Weekly reset: every Saturday 08:00 WIB (UTC+7, no DST).
- Reset is NON-destructive. `week_key` = date (YYYY-MM-DD, WIB) of the most
  recent Saturday 08:00 WIB. A run is "done" only if a runs row exists for the
  CURRENT week_key. Nothing is deleted at reset.
- Adding a character or nest needs no data backfill: missing run row = not done.
- Removing a character or nest cascades to its runs (UI must confirm first).
- Names are trimmed, maximum 50 characters, and duplicates are rejected
  case-insensitively within the same table.

## Database rules

- Tables: characters, nests, runs.
- runs: (character_id, nest_id, week_key, completed_at), PRIMARY KEY
  (character_id, nest_id, week_key). Toggle = insert/delete the row.
- `PRAGMA foreign_keys = ON` and `ON DELETE CASCADE` on runs foreign keys.
- Names use `COLLATE NOCASE` with a UNIQUE constraint.
- Schema changes only via ordered migrations tracked with `PRAGMA user_version`.
  Migrations run automatically on server start, inside a transaction.
- Use parameterized queries only. Never build SQL with string concatenation.

## Backup rules

- On server start: create an automatic backup only if no `app-*.db` exists or
  the newest one is older than 24h. While running, create one every 24h.
- Automatic copies use better-sqlite3 `db.backup()` into
  `data/backups/app-YYYYMMDD-HHmmss.db` (WIB timestamp).
- Always create `preimport-YYYYMMDD-HHmmss.db` before a valid JSON import.
- Retention, pruned independently: newest 14 `app-*` and newest 5
  `preimport-*`. The Backup page lists both kinds.

## Code rules

- All week/time logic lives in `server/src/week.ts` as pure functions with an
  injectable `now`. Never call `new Date()` elsewhere for week logic.
- The API returns `weekKey` and `nextResetAt`; the frontend uses these and never
  recomputes week boundaries itself.
- Server binds to 127.0.0.1 only. Dev serves Vite through the same HTTP server
  on port 3000; no second port is opened.
- Dev uses `data-dev/` by default (override with `DN_DATA_DIR`); production
  uses `data/`.
- UI components contain no business logic; use hooks and an API client module.
- Validate all API input. Return consistent JSON errors. The JSON import route
  accepts up to 25 MB; all other routes keep Express's default body limit.
- Keep dependencies minimal. Ask before adding any new dependency.
- Do not guess unspecified requirements: list them under "Open questions" in
  the report instead of inventing behavior.

## Design

- Modern, clean, simple. Dark mode by default, with light toggle.
- Large tap/click targets. Marking or unmarking a run is one click.
