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
