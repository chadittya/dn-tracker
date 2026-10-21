# Dragon Nest Run Tracker

Local-only web app to track which characters have run which nests this week,
plus each character's persistent 8-slot heraldry loadout. Single user, runs on
one PC at http://localhost:3000. No login.

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

### Heraldry (v3.1)

- Every character has `HERALDRY_SLOT_COUNT = 8` heraldry slots. Each filled
  slot stores one plate, its plate level, rarity (`rare` or `epic`), and
  whether it has a third stat.
- Heraldry is persistent. The weekly reset does not touch it; there is no
  `week_key` on heraldry rows and no weekly status.
- Status is computed server-side and never stored:
  - Level rank = position in the levels sorted descending. Rank 0 is the cap,
    rank 1 is the next level down, and rank 2+ is anything lower.
  - Epic: rank 0 = OK; rank 1 = OK with a third stat, otherwise Recommended;
    rank 2+ = Needs upgrade.
  - Rare: rank 0 = Recommended with a third stat, otherwise Needs upgrade;
    rank 1+ = Needs upgrade.
  - Empty slot = Needs upgrade.
- With one level, rank 0 is the only rank, so the rare rank-0 rules still
  apply. With no levels, there is no cap and stored slots are impossible.
- Plate levels are managed by adding/deleting positive integers. The highest
  level is the cap. Deleting a level in use is blocked; deleting an unused
  level recalculates every status. There is no level rename.
- A character cannot use the same plate in two slots. Plate names use the same
  trim, maximum length, and case-insensitive uniqueness rules as characters and
  nests. Deleting a plate empties its slots. Deleting a character cascades to
  all of its heraldry.
- Copying heraldry replaces every slot on the target character; copying from an
  empty source leaves the target empty. Source and target must differ.
- Export JSON is `version: 2` and includes `plateLevels`, `plates`, and
  `characterHeraldry`. Import accepts version 1 and version 2. A version 1
  file has no heraldry arrays, so importing one clears current heraldry.

## Database rules

- Tables: characters, nests, runs, plate_levels, plates, character_heraldry.
- runs: (character_id, nest_id, week_key, completed_at), PRIMARY KEY
  (character_id, nest_id, week_key). Toggle = insert/delete the row.
- plate_levels: `value INTEGER NOT NULL UNIQUE CHECK (value > 0)`; the level
  value is the natural key.
- plates: id, name, created_at. character_heraldry:
  (character_id, slot, plate_id, level, rarity, has_third_stat), PRIMARY KEY
  (character_id, slot), UNIQUE (character_id, plate_id).
- character_heraldry has `CHECK (slot >= 1)`; the upper bound
  `HERALDRY_SLOT_COUNT` is enforced by routes, validation, and import, not by
  database DDL.
- `PRAGMA foreign_keys = ON`. Runs, plate references, and character references
  use `ON DELETE CASCADE`; `character_heraldry.level` uses
  `ON DELETE RESTRICT`.
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
- All heraldry status logic lives in `server/src/heraldry.ts` as pure functions.
  The frontend renders the status returned by the API and never recomputes
  ranks or statuses.
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
