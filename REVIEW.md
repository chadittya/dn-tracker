# Review — Dragon Nest Run Tracker v2

## 1. Summary

v2 adds client-side search and filtering to Runs, Matrix, and Manage, and
replaces the Dashboard's three overlapping lists with two capped summaries.
The iteration is frontend-only: no schema, migration, API endpoint, API
response, business-rule, or dependency changes.

The previous v1 review is preserved in git history.

## 2. Requirement checklist

### Search behavior (all pages)

- [x] Client-side only, case-insensitive contains match, input trimmed.
- [x] Empty search shows everything.
- [x] No matches shows a message such as `No characters match “xyz”.` with a
      clear action.
- [x] Active filters show `Showing X of Y …` plus `Clear filters`.
- [x] One `Clear filters` action clears all filters on the tab, including the
      Matrix remaining toggle.
- [x] No week-boundary computation in the frontend.

### Runs tab

- [x] Nest selector replaced by a search field over the nest chip list.
- [x] Character search above the Not yet / Done columns.
- [x] `Done X / Y` always uses true, unfiltered totals for the selected nest.
- [x] Column badges show the filtered counts actually displayed.
- [x] One-click character toggle unchanged while filtered.
- [x] Selected nest is pinned first only while a nest search is active; with
      an empty nest search the original nest order is preserved.
- [x] If the selected nest is filtered out, it stays selected and visible.

### Matrix tab

- [x] Character search filters rows.
- [x] Nest search filters columns.
- [x] `Only characters with remaining runs` hides characters done on every
      currently visible nest.
- [x] Zero visible nests is handled before the remaining-toggle/empty logic,
      so it never reports “all done on the visible nests”.
- [x] Cell clicks toggle as before while filtered.
- [x] Sticky header row and first column markup unchanged.
- [x] Trailing `Done X / Y` counts visible nest columns only (confirmed).

### Manage tab

- [x] Search above both the character and nest lists.
- [x] Add input shows live existing matches while typing.
- [x] Exact ASCII case-insensitive duplicate shows a warning and disables Add.
- [x] `submitAdd` re-checks duplicates so implicit Enter submission cannot
      bypass the disabled button.
- [x] Partial matches keep Add enabled; the server remains the source of truth.
- [x] Rename/remove behavior and confirmations unchanged.

### Dashboard

- [x] Overall progress, Remaining, Characters, and ResetCountdown stat cards
      kept.
- [x] `Most remaining`: only characters with remaining runs, sorted most
      remaining first, top 10, remaining badge plus progress bar.
- [x] `View all` for characters goes to Matrix.
- [x] `Nests needing runs`: only nests not 100% done, sorted most remaining
      first, top 5.
- [x] `View all` for nests goes to Runs.
- [x] `+N more` shown when a list is capped.
- [x] One global `All done this week` card when every run is done.
- [x] If only one section is empty, that section shows its own empty message.

### Hard constraints

- [x] No database schema change or new migration.
- [x] No new API endpoint and no API response changes.
- [x] No new dependency.
- [x] Business rules, week logic, reset, names, and cascade behavior unchanged.
- [x] Frontend still uses `weekKey` / `nextResetAt` from the API only.
- [x] Existing 51 server tests still pass.
- [x] Lint and build pass.
- [x] API responses remain backward compatible; `mostRemaining` is retained.

## 3. Files changed / created

### Created

| File | Purpose |
| --- | --- |
| `web/src/lib/search.ts` | Trim/case-insensitive contains matching, generic name filtering, Matrix row filtering. |
| `web/src/lib/names.ts` | ASCII-only NOCASE duplicate folding and Add-input analysis. |
| `web/src/lib/dashboard.ts` | Pure Dashboard filtering, sorting, capping, `+N more`, and `allDone`. |
| `web/src/lib/search.test.ts` | Search and Matrix filter tests. |
| `web/src/lib/names.test.ts` | Duplicate-detection tests. |
| `web/src/lib/dashboard.test.ts` | Dashboard sort/cap/all-done tests. |
| `web/src/components/SearchField.tsx` | Shared controlled search input with accessible clear button. |
| `web/src/components/FilterStatus.tsx` | Shared “Showing X of Y …” note and page-level `Clear filters`. |
| `web/src/components/NoMatchState.tsx` | Shared search no-match card with clear action. |
| `web/src/components/DashboardListSection.tsx` | Dashboard section shell with `View all`, empty message, and `+N more`. |
| `server/src/seed-dev.ts` | Dev-only database seeder. |

### Modified

| File | Change |
| --- | --- |
| `web/src/pages/RunPage.tsx` | Searchable nest selector, character search, filtered columns, true totals, filter notes. |
| `web/src/pages/MatrixPage.tsx` | Row/column search, remaining toggle, filtered grid, no-match states. |
| `web/src/pages/DashboardPage.tsx` | Two capped summary lists, global all-done card, reuse of existing `onNavigate`. |
| `web/src/components/EntitySection.tsx` | Internal list search, live Add duplicate analysis, filtered list rendering. |
| `web/src/pages/ManagePage.tsx` | Passes `itemLabel` to both EntitySection instances. |
| `web/src/components/ProgressBar.tsx` | Optional `trailing` slot for the remaining badge. |
| `vitest.config.mts` | Adds `web/src/**/*.test.ts` to the test include list. |
| `package.json` | Adds `npm run seed:dev`. |

### Not changed

- `server/src/progress.ts`, `server/src/routes/state.ts`, all other server
  routes, migrations, DB code, and backup code.
- `web/src/api/types.ts`, `web/src/api/client.ts`, and the state provider.
- `App.tsx`: tab state and navigation already live there; `DashboardPage`
  already received the existing `onNavigate` callback, so both `View all`
  actions reuse it with no new navigation code.

## 4. Design decisions

### Dashboard capping is in the frontend

`GET /api/state` already returns full `perCharacter` and `perNest` arrays.
Capping server-side would either change those arrays (breaking backward
compatibility) or require a new field/endpoint, both prohibited. Capping is
presentation policy, and the pure helpers also expose the exact hidden count
for `+N more`. Data volume is small for a single-user local app.

`dashboard.mostRemaining` remains in the API and type but is no longer used by
the Dashboard because it lacks `done`/`total` needed for progress bars.

### Selected nest pinning

While a nest search is active, the selected nest is always rendered first and
keeps the active style, even if it does not match the query. With an empty
nest search, the original server order is used. This avoids silently changing
the selected nest when the user types.

### Matrix empty-column ordering

`visibleNests.length === 0` is checked before the character/remaining-toggle
empty branch. A unit test covers zero visible nests with `onlyRemaining` on.

### Duplicate detection vs search folding

General search uses JS `toLowerCase()` (broader Unicode behavior). The Manage
duplicate warning uses ASCII-only folding to mirror SQLite `NOCASE`, so the
client's Add availability matches the server's actual uniqueness rule. The
server remains authoritative for races and edge cases.

## 5. Test results

Commands run:

```text
npm test
npm run lint
npm run build
npm run seed:dev
```

Results:

- `npm test`: **77 passed** (8 files), including the original 51 server tests
  and 26 new pure-function tests.
- `npm run lint`: passed with no warnings/errors.
- `npm run build`: passed (server typecheck, dev typecheck, web typecheck,
  Vite production build).
- `npm run seed:dev`: seeded 40 characters, 15 nests, and 309 random
  current-week runs into `data-dev/app.db`.
- Headless Chrome (CDP) smoke pass against the seeded dev server: Runs,
  Matrix, Manage, and Dashboard rendered; filter notes, no-match states, clear
  filters, Manage duplicate warning/disabled Add, and Dashboard caps all
  behaved as expected. The only network 404 was `/favicon.ico` (no favicon
  asset exists); there were no browser runtime errors.

No server/API tests were added because no server/API code changed.

## 6. Seed script

`npm run seed:dev` runs `server/src/seed-dev.ts`.

- Hard-coded to `data-dev/`; ignores `DN_DATA_DIR`.
- Includes an explicit guard that refuses anything whose directory basename is
  not `data-dev` and refuses the production `data/` path.
- Replaces dev data with 40 `Character NN` rows, 15 `Nest NN` rows, and random
  current-week runs using varied completion ratios (0%, 25%, 50%, 75%, 100%).
- Uses `getWeekKey(new Date())` from the existing week module.
- Never touches `data/`, does not create production backups, and is not
  imported by the running server.

## 7. Manual acceptance checklist

1. Run `npm run seed:dev` then `npm run dev`.
2. Runs: search nests, confirm the selected nest is pinned only while the
   search is active, filter characters, confirm `Done X / Y` stays true, toggle
   a character while filtered.
3. Matrix: filter rows/columns, enable the remaining toggle, toggle a visible
   cell, scroll and confirm sticky header/first column in dark and light mode.
4. Manage: search both lists; type an existing name and confirm the warning and
   disabled Add; type a partial name and confirm matches appear; rename/remove.
5. Dashboard: confirm top 10 / top 5 ordering, progress bars, `+N more`,
   `View all` targets, and the global all-done card.

A browser-driven smoke pass was performed against the seeded `data-dev/`
database: Runs character search and true totals, Runs no-match + clear,
Matrix row/column filters and zero-nest handling, Manage duplicate
warning/disabled Add and search note, and Dashboard capped lists all passed.
The client's full manual visual acceptance still remains.

## 8. Deviations and open questions

- Manage “existing matches” are display-only (not clickable) and capped at 5
  with `+N more`. The spec only asked to show matches.
- Filters reset when switching tabs because inactive tabs unmount (existing App
  behavior). No persistence to URL/localStorage/database was added.
- No Matrix virtualization. Filtering reduces rendered rows/columns, but very
  large unfiltered grids may still be heavy; out of scope.
- `REVIEW.md` was replaced with this v2 report; the v1 report remains in git
  history.

## 9. How to run

```bash
npm install
npm run seed:dev   # optional: dev-only sample data
npm run dev        # http://localhost:3000, data-dev/
```

Production local use:

```bash
npm run build
npm start          # data/
```

The seed script is never part of normal startup and cannot target `data/`.
