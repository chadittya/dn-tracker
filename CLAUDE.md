# Dragon Nest Run Tracker

Local-only web app to track which characters have run which nests this week, plus each character's persistent heraldry loadout (8 slots), engraving loadout (14 slots) and card collection. Single user, runs on one PC at http://localhost:3000. No login.

## Stack

- Frontend: Vite + React 19 + TypeScript (strict) + Tailwind CSS 4
- Backend: Node + Express 5 + TypeScript + better-sqlite3
- Database: SQLite file at `data/app.db` (gitignored)
- Tests: Vitest + supertest (node environment, no jsdom/RTL)

## Layout

- `server/` API, DB access, migrations, backup job, week logic
- `web/` React frontend
- `data/` production app.db and `data/backups/` (never commit)
- `data-dev/` development app.db and `data-dev/backups/` (never commit)

## Commands (root package.json)

- `npm run dev` run API + web dev server together
- `npm run build` typecheck + build web
- `npm start` serve API + built web on http://localhost:3000
- `npm test` run all unit/integration tests
- `npm run lint`
- `npm run seed:dev` fill `data-dev/` only with sample characters, nests and runs (no heraldry, engraving or card data; hard-guarded against touching `data/`)

## Business rules (do not change without asking)

- Characters and nests have only a `name` (plus id, created_at). No extra fields in v1.
- Every character is tracked on every nest. No per-character nest exclusion.
- Run status is binary: done / not done. Set it with the idempotent `PUT /api/runs { characterId, nestId, done }`; the server always computes the current `week_key`.
- Weekly reset: every Saturday 08:00 WIB (UTC+7, no DST).
- Reset is NON-destructive. `week_key` = date (YYYY-MM-DD, WIB) of the most recent Saturday 08:00 WIB. A run is "done" only if a runs row exists for the CURRENT week_key. Nothing is deleted at reset.
- Adding a character or nest needs no data backfill: missing run row = not done.
- Removing a character or nest cascades to its runs (UI must confirm first). Removing a character also removes its heraldry slots, engraving slots and cards; the confirmation says so.
- Names (characters, nests, plates, cards) are trimmed, maximum 50 characters, and duplicates are rejected case-insensitively (SQLite NOCASE, ASCII only) within the same table. The frontend duplicate check mirrors this; the server stays authoritative.

### Search, filters and tabs

- Search is client-side, trimmed, case-insensitive "contains" (JS lowercase, no fuzzy). This also applies to combo boxes.
- Filters are not persisted across tab switches (exception: Dashboard row prefill, see below).
- Tab order: Runs, Matrix, Heraldry, Engraving, Cards, Dashboard, Backup, Manage.
- Dashboard row prefill is tab-scoped: a Heraldry row prefills only Heraldry, an Engraving row only Engraving. Back/Forward and manual hash edits clear the one-shot prefill.

### Manage lists (v3.1.1, amended in v3.3)

- Manage lists paginate at 10 records per page (`PAGE_SIZE = 10`): Characters, Nests, Plates, Plate levels and Cards.
- Characters, Nests and Plates are ordered newest first by created date, with id descending as the tie-break (a rename never moves a record). Plate levels stay highest value first.
- **Exception (v3.3): the Cards list is ordered alphabetically A to Z, case-insensitive.** A rename moves the card to its new place.
- Pipeline: sort -> search over ALL records -> paginate. Page state is per list, not persisted, and resets on tab switch.
- Page resets to 1 on search change and after a successful add (including plate level add and card bulk import). Delete and rename keep the page, clamped.
- The pagination footer shows only when the filtered count is above 10. The Manage filter note reads "Filtered to X of N ...".
- This ordering and pagination apply to the Manage lists only. Server response order and the other tabs are unchanged.

### Heraldry (v3.1)

- Every character has `HERALDRY_SLOT_COUNT = 8` heraldry slots. Each filled slot stores one plate, its plate level, rarity (`rare` or `epic`), and whether it has a third stat.
- Heraldry is persistent. The weekly reset does not touch it; there is no `week_key` on heraldry rows and no weekly status.
- Status is computed server-side and never stored:
  - Level rank = position in the levels sorted descending. Rank 0 is the cap, rank 1 is the next level down, and rank 2+ is anything lower.
  - Epic: rank 0 = OK; rank 1 = OK with a third stat, otherwise Recommended; rank 2+ = Needs upgrade.
  - Rare: rank 0 = Recommended with a third stat, otherwise Needs upgrade; rank 1+ = Needs upgrade.
  - Empty slot = Needs upgrade.
- With one level, rank 0 is the only rank, so the rare rank-0 rules still apply. With no levels, there is no cap and stored slots are impossible.
- Plate levels are managed by adding/deleting positive integers. The highest level is the cap. Deleting a level in use is blocked (409 `LEVEL_IN_USE`); deleting an unused level recalculates every status. There is no level rename.
- A character cannot use the same plate in two slots. Deleting a plate empties its slots. Deleting a character cascades to all of its heraldry.
- Copying heraldry replaces every slot on the target character; copying from an empty source leaves the target empty. Source and target must differ.

### Engraving (v3.2)

- Every character has `ENGRAVING_SLOT_COUNT = 14` fixed engraving slots, the same for every class. Categories: weapon (1 Main weapon, 2 Secondary weapon), armor (3 Head, 4 Upper, 5 Lower, 6 Gloves, 7 Boots), accessory (8 Necklace, 9 Earring, 10 Ring 1, 11 Ring 2), wtd (12 Wings, 13 Tail, 14 Decal).
- Engraving is persistent: no `week_key`. There are no statuses, no cap, no max flag and no target grade.
- Grades are fixed and ordered: Rare < Epic < Unique < Legend.
- Value tables live in `engraving_values`, editable in Manage, seeded by migration 3 (136 rows). The seed in `server/src/engravingSeed.ts` is frozen: never edit it.
- Percent values are stored as integer hundredths everywhere (0.28% = 28) in DB, API and export. Parse and format with string/integer math only, no floats.
- Value row rules: category and grade are immutable (delete and re-add); unique key (category, grade, first stat value); paired second stat is required for accessory and wtd and absent for weapon and armor; rows are ordered by grade rank then first stat value, and that order defines "lower than". Editing a row's first stat can change its order and therefore finder results. A row in use cannot be deleted (409 `ENGRAVING_VALUE_IN_USE`). An empty category is allowed.
- Weapon and armor values have only a first stat. Accessory values pair the first stat with Max HP; W/T/D values pair it with Crit. There is no grade or category edit.
- Engraving values may repeat across slots. Deleting a character cascades to all of its engraving.
- Per slot: empty (no DB row) or one engraving: a value row plus an optional third stat. The third stat is a free-typed name (trimmed, 1 to 50 chars) plus a positive percent value; both or neither. The value row's category must match the slot's category (enforced in routes and import, not DDL). Slot bounds are enforced by `parseEngravingSlot` (14); `parseSlot` stays bound 8 (heraldry).
- Lower-than: same category, lower grade, or same grade with lower first stat value. Second and third stats are ignored. Equal is not lower.
- Finder: given a slot and a value, lists characters whose slot is empty or lower. Order: empty first, then lowest, then name. Results are informational only (no click action).
- Export/import behavior is described in "Export and import" below.

### Cards (v3.3)

- Cards are a catalog of card names maintained in Manage. Each character has zero or one entry per card; an entry is the card plus a grade. There is no slot count, no card stats and no value tracking, only name and grade.
- Cards are persistent: no `week_key`, no weekly status.
- Grades are fixed and ordered: Magic < Rare < Epic < Unique < Legend. Colors: Magic green, Rare blue, Epic yellow, Unique purple, Legend red. Rare, Epic, Unique and Legend reuse the engraving grade colors. The grade badge shows icon + text (Magic uses a new icon, defined with the shared grade color definition).
- All card rules (grade order, lower-than, finder, counts) live only in `server/src/cards.ts` as pure functions. The frontend never recomputes grade rank, lower-than or counts.
- Lower-than: the character has no entry for the card, or the entry's grade is below the target grade. Equal or higher is not lower.
- Finder: given a card and a target grade, lists characters who are missing the card or have it below the target grade. Order: missing first, then lowest grade, then name. Results are informational only (no click action). Both the card picker in the finder and the one in the character panel are searchable combo boxes ("contains", case-insensitive).
- Changing a character's grade for a card allows any of the 5 grades, up or down. Adding a card to a character has no default grade (Save stays disabled until card and grade are chosen); cards the character already has are hidden in the add picker.
- Removing a card from a character is immediate, with no confirmation. The panel then shows an info note (for example "Removed Red Dragon from Aria") that stays until the next action in the panel (add, change, remove, or closing the panel). The endpoint is idempotent.
- Cards tab: finder on top, then a character list (search by name, "Cards: N / total" per row, one Clear filters). Clicking a character opens a side panel (dialog on narrow screens), one character at a time. The panel lists that character's cards A to Z with its own search box and "N of M cards" while filtering.
- Deleting a card removes it from every character who has it (cascade). The confirmation shows the count from `GET /api/cards/:id/usage`, for example "12 characters have this card and it will be removed from them". Renaming a card keeps every character's grade.
- Bulk import (Manage): paste names, one per line. Lines are trimmed, empty lines are ignored silently, names over 50 characters are invalid, and names that already exist or are duplicated inside the paste (case-insensitive) are skipped. Valid lines are always added; a paste is never rejected as a whole. The result is a summary only, for example "Added 12, skipped 79 already existing" plus "N invalid lines not added" when relevant.
- Dashboard is untouched by cards.

### Dashboard lists (v2, v3.1, v3.2)

- Heraldry to upgrade: each character once with the most urgent status; sort Needs first, then more Needs slots, more Recommended slots, then name; top 10, "+N more", "View all".
- Engraving empty slots: each character once with the empty count and up to 3 empty slot names plus "+N"; sort most empty then name; top 10, "+N more", "View all" (switches tab only).
- Both lists are shown outside the all-runs-done branch. A character with no data counts as fully empty until data is entered (accepted).

## Export and import

- Export JSON is `version: 4`. Import accepts versions 1 to 4. All validation happens before the preimport backup and before applying; an invalid import changes nothing and creates no backup.
- Version 2 added `plateLevels`, `plates`, `characterHeraldry`.
- Version 3 added `engravingValues` (object with arrays `weapon`, `armor`, `accessory`, `wtd`; rows with explicit ids, grade, firstStatValue, secondStatValue) and `characterEngraving` (characterId, slot, valueId, thirdStatName, thirdStatValue). Empty category arrays are valid, missing arrays are invalid.
- Version 4 adds the card catalog (`cards`: id and name) and each character's cards with grades (`characterCards`: characterId, cardId, grade). Exact field names are fixed in the v3.3 plan and then recorded here.
- A version 4 file replaces the card catalog and all character cards.
- Versions 1, 2 and 3 have no card data: importing one KEEPS the current card catalog and CLEARS every character's cards. The confirmation dialog says so.
- Older-version behavior for earlier data is unchanged: version 1 clears heraldry; versions 1 and 2 clear all character engraving but keep the current engraving value tables.
- Import result counts include `engravingValues`, `engravingSlots`, `cards` and `cardSlots` (older versions report 0 for data they do not contain).

## Database rules

- Tables: characters, nests, runs, plate_levels, plates, character_heraldry, engraving_values, character_engraving, cards, character_cards.
- runs: (character_id, nest_id, week_key, completed_at), PRIMARY KEY (character_id, nest_id, week_key). Toggle = insert/delete the row.
- plate_levels: `value INTEGER NOT NULL UNIQUE CHECK (value > 0)`; the level value is the natural key.
- plates: id, name, created_at. character_heraldry: (character_id, slot, plate_id, level, rarity, has_third_stat), PRIMARY KEY (character_id, slot), UNIQUE (character_id, plate_id).
- character_heraldry has `CHECK (slot >= 1)`; the upper bound is enforced by routes, validation and import, not DDL.
- engraving_values: id, category (weapon/armor/accessory/wtd), grade (rare/epic/unique/legend), first_stat_value > 0, second_stat_value (NULL for weapon/armor, > 0 for accessory/wtd), UNIQUE (category, grade, first_stat_value).
- character_engraving: (character_id, slot, value_id, third_stat_name, third_stat_value), PRIMARY KEY (character_id, slot), `CHECK (slot >= 1)`, third stat both NULL or name length 1 to 50 (trimmed) and value > 0. `value_id` references engraving_values(id) ON DELETE RESTRICT. Index `idx_character_engraving_value_id`.
- cards (migration 4): `id`, `name COLLATE NOCASE UNIQUE`, `created_at`.
- character_cards (migration 4): `character_id` FK ON DELETE CASCADE, `card_id` FK ON DELETE CASCADE, `grade` CHECK in (magic, rare, epic, unique, legend), PRIMARY KEY (character_id, card_id), index on `card_id`.
- `PRAGMA foreign_keys = ON`, WAL mode. Character, plate and card references use `ON DELETE CASCADE`; `character_heraldry.level` and `character_engraving.value_id` use `ON DELETE RESTRICT`.
- Names use `COLLATE NOCASE` with a UNIQUE constraint.
- Schema changes only via ordered migrations tracked with `PRAGMA user_version` (currently 4 after v3.3). Migrations run automatically on server start, inside a transaction. NEVER edit migrations 1, 2, 3 or 4 once shipped; any schema change needs a new migration. The server refuses to start on a newer schema.
- Before the first start after a schema change, the client copies the whole `data/` folder.
- Use parameterized queries only. Never build SQL with string concatenation.

## API summary

- State: `GET /api/state` (week info, characters, nests, runs, dashboard, heraldry block, engraving block, cards block). Health: `GET /api/health`.
- Core: `POST/PATCH/DELETE /api/characters[/:id]`, `POST/PATCH/DELETE /api/nests[/:id]`, `PUT /api/runs`.
- Heraldry: `/api/heraldry/levels`, `/api/heraldry/plates`, `PUT /api/heraldry/slots`, `DELETE /api/heraldry/slots/:characterId/:slot`, `POST /api/heraldry/copy`.
- Engraving: `/api/engraving/values` (POST, PATCH/:id, DELETE/:id, GET/:id/usage), `GET /api/engraving/finder?slot=&valueId=`, `PUT /api/engraving/slots`, `DELETE /api/engraving/slots/:characterId/:slot`.
- Cards: `POST/PATCH/DELETE /api/cards[/:id]`, `GET /api/cards/:id/usage`, `POST /api/cards/import`, `GET /api/cards/finder?cardId=&grade=`, `PUT /api/character-cards`, `DELETE /api/character-cards/:characterId/:cardId` (idempotent).
- Backups and data: `GET /api/backups`, `GET /api/data/export`, `POST /api/data/import`.
- Errors use `{ error: { code, message } }` with optional `details`. Unknown `/api/*` returns a JSON 404.

## Backup rules

- On server start: create an automatic backup only if no `app-*.db` exists or the newest one is older than 24h. While running, create one every 24h.
- Automatic copies use better-sqlite3 `db.backup()` into `data/backups/app-YYYYMMDD-HHmmss.db` (WIB timestamp). All tables, including heraldry, engraving and cards, are included automatically.
- Always create `preimport-YYYYMMDD-HHmmss.db` before a valid JSON import. If that backup fails, the import aborts.
- Retention, pruned independently: newest 14 `app-*` and newest 5 `preimport-*`. The Backup page lists both kinds.

## Code rules

- All week/time logic lives in `server/src/week.ts` as pure functions with an injectable `now`. Never call `new Date()` elsewhere for week logic.
- All heraldry status logic lives in `server/src/heraldry.ts`, all engraving rules in `server/src/engraving.ts`, and all card rules in `server/src/cards.ts`, as pure functions. The frontend renders what the API returns and never recomputes ranks, statuses, lower-than or counts.
- Percent parsing and formatting on the frontend live in `web/src/lib/engraving.ts` and use string/integer math only, never float multiplication or `toFixed`. Values cross the API as integer hundredths.
- The API returns `weekKey` and `nextResetAt`; the frontend uses these and never recomputes week boundaries itself.
- Server binds to 127.0.0.1 only. Dev serves Vite through the same HTTP server on port 3000; no second port is opened.
- Dev uses `data-dev/` by default (override with `DN_DATA_DIR`); production uses `data/`.
- UI components contain no business logic; use hooks and an API client module. Pure web helpers live in `web/src/lib/` (search, names, dashboard, heraldry, engraving, cards, navigation, ordering, pagination).
- Validate all API input. Return consistent JSON errors. The JSON import route accepts up to 25 MB; all other routes keep Express's default body limit.
- Keep dependencies minimal. Ask before adding any new dependency.
- Do not guess unspecified requirements: list them under "Open questions" in the report instead of inventing behavior.

## Design

- Modern, clean, simple. Dark mode by default, with light toggle.
- Large tap/click targets. Marking or unmarking a run is one click.
- Grade badges always show icon + text, never color alone.
