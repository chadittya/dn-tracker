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

# Review — Dragon Nest Run Tracker v3.1.1 Manage pagination

## 1. Summary

v3.1.1 paginates the four Manage lists without changing any API, schema,
business rule, or dependency:

- Characters, Nests, Plates, and Plate levels show 10 records per page.
- Characters, Nests, and Plates are ordered newest first by created date, with
  id descending as the tie-break. Renaming does not move a record.
- Plate levels stay highest value first (cap first).
- Search still runs over all records, then matches are paginated. Each list has
  independent page state that resets on tab switch through the existing
  Manage unmount.
- The pagination footer shows Previous/Next, `Page X of Y`, and
  `Showing a–b of N` only when the filtered list has more than 10 records.
- Adding resets to page 1. Delete and rename keep the current page, clamped to
  the new last page when the list shrinks.

The Manage filter note now reads `Filtered to X of N ...` so it does not
duplicate the pagination range line. Adding while a non-matching search is
active keeps the search and shows a polite note that the new record is hidden.

## 2. Requirement checklist

- [x] One page-size constant, `PAGE_SIZE = 10`, in
      `web/src/lib/pagination.ts`.
- [x] Characters, Nests, Plates ordered created date DESC, id DESC; rename does
      not move a record.
- [x] Plate levels ordered value DESC and cap first.
- [x] Ordering applies to Manage only; server response order is unchanged.
- [x] Pipeline is source -> sort -> search filter -> paginate.
- [x] Page resets on search change (including clear) and on successful add.
- [x] Page stays after delete/rename and clamps when the current page no longer
      exists; empty list resolves to page 1.
- [x] Independent, non-persisted page state per list; resets on tab switch.
- [x] Controls appear only when the filtered count exceeds 10.
- [x] Previous/Next disabled at the ends, `Page X of Y`, and
      `Showing a–b of N` with an en dash.
- [x] `nav` landmark has a label; Previous/Next have `aria-label`; disabled
      state uses the native attribute and text, not color alone.
- [x] Live existing matches (max 5, `+N more`) and the duplicate warning use
      the unsorted source list and are unaffected by pagination.
- [x] Add works with an active search; non-matching adds show a status note.
- [x] `FilterStatus.tsx` is untouched.
- [x] Other tabs' wording and ordering are untouched.

## 3. Key implementation details

### Pure helpers

`web/src/lib/pagination.ts` owns `PAGE_SIZE`, page-count and clamp logic,
slicing, range text, and page-status text. Page count is always at least 1;
empty lists resolve to page 1. Slicing returns a new array and never mutates
the source.

`web/src/lib/ordering.ts` gains `compareCreatedAtDesc`,
`sortEntitiesForManage`, and `sortLevelsDesc`. Timestamps are compared with
`Date.parse`, so imported ISO strings with offsets are compared as instants.
Equal or invalid timestamps fall back to id DESC. The comparators never return
`NaN`, and sorting copies the input.

### Shared component

`web/src/components/Pagination.tsx` returns `null` when the filtered total is
10 or less, which is the single place the visibility rule lives. It renders a
labelled `nav`, the range line, a polite live page status, and native
`disabled` buttons.

### Page state and clamping

Both sections keep raw `page` state and render from the clamped
`paginate(...)` result. A small effect writes the clamped page back to state,
so a stale high page cannot reappear if the list later grows. Search changes
and successful adds reset explicitly to page 1; delete and rename never reset.

### Manage ordering

`EntitySection` sorts its raw `items` with `sortEntitiesForManage` before
filtering. `analyzeAddName` still receives the original unsorted `items`, so
the v2 match preview order and `+N more` count are unchanged. `PlateLevelSection`
sorts a copy of `levels` with `sortLevelsDesc` for display; `capAfterDelete`
still derives from the full descending `levels` prop, so the delete
confirmation and cap badge behave as before.

## 4. Files

Created:

| File | Purpose |
| --- | --- |
| `web/src/lib/pagination.ts` | Page size, clamping, slicing, and range/status text. |
| `web/src/lib/pagination.test.ts` | Page count, slicing, clamping, range, and no-mutation tests. |
| `web/src/lib/ordering.test.ts` | Created-date sorting, id tie-break, offsets, invalid timestamps, no mutation. |
| `web/src/components/Pagination.tsx` | Shared accessible Manage pagination footer. |

Modified:

| File | Change |
| --- | --- |
| `web/src/lib/ordering.ts` | Added created-date comparator, Manage entity sort, level sort. |
| `web/src/components/EntitySection.tsx` | Manage sort/filter/paginate pipeline, page resets, add status note, `Filtered to` wording. |
| `web/src/components/PlateLevelSection.tsx` | Level pagination, add reset, clamped page state. |
| `CLAUDE.md` | Notes Manage ordering, 10-per-page pagination, and Manage-only scope. |

No changes: `web/src/components/FilterStatus.tsx`, `web/src/pages/ManagePage.tsx`,
server code, API, schema, `vitest.config.mts`, `package.json`.

## 5. Confirmations

- `FilterStatus.tsx` was not modified. Its component and behavior are
  unchanged; only the message string passed by `EntitySection` changed, and
  only for Manage. Runs, Matrix, Heraldry, and Dashboard pass their own
  messages and keep their existing wording.
- Other tabs' ordering is untouched: the server still returns characters,
  nests, and plates by `name COLLATE NOCASE, id`, and levels by value DESC.
  Sorting was added inside the Manage-only `EntitySection` and
  `PlateLevelSection`; no shared server route or other page consumes it.
- No API, schema, business-rule, or dependency change was made.

## 6. Test results

Commands run:

```text
npm test
npm run lint
npm run build
```

Results:

- `npm test`: **146 passed** across **14 test files** (previous 120 plus 26
  new pagination/ordering tests).
- `npm run lint`: passed with no errors or warnings.
- `npm run build`: passed server typecheck, dev typecheck, web typecheck, and
  the Vite production build.

New coverage includes:

- `PAGE_SIZE`, page counts for 0/1/10/11/20/21, and sanitized totals.
- Clamping below 1, above the last page, fractions, non-finite values,
  shrinking lists, and empty lists.
- Slicing for empty, 1, 10, 11, 20, and 21 items, including first/middle/last
  boundaries.
- Range text for first/middle/last page, page status, source-order
  preservation, and no mutation.
- Created-date DESC sorting, id DESC tie-break, equal timestamps, different ISO
  offsets, invalid timestamps, no `NaN`, rename stability, and no mutation.
- Level descending sort and no mutation.

## 7. Manual acceptance checklist

Automated tests cover the pure helpers; the following browser checks remain:

1. Characters with more than 10 records: 10 rows, correct range line,
   Previous disabled on page 1, Next disabled on the last page.
2. Newest record first; rename does not move it.
3. Search across multiple pages: page resets on every query change, and the
   filter note reads `Filtered to X of N ...`.
4. Add from page 2: resets to page 1 and the new record is first. Add while a
   non-matching search is active: search remains and the hidden-by-search note
   appears.
5. Rename on page 2 stays on page 2. Delete the last record of the last page:
   clamped to the new last page.
6. Repeat for Nests and Plates.
7. Plate levels over 10: value DESC with the Cap badge; add resets to page 1;
   delete stays or clamps and still names the correct new cap.
8. Confirm Runs, Matrix, Heraldry, and Dashboard wording and ordering are
   unchanged.
9. Check dark/light mode, keyboard navigation, visible focus, and the
   Previous/Next aria-labels.

## 8. Open points

None. Both approved consequences were implemented as agreed: a below-cap level
added from a later page resets to page 1 (and may not be visible there), and
the Manage filter note wording changes to `Filtered to X of Y`.

# Review — Dragon Nest Run Tracker v3.2 Engraving

## 1. Summary

v3.2 adds persistent engraving tracking for every character:

- 14 fixed slots per character, mapped to Weapon, Armor, Accessory, and W/T/D
  categories.
- Each filled slot stores a grade, a value row's first and optional paired
  second stat, and an optional third stat with its own value.
- Four editable value tables are managed from the Manage page and seeded by
  migration 3 with 136 values (34 per category).
- The finder lists characters with an empty slot or a lower value; equal and
  higher values are excluded.
- Migration 3 adds `engraving_values` and `character_engraving`. Schema version
  becomes 3.
- `GET /api/state` gains an additive `engraving` block.
- Export is now `version: 3`; import accepts versions 1, 2, and 3.
- The frontend gains the Engraving tab after Heraldry, Manage value tables, and
  a Dashboard empty-slot list.
- Engraving status is not stored and there are no status badges, no cap, no
  target grade, no copy, no bulk entry, and no history.

No new dependency was added. Week/reset behavior, run tracking, Heraldry
business rules, and existing API fields are unchanged.

## 2. Requirement checklist

### Data and rules

- [x] `ENGRAVING_SLOT_COUNT = 14` with the approved slot labels and category
      mapping in `server/src/engraving.ts`.
- [x] Grades ordered `rare < epic < unique < legend`.
- [x] Values stored as integer hundredths everywhere; UI uses string/integer
      parsing and formatting only.
- [x] Migration 3 creates both new tables, the value FK index, and seeds all
      136 rows.
- [x] Seed data is frozen in `engravingSeed.ts` with shape assertions and is
      not edited after migration 3.
- [x] Weapon and armor values have no second stat; Accessory pairs Max HP and
      W/T/D pairs Crit.
- [x] Slot upper bound and category matching are route/import-enforced, not
      DDL-enforced.
- [x] Character deletes cascade to engraving; value deletes are restricted
      while in use.
- [x] Editing a value's first stat can reorder rows and change finder
      lower-than results; this is documented in CLAUDE.md.

### API

- [x] `GET /api/state` adds the sorted `engraving` block with slot
      definitions, categories, grades, four value tables, all slots, and
      per-character empty counts.
- [x] Value CRUD with category/grade immutability, paired-stat validation,
      duplicate `409 DUPLICATE_ENGRAVING_VALUE`, and usage endpoint.
- [x] In-use delete returns `409 ENGRAVING_VALUE_IN_USE` with affected
      character/slot details and a foreign-key fallback.
- [x] Finder validates slot/value, rejects category mismatches, and returns
      empty-first then lower-value results.
- [x] Slot upsert validates character/value refs, slot bounds, category match,
      and third-stat pairs.
- [x] Blank or whitespace third-stat name with a value returns
      `400 VALIDATION_ERROR`; the value is never silently dropped.
- [x] Repeated slot deletes are idempotent.
- [x] All SQL is parameterized.

### Import/export

- [x] Export is `version: 3` with four category arrays using explicit ids and
      `characterEngraving`.
- [x] Import accepts versions 1, 2, and 3. Version 1/2 clears character
      engraving but keeps current value tables; version 3 replaces both.
- [x] Missing category arrays are invalid; empty arrays are valid.
- [x] v3 validates ids, natural keys, stats, references, slots, category
      matches, duplicate slots, and third-stat pairs before backup or change.
- [x] Invalid imports change nothing and create no preimport backup.
- [x] Import counts include `engravingValues` and `engravingSlots`; v1/v2
      report zero.

### Frontend

- [x] Engraving tab sits after Heraldry in the exact tab order.
- [x] Two-row sticky grid header, sticky first column, category groups, slot
      filter showing one column, grade badge, compact stats, and third-stat
      dot with title/aria-label.
- [x] Finder selects slot, grade, and value; results are informational only.
- [x] Successful slot save or clear re-runs the finder for the current
      selection.
- [x] Search filters characters; the slot filter is a view choice and is
      included in filter-active state.
- [x] Clear filters resets both search and slot filter. `Showing X of Y` is
      based on the search only.
- [x] Editor validates third-stat pairs inline, including blank name + value,
      and keeps the value visible instead of dropping it.
- [x] Manage has four category sub-tabs, 34 rows per tab, add/edit/delete,
      grade/category frozen on edit, and the singular/plural in-use edit note.
- [x] In-use delete shows the blocking character/slot list before confirmation.
- [x] Dashboard engraving list is outside the all-runs-done branch, sorts by
      empty count then name, shows three slot names + `+N`, caps at 10, and
      keeps the v2 empty state.
- [x] Dashboard row click prefills only Engraving; the Heraldry row prefills
      only Heraldry. Navigation tests cover both directions.
- [x] Backup export/import copy and success counts cover engraving and
      version-specific clearing.

## 3. Deviations from the plan

1. `v3.2` already existed and was the current branch at the same commit as
   `main` when implementation began, so no new branch was created.
2. `Project_Context_v1.md` was not updated. It explicitly describes the v1
   scope and status and is a historical document, so it was not treated as
   maintained v3.2 documentation.
3. Two small pure helpers were added beyond the named plan helpers:
   `formatPercentInput` (for editable percent inputs) and `parseTabFromHash`
   (so hash parsing is testable without a DOM). Neither changes behavior.
4. The in-use blocking dialog reuses `ConfirmDialog` with a `Close` action
   instead of introducing a separate dialog component. The blocking list still
   appears before any delete confirmation.
5. The migration test was extended with engraving CHECK/UNIQUE/RESTRICT/CASCADE
   cases and an explicit v2-to-v3 preservation case, beyond the minimum wording
   in the test list.
6. Browser manual acceptance was not performed in this environment; the
   checklist in section 6 remains for the final visual pass.

No business rule from the approved plan was changed.

## 4. Files

Created:

| File | Purpose |
| --- | --- |
| `server/src/engraving.ts` | Pure slots, grades, ordering, lower-than, state, and finder logic. |
| `server/src/engravingSeed.ts` | Frozen 136-row seed with shape assertions. |
| `server/src/engravingData.ts` | DB reads for values, rows, single values, and state. |
| `server/src/routes/engraving.ts` | Values, usage, finder, and character slots API. |
| `server/tests/engraving.test.ts` | Domain rules, expansion, defensive cases, finder ordering. |
| `server/tests/engraving-api.test.ts` | Full API validation, usage, finder, cascade, FK fallback. |
| `web/src/lib/engraving.ts` | Percent helpers, filtering, slot visibility, Dashboard list. |
| `web/src/lib/engraving.test.ts` | All specified percent cases plus filters and list behavior. |
| `web/src/pages/EngravingPage.tsx` | Finder, filters, grid, editor, and mutation wiring. |
| `web/src/components/EngravingFinder.tsx` | Controlled slot/grade/value finder and results. |
| `web/src/components/EngravingGrid.tsx` | Two-row sticky grid with slot filtering. |
| `web/src/components/EngravingSlotEditor.tsx` | Slot editor with inline third-stat validation. |
| `web/src/components/EngravingGradeBadge.tsx` | Icon + text grade badge. |
| `web/src/components/EngravingValuesSection.tsx` | Category tabs, value CRUD, usage notes and blocks. |

Modified:

| File | Change |
| --- | --- |
| `server/src/migrations.ts` | Migration 3, tables, index, and seed call. |
| `server/src/app.ts` | Mounts `/api/engraving`. |
| `server/src/routes/state.ts` | Adds the engraving state block. |
| `server/src/transfer.ts` | Export v3, import v1/v2/v3, engraving validation and replacement. |
| `server/src/validation.ts` | Engraving slot, category, and grade parsers. |
| `server/tests/migrations.test.ts` | v2 upgrade, full 136-row seed, constraint tests. |
| `server/tests/import.test.ts` | v3 round-trip, empty/missing arrays, v1/v2 clearing, invalid matrix. |
| `server/tests/api.test.ts` | Engraving slot-count state assertion. |
| `web/src/api/types.ts` | Engraving types, AppState block, import counts. |
| `web/src/api/client.ts` | Engraving API methods and error details. |
| `web/src/lib/navigation.ts` | Engraving tab, tab-scoped prefill helpers. |
| `web/src/lib/navigation.test.ts` | Tab order, hash parsing, prefill isolation. |
| `web/src/App.tsx` | Engraving route and tab-scoped prefill. |
| `web/src/pages/DashboardPage.tsx` | Engraving empty-slot list and row prefill. |
| `web/src/pages/ManagePage.tsx` | Engraving value tables and delete warning. |
| `web/src/pages/BackupPage.tsx` | Version-aware copy, counts, and descriptions. |
| `CLAUDE.md`, `README.md` | Engraving rules, tables, migration, and export/import v3. |

No changes were made to migrations 1 and 2, `server/src/seed-dev.ts`, or
existing run/week/Heraldry/backup business rules.

## 5. Test results

Commands run:

```text
npm test
npm run lint
npm run build
```

Results:

- `npm test`: **203 passed** across **17 test files**.
- `npm run lint`: passed with no errors or warnings.
- `npm run build`: passed server typecheck, dev typecheck, web typecheck, and
  the Vite production build.

New coverage includes:

- All 136 seeded rows compared against the expected series, plus pair
  examples and v2-to-v3 preservation.
- Engraving CHECK, UNIQUE, RESTRICT, and CASCADE behavior.
- Every specified `parsePercentInput` case, including `0.29`, `0.57`, `1.15`,
  `.5`, trimmed spaces, and rejected comma/trailing-dot/exponent/sign/
  three-decimal/empty/non-numeric inputs.
- Domain ordering, lower-than semantics, state expansion, empty counts,
  defensive missing values, and finder empty-first/name tie-breaks.
- API value CRUD, duplicates, immutability, usage, in-use blocking, FK
  fallback, finder validation, slot validation, blank-name-with-value 400,
  idempotent delete, cascade, and value edits reflected in slots.
- v3 round-trip, empty category arrays, missing arrays, v1/v2 clearing,
  replacement counts, and the full invalid-v3 matrix.
- Navigation tab order, Engraving hash parsing, and Heraldry/Engraving
  prefill isolation.

## 6. Manual acceptance checklist

Automated tests cannot exercise the visual layout or real browser history
events. The following browser checks remain:

1. Engraving grid: sticky two-row header and first column, horizontal scroll,
   category group headers, single-column slot filter, grade badge plus compact
   stats, and third-stat dot tooltip.
2. Finder: empty slots first, lower values next, equal/higher excluded; save
   and clear a slot and confirm the finder refreshes without reselecting.
3. Editor: grade buttons, filtered values, paired second stat, third-stat
   checkbox, blank-name-with-value inline error, save, and clear.
4. Dashboard: empty-slot sorting, three names + `+N`, top 10, View all, row
   click prefill, and the all-filled message. Confirm the list stays visible
   when every run is done.
5. Manage: four category tabs, 34 rows each, add/edit/delete, duplicate error,
   in-use edit note singular/plural, and the blocking delete list.
6. Backup: export v3, v3 round-trip, v2 import clears engraving but keeps the
   value tables, v1 import also clears heraldry, and an invalid import leaves
   the database unchanged with no preimport backup.
7. Dark/light mode and large tap targets.

## 7. Open questions

None. The approved plan covered the behavior implemented here.

---

# Review — Dragon Nest Run Tracker v3.3 Cards

## 1. Summary

v3.3 adds a card catalog and a persistent, per-character grade for each card:

- The catalog stores a name only. Every character has zero or one entry per
  card, with one of five ordered grades: Magic < Rare < Epic < Unique < Legend.
- Card data is independent of the weekly reset. There is no `week_key` and no
  weekly status.
- All grade, lower-than, finder and count rules are pure functions in
  `server/src/cards.ts`. The API returns the catalog, character entries,
  per-character counts and finder results; the frontend renders them.
- Migration 4 adds `cards` and `character_cards`.
- `GET /api/state` gains an additive `cards` block.
- New endpoints manage cards, usage, bulk import, the finder and character
  grades.
- The frontend gains a Cards tab after Engraving, with a finder, a character
  list, a character side panel and a new Manage section for the catalog.
- Export is now `version: 4`; import accepts versions 1 to 4. Version 4
  replaces the card catalog and all character cards. Versions 1 to 3 keep the
  current catalog and clear every character's cards.

No new dependency was added. Week/reset behavior, runs, heraldry, engraving,
Dashboard content and `seed:dev` are unchanged.

### Key decisions

- Migration 4 was appended. Migrations 1 to 3 were not edited. The
  `cards.created_at` default is exactly the same expression used by migration 1
  and the other tables.
- Card names use SQLite ASCII `NOCASE` uniqueness. Card ordering uses an ASCII
  fold plus Unicode code-point comparison, with id as the tie-break. This
  matches SQLite's NOCASE ordering and deliberately avoids `localeCompare`.
- `parseCardGrade` lives in `server/src/cards.ts`, importing the existing name
  helpers from `validation.ts`. No new name module was created and there is no
  import cycle.
- Grade colors reuse the engraving colors for Rare through Legend. Magic adds a
  green definition with the `○` icon. Badges always show icon plus text.
- The ComboBox is dependency-free. Typing activates the first match so Enter
  selects it. Escape with the list open closes only the list; Escape with the
  list closed reaches the panel and closes it.
- `CardCharacterPanel` is rendered with `key={characterId}`, so switching
  characters resets the note, add form and grade editor.
- Bulk import clears the textarea only when `invalid === 0`. When any line is
  invalid, the paste is kept for correction. Re-import is safe because
  existing names are skipped.
- Bulk import keeps Express's default 100 KB body limit. Only
  `/api/data/import` has a larger limit.

## 2. Requirement mapping

### Data and domain

- [x] Migration 4 creates `cards` (`id`, unique NOCASE `name`, `created_at`)
      and `character_cards` (`character_id`, `card_id`, `grade`, composite
      primary key), with the card-id index and both cascades.
- [x] `character_cards.grade` is constrained to `magic`, `rare`, `epic`,
      `unique`, `legend`.
- [x] Grades are fixed and ordered Magic < Rare < Epic < Unique < Legend.
- [x] A character has at most one row per card. Changing a grade is an upsert
      in either direction.
- [x] Card data has no `week_key` and is untouched by the weekly reset.
- [x] Grade order, lower-than, finder building, per-character counts, catalog
      sorting and bulk-import planning are pure functions in
      `server/src/cards.ts`.
- [x] The finder includes only characters with no entry or a lower grade.
      Equal and higher grades are excluded. Order is missing first, then lowest
      grade, then name, then id.
- [x] The frontend does not recompute grade rank, lower-than or catalog counts.
      Filtered-result counts such as `N of M cards` are presentation counts of
      the visible list.

### API and Manage

- [x] `POST /api/cards`, `PATCH /api/cards/:id`, `DELETE /api/cards/:id` with
      validation, 404 and case-insensitive duplicate errors.
- [x] `GET /api/cards/:id/usage` returns `affectedCount` and the affected
      characters for the delete confirmation.
- [x] Renaming a card keeps every character's grade.
- [x] Deleting a card cascades to every character.
- [x] `POST /api/cards/import` accepts `{ text }`, trims lines, ignores empty
      lines, rejects names over 50 characters, and skips existing or in-paste
      duplicate names. Valid lines are always inserted in one transaction.
- [x] `GET /api/cards/finder?cardId=&grade=` validates the id, grade and card,
      and returns the card, target grade and ordered results.
- [x] `PUT /api/character-cards` validates character, card and grade and
      upserts. `DELETE /api/character-cards/:characterId/:cardId` is
      idempotent and returns 404 only for an unknown character.
- [x] Deleting a character cascades to their cards. The Manage character delete
      warning mentions cards.
- [x] Manage Cards supports add, live duplicate matches, rename, delete,
      search and bulk import.
- [x] The Manage Cards list is sorted A to Z, unlike the newest-first
      Characters, Nests and Plates lists. Pipeline is sort, search all,
      paginate; 10 per page; footer only above 10.
- [x] Page resets on search and successful add or bulk import. Delete and
      rename keep the page, clamped.
- [x] The delete confirmation uses the server usage count and the singular or
      plural wording.
- [x] The bulk-import summary reports added, skipped and invalid counts. The
      textarea is cleared only when there are no invalid lines.

### Cards tab

- [x] Tab order is Runs, Matrix, Heraldry, Engraving, Cards, Dashboard, Backup,
      Manage.
- [x] Finder uses a searchable card combo and five target-grade buttons. It
      sends no request until both are chosen.
- [x] Finder results show "No card" or the grade badge plus "Below target".
      They are informational only and have no click action.
- [x] The finder refreshes after every add, grade change or removal through
      `refresh()` plus a nonce.
- [x] The character list shows `Cards: N / total` from the server summaries,
      supports name search, one Clear filters, and "Showing X of Y characters".
- [x] Opening a character shows a side panel on wide screens and a dialog on
      narrow screens, one character at a time.
- [x] The panel lists that character's cards A to Z with its own search and
      `N of M cards` while filtering.
- [x] Add card uses a searchable combo with owned cards hidden. There is no
      default grade; Add stays disabled until both card and grade are chosen.
- [x] Grade editing offers all five grades up or down. Save is disabled when
      the grade is unchanged.
- [x] Remove is immediate with no confirmation. The panel shows
      `Removed {card} from {character}` until the next add, grade change,
      removal or close.
- [x] Grade badges always show icon plus text. Magic is green; Rare through
      Legend reuse engraving colors. Contrast was checked in light and dark
      mode.

### Export, import and backups

- [x] Export is `version: 4` and adds `cards` (`id`, `name`, `createdAt`) and
      `characterCards` (`characterId`, `cardId`, `grade`) in stable id order.
- [x] Import accepts versions 1 to 4. Version 4 requires both arrays; empty
      arrays are valid. Each character card must reference a character and card
      in the same file, have a valid grade, and be unique per
      character/card pair.
- [x] All validation happens before the preimport backup and before any
      database change. Invalid imports create no backup and change nothing.
- [x] Version 4 replaces the catalog and all character cards. Versions 1 to 3
      keep the current catalog and clear all character cards.
- [x] Older behavior is unchanged: v1 clears heraldry; v1/v2 clear character
      engraving but keep value tables; v3 replaces both.
- [x] Import result counts include `cards` and `cardSlots`; older versions
      report zero for both.
- [x] Automatic and preimport SQLite backups include card tables without extra
      code.

## 3. Changed files

Server, modified:

- `server/src/app.ts`
- `server/src/migrations.ts`
- `server/src/routes/state.ts`
- `server/src/transfer.ts`
- `server/tests/import.test.ts`
- `server/tests/migrations.test.ts`

Server, new:

- `server/src/cards.ts`
- `server/src/cardsData.ts`
- `server/src/routes/cards.ts`
- `server/tests/cards.test.ts`
- `server/tests/cards-api.test.ts`

Web, modified:

- `web/src/App.tsx`
- `web/src/api/client.ts`
- `web/src/api/types.ts`
- `web/src/lib/engravingColors.ts`
- `web/src/lib/navigation.ts`
- `web/src/lib/navigation.test.ts`
- `web/src/pages/BackupPage.tsx`
- `web/src/pages/ManagePage.tsx`

Web, new:

- `web/src/lib/cards.ts`
- `web/src/lib/cards.test.ts`
- `web/src/components/CardCharacterList.tsx`
- `web/src/components/CardCharacterPanel.tsx`
- `web/src/components/CardGradeBadge.tsx`
- `web/src/components/CardsFinder.tsx`
- `web/src/components/CardsSection.tsx`
- `web/src/components/ComboBox.tsx`
- `web/src/pages/CardsPage.tsx`

Docs:

- `CLAUDE.md`
- `README.md`
- `REVIEW.md`

No package or dependency changes. No changes to `data/`.

## 4. Test results

Commands run from the repository root:

```text
npm test
npm run lint
npm run build
```

Results after the final code edits:

- `npm test`: **234 passed** across **20 test files**.
- `npm run lint`: passed with no errors or warnings.
- `npm run build`: passed server typecheck, dev typecheck, web typecheck, and
  the Vite production build.

New and updated coverage includes:

- Card grade ranks, lower-than, ASCII-fold comparator, catalog sorting,
  state building, finder ordering and bulk-import planning.
- Card CRUD, duplicate rejection, A→Z state ordering, usage and cascade,
  rename preserving grades, grade upsert in both directions, idempotent
  removal, character cascade, bulk import and finder validation.
- Fresh migration to version 4, v3→v4 upgrade preserving existing data,
  card constraints and cascades, and the shared `created_at` format.
- v4 export/import round trip with cards, counts, v1/v2/v3 catalog retention
  and character-card clearing, v4 replacement, missing and invalid card
  arrays, unknown references, duplicate pairs and invalid grades.
- Web card sorting, filtering, option building, count and summary formatting,
  and the updated tab order and `#/cards` hash.

Vitest runs in a node environment with no jsdom or RTL, so ComboBox keyboard
behavior, the side panel, and visual contrast remain manual checks.

## 5. Documentation changes

- `CLAUDE.md` Dashboard lists now include:
  - Most remaining: top 10, sorted by remaining then name, View all to Matrix.
  - Nests needing runs: top 5, sorted by remaining then name, View all to Runs.
  - The all-runs-done replacement, and the fact that only the heraldry and
    engraving lists stay outside that branch.
- `CLAUDE.md` v4 export fields are now recorded exactly: `cards` uses `id`,
  `name`, `createdAt`; `characterCards` uses `characterId`, `cardId`, `grade`;
  both arrays are required and may be empty. The previous "fixed in the plan"
  placeholder was removed.
- `CLAUDE.md` documents the `cards.created_at` default and confirms it matches
  the other tables.
- `CLAUDE.md` API summary records the bulk-import `{ text }` body, the default
  100 KB limit, and the character-card delete 404 behavior.
- `README.md` documents the finder order (missing, lowest grade, then name)
  instead of only the exclusion rule.
- `README.md` documents that an invalid bulk-import paste stays in the box and
  that re-import is safe, and that the bulk-import request is limited to
  100 KB.
- No unresolved doc/code contradiction remains after the audit.

## 6. Assumptions and open questions

1. The bulk-import request body is `{ text: string }` and stays under Express's
   default 100 KB limit, as chosen. A future larger import needs a limit
   decision.
2. `skipped` combines names already in the catalog and duplicates inside the
   paste. `invalid` counts only trimmed names over 50 characters. Empty lines
   count nowhere. First occurrence wins and keeps its casing.
3. Exported card `createdAt` is optional on import, matching plates. A missing
   value falls back to the import timestamp.
4. `DELETE /api/character-cards/:characterId/:cardId` returns 404 only for an
   unknown character. An unknown card or absent row returns 204.
5. Change-grade Save is disabled when the selected grade equals the current
   grade.
6. The Cards tab character list is not paginated; the spec did not ask for it.
7. With an empty catalog, the finder is disabled with a Manage note, the add
   combo is replaced by a note, and character rows show `Cards: 0 / 0`.
8. The finder requires both a card and a grade. Selecting one alone sends no
   request and shows no results.
9. Older import files that contain card fields are ignored for those versions,
   not rejected.
10. Card ordering uses ASCII fold plus code-point comparison. This intentionally
    differs from the engraving finder's `localeCompare`; non-ASCII names may
    order differently between the two features.
11. Bulk import returns HTTP 200 and a summary only; the request is not
    rejected as a whole.
12. The Cards Manage section sits below the engraving value tables.
13. No forced-failure rollback test exists for bulk import. Validation and the
    single-transaction insert are covered, but a synthetic mid-paste database
    failure was not induced.

## 7. Manual acceptance checklist

Automated tests cannot exercise the browser UI. After `npm run dev` (which uses
`data-dev/` only), check:

1. Manage → Cards: add cards, rename one, delete one, and confirm A→Z order,
   10 per page, search, and page reset on search and add.
2. Bulk import a mix of valid names, an existing name, an in-paste duplicate,
   an empty line and a name over 50 characters. Confirm the summary, that
   valid lines were added, that the A→Z page reset, and that the textarea is
   kept with an invalid line and cleared without one.
3. Delete a card in use. Confirm the usage count wording, then that it is
   removed from every character. Rename a card and confirm grades survive.
4. Cards tab finder at each of the five grades: missing first, then lowest
   grade, then name; equal/higher grades excluded; "No card" and "Below" shown
   correctly.
5. Open a character. Confirm cards A→Z, own search with `N of M cards`, add
   combo hiding owned cards, no default grade, Add disabled until both are
   chosen, any-direction grade change, and immediate remove with the note.
6. Confirm the finder re-runs after every add, grade change and removal.
7. ComboBox: type text and press Enter to select the first match. Escape with
   the list open closes only the list; Escape with the list closed closes the
   character panel.
8. Switch directly from one character's panel to another and confirm the note,
   add form and grade editor are reset.
9. Character list: `Cards: N / total`, name search, one Clear filters, and
   "Showing X of Y characters".
10. Manage → Characters: the delete warning mentions cards, and deleting a
    character removes their cards.
11. Backup: export is version 4 with `cards` (`id`, `name`, `createdAt`) and
    `characterCards`; import it back. Import an old v3 file and confirm the
    catalog is kept and every character's cards are cleared. Check the v1/v2/v3
    confirmation wording.
12. Confirm Dashboard is unchanged, `seed:dev` still seeds no cards, and the
    Magic badge is green with icon plus text in both themes.

## Follow-up (v3.3 review)

This follow-up changed tests and documentation only. No product behavior,
migration, API contract or dependency changed.

### 1. Version 4 replacement confirmed

`POST /api/data/import` runs all validation before creating the pre-import
backup (`server/src/transfer.ts:703-706`). The apply transaction then deletes:

- `character_cards` always (`:710`), and `cards` for version 4 (`:711-713`);
- `character_engraving` always (`:715`), and `engraving_values` for versions 3
  and 4 (`:716-718`);
- `character_heraldry`, `plates` and `plate_levels` always (`:720-722`).

It reinserts the validated arrays. Therefore a version 4 file replaces all
seven tables requested: `engraving_values`, `character_engraving`,
`plate_levels`, `plates`, `character_heraldry`, `cards` and
`character_cards`.

Old-version retention is confirmed: v1/v2 keep `engraving_values`; v1/v2/v3
keep `cards`; `character_cards` is always cleared and only v4 repopulates it.
v2/v3/v4 replace heraldry from the file.

### 2. Round-trip and invalid-import coverage

`server/tests/import.test.ts` now has:

- A full snapshot helper covering all ten tables (`:20-60`).
- In the v4 round trip (`:555`), a whole-payload assertion after import
  (`:581`) plus final-state assertions for heraldry, engraving and cards. The
  same file contains all three domains.
- In the invalid-import test (`:825`), seeded rows in every table, a guard that
  every snapshot array is non-empty, and per-case assertions that the whole
  database and backup directory are unchanged (`:1484-1487`). This covers
  version 5, missing `cards`, missing `characterCards`, invalid grade, unknown
  card, unknown character, duplicate `(character, card)`, duplicate card ids,
  duplicate names case-insensitively, blank name, and name over 50 characters.

### 3. Backup success message

`web/src/pages/BackupPage.tsx:129-143` includes both
`result.imported.cards` and `result.imported.cardSlots`. No change needed.

### 4. Documentation audit

Verified against code with no change needed:

- Stack majors and test environment: React 19.3.1, Express 5.3.0,
  better-sqlite3 13.0.3, Tailwind 4.3.3, Vite 8.3.4, Vitest 5.0.5, TypeScript
  5.9.3, supertest 7.3.1, `strict: true`, Vitest `environment: 'node'`, no
  jsdom/RTL.
- Tab order: Runs, Matrix, Heraldry, Engraving, Cards, Dashboard, Backup,
  Manage, matching `web/src/lib/navigation.ts:22-31` and its test.
- Export field names: `cards` = id/name/createdAt and `characterCards` =
  characterId/cardId/grade (`server/src/transfer.ts:94-119`).
- v1/v2/v3 import behavior, including the delete conditions and reinserts.
- Engraving third-stat rules: both-or-neither, trimmed 1-50 characters,
  positive integer value, and category matching, in the route, import and DDL.
- Dashboard run, heraldry and engraving list limits, sorting and navigation.
- Card finder order: missing first, then lowest grade, then name.
- Backup import success counts.

Doc/code mismatches found and fixed:

- `README.md` said every import replaces engraving values and the card list.
  False for v1/v2 and v1/v2/v3 respectively. Reworked the warning and added
  the per-version replacement list.
- `README.md` and `CLAUDE.md` omitted that v2/v3 replace heraldry, v3/v4
  replace engraving data, and v4 replaces every requested table. Added the
  replacement matrix.
- `README.md` said all non-card Manage lists are newest first, but plate levels
  are highest value first. Corrected.
- `CLAUDE.md` said server response order was unchanged; the cards block is
  A to Z. Clarified.
- `CLAUDE.md` API summary omitted methods for heraldry level/plate deletes and
  plate patch/delete. Listed them.
- `README.md` and `CLAUDE.md` seed text did not distinguish the seed script
  from migration-seeded engraving values or retained catalogs. Clarified.
  Cascades were verified in the DDL: character references in
  `character_heraldry`, `character_engraving` and `character_cards` are all
  `ON DELETE CASCADE`.
- `README.md` Node range excluded Node 23/25 while claiming "22.12 or newer";
  narrowed it and recorded Node 24.20.0 as the tested version.

Recorded, not changed:

- `package.json` still says version `1.0.0` while docs use v3.x feature labels.
  This is project release metadata, not runtime behavior.
- `server/src/seed-dev.ts:50` calls `new Date()` in the dev-only entry script.
  Week computation remains in `week.ts`; this is a literal deviation from the
  Code rules, not a functional defect.

### 5. Verification

```text
npm test       234 passed across 20 test files
npm run lint   passed, no errors or warnings
npm run build  passed server/dev/web typechecks and Vite production build
```

---

# Review — Dragon Nest Run Tracker v3.3.1 Cards and Manage usability

## 1. Summary

v3.3.1 adds one success-note slot per Manage list, 10-per-page pagination and a
one-transaction `Card name, Grade` import to the character card panel, collapsible
engraving grade sections, and a sticky Manage sidebar with scroll spying.

No schema change: `user_version` stays 4, no migration is added, export stays
`version: 4` and no dependency is added. All migrations were left untouched.

## 2. Requirement checklist

A. Manage add notes
- [x] One note per list (Characters, Nests, Plates, Plate levels, Cards).
- [x] Text `Added {name}.` / `Added Level {value}.`; hidden-by-search variant
      `Added {name}. It is hidden by your current search.`
- [x] Replaced on add, rename, delete or search change; cleared when Manage
      unmounts. Typing in an input does not clear it.
- [x] Add keeps the search, resets the page to 1. The plate-level amber
      rank-shift warning stays a separate box.
- [x] The Cards bulk-import summary shares the same slot.

B. Character panel pagination
- [x] A to Z sort, then a panel search over all owned cards, then pagination at
      `PAGE_SIZE = 10` via `buildCharacterCardList` and the shared `Pagination`.
- [x] "N of M cards" while filtering; footer only above 10.
- [x] Page resets on search change, add and import; change grade and remove keep
      the page, clamped by `paginate` plus the sync effect.
- [x] One panel note slot: Added / Changed / Removed / import summary. Search
      change replaces it; opening or cancelling the grade editor does not.

C. Character panel import
- [x] Inline `Import cards` block below the add form; pushes the list down.
- [x] Hint `One card per line: Card name, Grade`; Import disabled for blank text;
      Cancel closes and clears.
- [x] Clean import closes and clears. Invalid lines stay in the textarea with
      duplicates removed.
- [x] Last-comma split, trimming, ASCII case-insensitive card names and grades,
      empty lines ignored, all five invalid kinds.
- [x] First valid occurrence wins; invalid lines do not claim their card.
- [x] Existing grade is overwritten; same grade counts as unchanged.
- [x] Valid operations apply in one transaction (`db.transaction`).
- [x] `POST /api/character-cards/import { characterId, text }`, 100 KB default
      body limit, 400 bad id/non-string text, 404 unknown character, counts plus
      `invalidLines`.
- [x] Note format: zero clauses omitted, `Imported: nothing changed.`, duplicate
      and invalid clauses with singular/plural.

D. Manage engraving accordions
- [x] One collapsible section per grade, closed by default.
- [x] All four grades render when the category has values; a wholly empty
      category keeps the single empty message.
- [x] Open state is per category and lasts while Manage is mounted.
- [x] Add/edit/delete never collapse a section and never auto-open one.
- [x] Native button with `aria-expanded` / `aria-controls`, panels keep
      `hidden`, visible focus style.
- [x] The add-value form and its errors were already above the grade list, so
      they remain reachable while every section is closed.

E. Manage sidebar
- [x] Links in page order: Characters, Nests, Plates, Plate levels, Engraving
      values, Cards. Buttons, not hash anchors, so Manage routing is unaffected.
- [x] Smooth scroll with a header-aware `scroll-margin-top` gap.
- [x] Active section via a rAF-throttled positional spy; clicked link is set
      immediately and kept during the smooth scroll.
- [x] Sticky below the app header on large screens; scrollable chip row below
      `lg`.
- [x] `prefers-reduced-motion` uses instant scrolling.
- [x] Positioning uses `--app-header-height`, published by `AppShell` with a
      `5rem` fallback.

F. Tests and docs
- [x] Vitest + supertest only; no jsdom or RTL.
- [x] Pure import planner tests, endpoint tests, rollback test, web helper tests.
- [x] CLAUDE.md and README.md updated and audited.
- [x] This v3.3.1 report appended; earlier reports kept.

## 3. Post-approval changes

1. **Manage order.** Section order is now Characters, Nests, Plates, Plate
   levels, Engraving values, Cards, in both the page and the sidebar. Plates and
   Plate levels were swapped from the previous two-column layout.
2. **Panel before/after.** Before: header/count, note, error, search + count,
   card list, Add card section. After: header/count, note, error, Add card +
   Import cards block, card search, paginated list. The move was necessary so
   the import textarea pushes the list down instead of covering it.
3. **Engraving add form.** Verified before implementing that it is outside the
   grade panels (`EngravingValuesSection.tsx`, form before the grade list). It
   stays there, so no extra fix was needed.
4. **Import close guard.** While the import textarea contains non-whitespace
   text, Escape, backdrop clicks and the panel close button do not close the
   panel. Only Cancel clears the text. When the text is empty (or
   whitespace-only) normal Escape/backdrop/close behavior returns. On narrow
   screens the panel is a centered dialog with internal scrolling; the same
   guard applies because it is state-based, not layout-based. The close button
   is disabled rather than silently discarding text.
5. **Removed note.** Now `Removed {card} from {character}.` with the trailing
   period; the helper test asserts the exact string.
6. **Scrolling assumptions confirmed.** The app uses window/document scrolling
   (no page-level overflow container); `AppShell` renders `<header
   className="sticky top-0 ...">`. The implementation therefore relies on
   `--app-header-height` and window scroll, with a 1200 ms scroll-lock fallback.
7. **Invalid-line persistence.** CLAUDE.md documents that an invalid line stays
   in the textarea and that re-importing it later overwrites a grade that a
   later valid line applied for the same card.

## 4. Files

Server:
- `server/src/cards.ts` — `matchCardGrade`, import plan types and
  `planCharacterCardImport`.
- `server/src/cardsData.ts` — `importCharacterCards` (single transaction).
- `server/src/routes/cards.ts` — `POST /api/character-cards/import`.
- `server/tests/cards.test.ts`, `server/tests/cards-api.test.ts`.

Web:
- `web/src/api/types.ts`, `web/src/api/client.ts` — result type and client call.
- `web/src/lib/notes.ts`, `web/src/lib/manageSections.ts` (new).
- `web/src/lib/cards.ts` — `buildCharacterCardList`,
  `formatCharacterCardImportSummary`.
- `web/src/components/EntitySection.tsx`, `PlateLevelSection.tsx`,
  `CardsSection.tsx`, `CardCharacterPanel.tsx`,
  `EngravingValuesSection.tsx`, `ManageSidebar.tsx` (new), `AppShell.tsx`.
- `web/src/pages/ManagePage.tsx`, `web/src/index.css`.
- `web/src/lib/notes.test.ts`, `manageSections.test.ts`, `cards.test.ts`.

Docs: `CLAUDE.md`, `README.md`, `REVIEW.md`.

## 5. Test results

```text
npm test       262 passed across 22 test files
npm run lint   passed, no errors or warnings
npm run build  passed server, dev server and web typechecks, plus Vite build
```

New coverage highlights:
- Import planner: comma handling, case folding, invalid kinds and order,
  first-valid-wins, invalid-does-not-claim, add/update/unchanged, ASCII-only
  matching, empty text.
- Endpoint: counts and `invalidLines`, state reflection, validation errors,
  unknown character, duplicate/invalid lines, no `operations` field, 413 over
  100 KB, and a trigger-forced second-row failure proving full rollback.
- Web helpers: note text, panel list filtering/sorting/pagination/clamping,
  import summary wording and pluralization, sidebar order and spy selection.

## 6. Documentation audit

v3.3.1 drift fixed in CLAUDE.md and README.md:
- Manage order, notes, pagination and sidebar/accordion behavior.
- Panel layout, panel notes, pagination and per-character import rules.
- API summary entry for `POST /api/character-cards/import`.
- Explicit confirmation that schema 4 and export version 4 are unchanged.
- Code-rules helper list now includes `notes` and `manage sections`.

Other checks that matched the code and needed no change: tab order, Manage list
ordering and page-reset rules, `Pagination` hiding at 10 or fewer, the 100 KB
default JSON limit, the finder order, and backup/export/import behavior.

Recorded, not changed (pre-existing, non-v3.3.1):
- `package.json` still reports version `1.0.0` while docs use v3.x feature
  labels.
- `server/src/seed-dev.ts` calls `new Date()` in the dev-only entry script.

## 7. Manual acceptance checklist (not run as browser automation)

- Add each Manage record type and confirm the note, hidden-by-search variant,
  page reset and note clearing.
- Confirm the plate-level note and amber rank-shift box can both appear.
- Open/close engraving grades, switch category and return, then add/edit/delete
  and confirm sections keep their state.
- Scroll Manage and confirm the highlighted section, chip row on narrow width,
  sticky sidebar, click lock without flicker, and reduced-motion behavior.
- In the character panel: paginate, search, add, change grade, remove, and
  confirm the one note slot and its wording.
- Import a clean paste, a partially invalid paste and a duplicate paste; confirm
  counts, textarea contents and the textarea close guard.
- Verify Escape/backdrop/close are blocked only while the textarea has text.

## 8. Open points

- The close button is disabled while the import textarea has text, which is
  stricter than the Escape/backdrop rule but consistent with "only Cancel
  clears".
- The Cards Manage note renders near the add form, not beneath the bulk-import
  form; both actions share the same single slot.
- Whitespace-only import text returns 200 with zero counts; the Import button
  is disabled in that state.
- The import entry point is hidden only when the card catalog is empty, so
  characters who already own every card can still import grade changes.

---

## v3.3.1 fix: sidebar highlight stability

### Confirmed root cause

The client hypothesis was partly right, but the primary cause was a coordinate
mismatch. `measureTops()` returned document offsets (`rect.top + scrollY`), while
`pickActiveSectionIndex` was given `headerHeight + 24` as the threshold, with no
`scrollY` term. Once the click lock ended, any re-evaluation compared Nests'
document offset against a ~104 px viewport threshold, so the spy fell back to
index 0 (Characters). The `ResizeObserver` made this visible without scrolling:
typing (live matches line), an add note, or an accordion toggle changed section
heights and triggered a re-measure, which changed the highlight. Independently,
the scroll target (`scroll-margin-top` = header + 24) and the spy threshold
(header + 24) were identical, so sub-pixel rounding alone could also select the
previous section.

### Change

- `manageSpyThreshold(headerHeight, scrollY)` now returns
  `scrollY + headerHeight + MANAGE_SCROLL_OFFSET_PX (24) + MANAGE_SPY_TOLERANCE_PX (16)`.
  Document offsets are compared consistently, and a click-placed section sits
  16 px inside the active range.
- `ManageSidebar` records the last evaluated `scrollY` and ignores re-measures
  when it is unchanged. Locked scrolls and lock release update that value, so
  layout-only changes after a click never move the highlight.
- Window resize now forces a recompute; scrolling and sidebar clicks still do.
- Kept: click lock, 1200 ms fallback, reduced motion, rAF throttling, button
  links, and the narrow-screen chip row.

### Files changed

- `web/src/lib/manageSections.ts` — offset and tolerance constants, threshold
  helper.
- `web/src/components/ManageSidebar.tsx` — consistent threshold, scroll-delta
  guard, forced resize recompute.
- `web/src/lib/manageSections.test.ts` — threshold boundary and click-stability
  cases.
- `CLAUDE.md` — sidebar spy threshold and stability rule. `README.md` does not
  describe the threshold, so no change was needed.

### Verification

```text
npm test       268 passed across 22 test files
npm run lint   passed
npm run build  passed typechecks and Vite build
```

### Manual checklist

- Click each sidebar link, then type in the section's add input: highlight must
  stay on the clicked section.
- Click a sidebar link, then add a record / show a note / show live matches:
  highlight must not move.
- Open and close engraving grade sections: highlight must not move.
- Scroll normally: the highlight must follow the section under the header gap.
- Resize the window: the highlight may update to the section in the new view.
- Check the last section at page bottom and a click on the first section at the
  top of the page.
- Repeat with reduced motion enabled and on a narrow viewport.
