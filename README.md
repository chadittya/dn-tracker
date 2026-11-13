# Dragon Nest Run Tracker

Local-only web app for tracking which characters have run which nests this week,
plus each character's persistent heraldry, engraving and card collection. Single
user, no login. Runs at <http://localhost:3000> and binds to `127.0.0.1` only.

Weekly reset happens every Saturday 08:00 WIB (UTC+7). The reset is
non-destructive: past runs stay in the database, and a run counts as done only
when it was recorded for the current week.

## Requirements

- Node.js 22.12 or newer within 22.x, 24.x, or 26+ (tested on Node
  26.13.1)
- npm

## First-time setup

```bash
npm install
```

On Windows, `better-sqlite3` may compile from source with `node-gyp`. If
`npm install` fails with a "Could not find any Visual Studio installation"
error:

1. Install Visual Studio 2022 Build Tools with the "Desktop development with
   C++" workload.
2. Approve the install scripts for `better-sqlite3` and `esbuild`:
   `npm install-scripts approve better-sqlite3` and
   `npm install-scripts approve esbuild`.
3. Run `npm install` again.

The approvals are saved in `package.json` under `allowScripts`, so they stay
with the project.

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
the database lives in `data/`. After any code change, run `npm run build` again
before using `start.bat`.

## Commands

| Command            | What it does                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `npm run dev`      | API + frontend dev server on port 3000, data in `data-dev/`                                   |
| `npm run build`    | Typecheck server and web, build frontend into `dist/`                                         |
| `npm start`        | Serve the built app and API on port 3000, data in `data/`                                     |
| `npm test`         | Run unit and integration tests with Vitest                                                    |
| `npm run lint`     | Run ESLint                                                                                    |
| `npm run seed:dev` | Fill `data-dev/` with sample characters, nests and runs (see the note below) |

## Manage page

- The page lists six sections in this order: Characters, Nests, Plates, Plate
  levels, Engraving values, Cards. On wide screens a sticky sidebar links to
  each section and highlights the section in view; on narrow screens the links
  form a scrollable chip row.
- Adding an item shows a note such as `Added Raven.` or `Added Level 70.`.
  There is one note per list, replaced by the next add, rename, delete or
  search change. If the active search hides the new record, the note says so.
  The Cards bulk-import summary uses the same slot.
- Lists paginate at 10 records per page. Characters, nests and plates are
  newest first, plate levels highest first, and cards A to Z.
- Engraving values are grouped into one collapsible section per grade. When a
  category has data, all four grades are shown, including empty ones. Sections
  start closed, remember their open state per category while you stay on
  Manage, and are never collapsed by adding, editing or deleting a value. The
  add-value form stays above the grade sections.

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
  Importing replaces all current data after confirmation. Which records are
  kept depends on the file version, listed below.
- Export files use `version: 4` and include heraldry, engraving and cards.
  Import accepts versions 1 to 4.
  - Version 1 files clear current heraldry (plate levels, plates and slots).
  - Version 2, 3 and 4 files replace current heraldry with the file's
    heraldry.
  - Version 1 and 2 files clear current character engraving but keep the
    current engraving value tables.
  - Version 3 and 4 files replace current engraving value tables and character
    engraving with the file's data.
  - Version 1, 2 and 3 files have no card data: they clear every character's
    cards but keep the current card list.
  - Version 4 files replace plate levels, plates, heraldry slots, engraving
    values, character engraving, the card list, and character cards.
- Schema version 4 means v3.2 and older builds refuse to open the database.
  Copy the whole `data/` folder before the first start after an upgrade, and
  restore it before running an older build.

The `seed:dev` script itself creates no heraldry, engraving or card data. It
leaves existing catalogs (plate levels, plates, engraving values, cards) in
place; per-character heraldry, engraving and card rows are removed with the old
characters through the FK cascades.

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

## Heraldry rules

- Every character has 8 heraldry slots. A filled slot stores a plate, a plate
  level, rarity (Rare or Epic), and whether it has a third stat.
- Heraldry persists across weekly resets. It is not part of run progress.
- Add plate levels and plates on the Manage page. The highest level is the
  current cap. A character cannot use the same plate in two slots.
- Status is computed by the server from the level rank (highest level = rank 0,
  next = rank 1, lower = rank 2+), rarity, and third stat:

  | Rarity | Rank 0                                               | Rank 1                                    | Rank 2+       |
  | ------ | ---------------------------------------------------- | ----------------------------------------- | ------------- |
  | Epic   | OK                                                   | OK with third stat, otherwise Recommended | Needs upgrade |
  | Rare   | Recommended with third stat, otherwise Needs upgrade | Needs upgrade                             | Needs upgrade |

- An empty slot counts as Needs upgrade.
- Deleting a used level is blocked. Deleting an unused level recalculates all
  statuses. Deleting a plate empties its slots. Deleting a character deletes
  their heraldry.
- Copying heraldry replaces all slots on the target character with the source
  character's slots.

## Engraving rules

- Every character has 14 fixed engraving slots: Main weapon, Secondary weapon,
  Head, Upper, Lower, Gloves, Boots, Necklace, Earring, Ring 1, Ring 2, Wings,
  Tail, and Decal.
- Slots use four value tables: Weapon (slots 1-2), Armor (3-7), Accessory
  (8-11), and W/T/D (12-14). A filled slot stores a grade, the value's stats,
  and an optional free-text third stat with its own value.
- Grades are Rare, Epic, Unique, and Legend. Percent rates are stored as
  hundredths, so `0.28%` is `28`, and the UI accepts up to two decimals.
- Engraving persists across weekly resets.
- Find a slot to upgrade by choosing a slot, grade, and value. The finder lists
  characters with an empty slot or a lower value; equal or higher values are
  excluded.
- Add, edit, and delete engraving values on the Manage page, grouped into the
  four category tabs and collapsible grade sections. Deleting a value in use is
  blocked.
- Editing a value's first stat can change its row order and the finder's
  lower-than results.
- The Dashboard lists characters with the most empty engraving slots.
- Deleting a character deletes their engraving.

## Card rules

- The card list is maintained on the Manage page: add a card, rename it, delete
  it, or bulk import names. Each character can have each card at one of five
  grades: Magic, Rare, Epic, Unique, Legend (lowest to highest). Only the card
  name and grade are tracked, not card stats.
- Cards persist across weekly resets.
- The Cards tab has a finder on top: choose a card (type to search) and a target
  grade. It lists characters with no card first, then the lowest grade, then by
  name. Characters at or above the target grade are excluded. Results are
  informational only.
- Below the finder is the character list with a card count per character. Click
  a character to open their card panel, where you can add a card, change its
  grade (up or down), or remove it. Removing a card is immediate.
- The character panel lists cards A to Z, 10 per page, with its own search over
  all of that character's cards. Panel notes report the last action (`Added`,
  `Changed`, `Removed`, or an import summary) until the next panel action, a
  search change, or closing the panel.
- Bulk import: paste card names, one per line. Names that already exist or are
  repeated in the paste are skipped, empty lines are ignored, and names over 50
  characters are reported as invalid. Valid names are always added, and the
  result is a short summary. If any line is invalid, the pasted text stays in
  the box so it can be corrected; re-importing is safe because existing names
  are skipped. The bulk import request is limited to 100 KB.
- Import cards for one character: in the character panel, choose Import cards
  and paste one `Card name, Grade` per line. Each line splits on its last
  comma, so card names may contain commas. Names and grades are matched
  case-insensitively (ASCII only); empty lines are ignored. Unknown cards,
  unknown grades, lines without a comma, and empty names or grades are invalid.
  When a card appears more than once, the first valid line wins and later lines
  are skipped as duplicates. Existing grades are overwritten and the import is
  applied in one transaction. Invalid lines stay in the box (duplicates
  removed) for correction. A line imported later still overwrites a grade that
  a following valid line applied for the same card. The request is limited to
  100 KB.
- The Manage card list is sorted A to Z, 10 per page, with search over all cards.
  Characters, nests and plates keep newest first; plate levels stay highest
  value first.
- Deleting a card removes it from every character who has it; the confirmation
  shows how many characters are affected. Renaming a card keeps every
  character's grade. Deleting a character deletes their cards.
- The Dashboard does not list cards.
