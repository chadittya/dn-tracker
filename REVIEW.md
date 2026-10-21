# Review — Dragon Nest Run Tracker v3.1 Heraldry

## 1. Summary

v3.1 adds persistent heraldry tracking for every character:

- 8 slots per character, each storing a plate, plate level, rarity, and
  whether the plate has a third stat.
- Heraldry is independent of the weekly run reset.
- Status is always computed server-side from level rank, rarity, and third
  stat. No status is stored in the database.
- Migration 2 adds `plate_levels`, `plates`, and `character_heraldry`.
- `GET /api/state` gains an additive `heraldry` block; existing fields are
  unchanged.
- New endpoints manage levels, plates, slots, clearing, and copying.
- Export is now `version: 2`; import accepts version 1 and version 2. A
  version 1 import clears current heraldry.
- The frontend gains a Heraldry tab after Matrix, a Dashboard upgrade list,
  Manage sections for levels/plates, and backup/import copy updates.

No new dependency was added. Week/reset behavior, v1/v2 run tracking, and
existing API response fields are unchanged.

The v2 review remains in git history.

## 2. Requirement checklist

### Data and status rules

- [x] Migration 2 creates `plate_levels`, `plates`, and
      `character_heraldry`.
- [x] One plate per slot; one plate use per character enforced by
      `UNIQUE (character_id, plate_id)`.
- [x] Slot storage has `CHECK (slot >= 1)`; the upper bound of 8 is enforced
      by `HERALDRY_SLOT_COUNT` in validation, routes, and import.
- [x] Character deletes cascade to heraldry; plate deletes empty slots; used
      levels are protected by `ON DELETE RESTRICT` plus a route pre-check.
- [x] Level rank: descending position, rank 0 = cap, rank 1 = next lower,
      rank 2+ = lower.
- [x] Epic rank 0 = OK; epic rank 1 = OK with third stat, otherwise
      Recommended; epic rank 2+ = Needs upgrade.
- [x] Rare rank 0 = Recommended with third stat, otherwise Needs upgrade;
      rare rank 1/2+ = Needs upgrade.
- [x] Empty slot = Needs upgrade.
- [x] Single-level and empty-level-list cases behave as approved.
- [x] Status, ranks, `perCharacter` counts, and empty-slot expansion live in
      pure `server/src/heraldry.ts`.
- [x] The frontend never recomputes ranks or statuses.

### API

- [x] `GET /api/state` adds `heraldry` with `slotCount`, sorted levels, cap,
      plates, a full `slotCount` grid for every character, and
      `perCharacter` summaries.
- [x] `POST/DELETE /api/heraldry/levels` with duplicate and in-use errors.
- [x] `POST/PATCH/DELETE /api/heraldry/plates`.
- [x] `PUT /api/heraldry/slots` with full validation, upsert, and duplicate
      plate conflict details.
- [x] `DELETE /api/heraldry/slots/:characterId/:slot` is idempotent.
- [x] `POST /api/heraldry/copy` replaces all target slots in one transaction
      and rejects same-character copies.
- [x] Structured `details` are additive on errors; existing error shape is
      unchanged.
- [x] All SQL is parameterized.

### Import/export and backups

- [x] Export is `version: 2` and includes `plateLevels`, `plates`, and
      `characterHeraldry`.
- [x] Import accepts versions 1 and 2.
- [x] Version 2 validates the file's own level, plate, and character
      references before applying anything.
- [x] Invalid files still change nothing and create no backup.
- [x] Valid imports create `preimport-*` before replacing data.
- [x] Version 1 files clear current heraldry.
- [x] Automatic SQLite backups include the new tables through
      `db.backup()` without extra code.
- [x] Import result counts now include plate levels, plates, and heraldry
      slots.

### Frontend

- [x] Heraldry tab appears after Matrix.
- [x] Grid shows 8 slots per character, sticky header/first column, filled and
      empty states, third-stat marker, and status badges.
- [x] Character, plate, and status filters work together; empty slots only
      match the status filter, never a plate filter.
- [x] Slot editor supports plate, level, Set to cap, Epic/Rare, third stat,
      save, clear, and copy with a confirmation using `slotCount`.
- [x] Plates already used by the same character are disabled in the editor.
- [x] Manage adds plate-level management and the Plates entity section.
- [x] Level delete confirmation states the resulting cap and that all
      statuses are recalculated.
- [x] Level-in-use errors list the first 5 affected slots and `+N more`.
- [x] Rank-shift notes appear after adding below the cap and after deleting a
      level that leaves lower levels.
- [x] Dashboard shows the heraldry upgrade list outside the all-runs-done
      branch, sorted needs before recommended, with slot-order plate names,
      `+N`, and `N empty`.
- [x] Dashboard row click prefills the Heraldry character search.
- [x] View all opens Heraldry without a prefill.
- [x] No-levels and no-plates states are handled.
- [x] Character/plate delete warnings mention heraldry effects.
- [x] Backup page copy and success counts mention heraldry and version 1
      clearing behavior.

### Documentation and constraints

- [x] `CLAUDE.md` documents heraldry rules, database tables, status rules,
      `HERALDRY_SLOT_COUNT`, export version 2, and v1/v2 import behavior.
- [x] `README.md` documents heraldry and import/export behavior.
- [x] No new dependency.
- [x] No SQL string concatenation.
- [x] Existing 77 tests still pass; new coverage added.

## 3. Key implementation details

### Prefill hashchange guard

`navigate()` records the hash it is about to set in `pendingHashRef`.
`keepsHeraldryPrefillOnHashChange(pendingHash, currentHash)` returns true only
when the incoming hashchange matches that pending hash. Back/forward and
manual hash edits have no matching pending hash, so they clear the one-shot
prefill. This decision is covered by `web/src/lib/navigation.test.ts`.

### Empty slots

The database stores only filled slots. `buildHeraldryState` expands every
character to exactly `HERALDRY_SLOT_COUNT` entries, so the API and frontend
receive a complete grid and the server remains the only status authority.

### Level deletion

The route queries affected character/plate/slot rows before deleting. A used
level returns `409 LEVEL_IN_USE` with `details.affectedCount` and
`details.affectedSlots`; the database `ON DELETE RESTRICT` remains a second
line of defense.

### Import replacement order

The transaction deletes in dependency order:

`character_heraldry -> plates -> plate_levels -> runs -> characters -> nests`

then inserts characters/nests, levels, plates, runs, and heraldry. Validation
runs before the backup and before the transaction.

## 4. Files

### Created

| File | Purpose |
| --- | --- |
| `server/src/heraldry.ts` | Pure slot count, rank, status, and state builders. |
| `server/src/heraldryData.ts` | DB reads for levels, plates, rows, and state. |
| `server/src/routes/heraldry.ts` | Levels, plates, slots, clear, and copy API. |
| `server/tests/heraldry.test.ts` | Full status rule table, ranks, state summaries, single/empty levels. |
| `server/tests/heraldry-api.test.ts` | API validation, cascade, conflict, clear, copy, and level-in-use tests. |
| `web/src/lib/heraldry.ts` | Pure grid filters and Dashboard upgrade list. |
| `web/src/lib/heraldry.test.ts` | Filter, sort, cap, plate-name, and no-mutation tests. |
| `web/src/lib/ordering.ts` | Shared name comparison and limit normalization. |
| `web/src/lib/navigation.test.ts` | Prefill hashchange decision tests. |
| `web/src/components/HeraldryStatusBadge.tsx` | Icon + text status badges. |
| `web/src/components/HeraldryGrid.tsx` | Full slot grid with sticky headers. |
| `web/src/components/HeraldrySlotEditor.tsx` | Slot editor and copy flow. |
| `web/src/components/PlateLevelSection.tsx` | Level add/delete UI and rank-shift notes. |
| `web/src/pages/HeraldryPage.tsx` | Heraldry filters, grid, and editor integration. |

### Modified

| File | Change |
| --- | --- |
| `server/src/migrations.ts` | Migration 2 and exported migration list. |
| `server/src/app.ts` | Mounts `/api/heraldry`. |
| `server/src/errors.ts` | Optional error `details` and FK error helper. |
| `server/src/validation.ts` | Positive integer, slot bound, rarity, and boolean parsers. |
| `server/src/routes/state.ts` | Adds the heraldry state block. |
| `server/src/transfer.ts` | Export v2, import v1/v2, heraldry validation/replacement. |
| `web/src/api/types.ts` | Heraldry and import result types. |
| `web/src/api/client.ts` | Heraldry API methods and typed error details. |
| `web/src/lib/navigation.ts` | Heraldry tab, navigate options, prefill helper. |
| `web/src/App.tsx` | Heraldry route and hashchange-safe prefill. |
| `web/src/pages/DashboardPage.tsx` | Heraldry upgrade list and row prefill. |
| `web/src/pages/ManagePage.tsx` | Level/plate management and delete warnings. |
| `web/src/pages/BackupPage.tsx` | Heraldry export/import copy and counts. |
| `web/src/components/ConfirmDialog.tsx` | Optional children for level-in-use details. |
| `server/tests/import.test.ts` | v2 round-trip, v1 clearing, and invalid heraldry cases. |
| `server/tests/migrations.test.ts` | v1-to-v2 upgrade and FK behavior. |
| `CLAUDE.md`, `README.md` | Heraldry rules, tables, and export/import version docs. |

`server/src/seed-dev.ts` was intentionally not changed.

## 5. Code review follow-ups

The `/code-review` pass found no user-facing defects in the happy path, plus
one real driver-specific error mapping gap and several duplication issues. All
were addressed:

- `isForeignKeyConstraintError` now also recognizes
  `SQLITE_CONSTRAINT_TRIGGER`, which SQLite uses for `ON DELETE RESTRICT`
  violations. A regression test forces the fallback path.
- The foreign-key fallback now returns the same `affectedCount` /
  `affectedSlots` details as the normal in-use path. If no joined slot details
  are available, the Manage dialog shows the server message instead of
  remaining silent.
- `buildSlotState` and `buildHeraldryState` share one slot construction helper.
- Export reuses `readLevels`, `readPlates`, and `readHeraldryRows`.
- Dashboard and heraldry lists share `compareNames` and `normalizeLimit` from
  `web/src/lib/ordering.ts`.

## 6. Test results

Commands run:

```text
npm test
npm run lint
npm run build
```

Results:

- `npm test`: **120 passed** across **12 test files**. The original 77 tests
  still pass, plus 43 new tests.
- `npm run lint`: passed with no errors or warnings.
- `npm run build`: passed server typecheck, dev typecheck, web typecheck, and
  the Vite production build.

New coverage includes:

- Every status-rule row, including single-level and empty-level behavior.
- Rank changes after inserting a level in the middle.
- Full-grid expansion, empty-slot counts, and most-urgent summaries.
- Level add/duplicate/delete/in-use details.
- Plate add/rename/delete, case-insensitive duplicates, and cascade.
- Slot validation for unknown references, slots 0/9, invalid rarity, and
  non-boolean third stat.
- Upsert and duplicate-plate conflicts.
- Idempotent clear and copy replacement/empty-source behavior.
- Character-delete cascade.
- Migration v1-to-v2 upgrade and FK cascade/restrict behavior.
- Forced foreign-key fallback mapping to `LEVEL_IN_USE` details.
- Import v2 round-trip, v1 heraldry clearing, and all specified invalid
  payloads.
- Frontend filters, Dashboard sorting/capping/plate names, and prefill
  hashchange decisions.

## 7. Manual acceptance checklist

Automated tests cannot exercise the visual layout or real browser history
events. The following browser checks remain:

1. Manage: add levels 30/27/25 and plates; add a level below the cap and
   confirm the rank-shift note; try deleting a used level and confirm the
   resulting-cap message plus the first-5/`+N more` list; delete a middle
   level and confirm the post-delete rank-shift note.
2. Heraldry: fill slots covering every status; verify badges use icon + text,
   empty cells, legend, filters, `Showing X of Y`, one Clear filters, editor
   defaults, disabled used plates, Set to cap, clear, and copy confirmation
   using 8 slots.
3. Dashboard: verify sorting, caps, plate names in slot order, `+N`,
   `N empty`, row-click prefill, and View all without prefill.
4. Prefill/hashchange browser check:
   - enter a Heraldry search, switch to Dashboard, click a row, and confirm
     the character name is prefilled;
   - press Back then Forward and confirm the prefill clears;
   - use View all and confirm no prefill.
   The decision function behind this is covered by unit tests; the browser
   event wiring still needs this manual pass.
5. Backup: export v2, import it, import an old v1 file (clears heraldry), and
   confirm an invalid file changes nothing and creates no backup.
6. Check dark/light mode and sticky header/first column with a horizontally
   scrolling grid.

## 8. Pending decision and open points

1. **`seed:dev` heraldry data**: still awaiting the client's yes/no. No seed
   data for levels, plates, or slots was implemented.
2. **Browser visual acceptance**: not performed in this environment. API,
   build, and pure logic are covered by automated tests; the checklist above
   remains for the client's final visual pass.
3. No other deviations from the approved plan were introduced.
