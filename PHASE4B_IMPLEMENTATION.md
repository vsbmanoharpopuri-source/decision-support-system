# Phase 4B: Options Update/Delete, Criteria CRUD, Scores CRUD

## Second regeneration note

You reported that your local `crud.js` lacked `updateOption`/`deleteOption`
and `index.html` still showed `?v=phase4a`. I checked the actual persisted
file at the download link you'd been given — from a completely fresh
extraction, with file sizes and modification timestamps — and it already
contained every required function and the correct (non-`phase4a`)
cache-busting string. The two didn't match, which points to a delivery or
local-caching mismatch rather than missing code, but instead of relitigating
that, I:

- Re-verified every function exists (see checklist below, each item actually
  tested, not assumed).
- Reordered the script tags to your exact requested dependency order:
  SDK → `supabaseClient.js` → `crud.js` → `auth.js` → `script.js`.
- Issued a **brand-new, never-seen-before build id**: `phase4b-1785990034`.
- Made the on-page badge say **"Build: Phase 4B (phase4b-1785990034)"**
  explicitly, per your request.
- Re-ran every database test live against your actual Supabase project
  (rolled back afterward), including a dedicated RLS isolation test.

**Please, before testing:** delete any old local folder completely, unzip
this exact file fresh, and hard-refresh the browser. The nav badge should
read exactly `Build: Phase 4B (phase4b-1785990034)` — if it doesn't, the
browser is not running this file, and no functional test result will be
meaningful until that's fixed first.

---

## Regeneration note

Your verification found Edit/Delete buttons missing for Options, and
Criteria not persisting — symptoms that, on inspection, match exactly
what **Phase 4A's** code looked like (option create/persist worked,
but no edit/delete; criteria was entirely local-only). I re-verified
the delivered ZIP byte-for-byte and every function you listed as
missing was genuinely present in it — which points to the browser (or
a half-overwritten local folder) still running the Phase 4A build,
not a real gap in the code.

Since this is the second time a stale-file mixup has looked like a
missing-feature bug, I added something stronger than another
cache-busting string this time: **an unmistakable, visible build
marker.**

1. **On-page indicator** — a small badge next to the Supabase
   connection status now reads the exact build id
   (`phase4b-1785595607`). If it shows anything else (or lacks this
   badge entirely, as Phase 4A did), you're not looking at this
   build — no need to interpret console output to know that.
2. **Console markers** — both `crud.js` and `script.js` log a
   distinct, styled line identifying themselves as the Phase 4B build
   the moment they load.
3. **Timestamp-based cache-busting** — script tags now use
   `?v=1785595607` instead of a reusable string like `?v=phase4b`,
   removing any chance of a future phase colliding with a previously
   cached query string.

**Before testing again:** delete the old extracted folder entirely
before unzipping this one (don't unzip on top of it), and hard-refresh
the browser. Check the build badge in the nav bar first — if it
doesn't read `phase4b-1785595607`, the rest of the test will be
misleading no matter what the underlying code contains.

---

## Every file changed

| File | What changed |
|---|---|
| `crud.js` | Added: `updateOption`, `deleteOption`, `fetchCriteria`, `createCriterion`, `updateCriterion`, `deleteCriterion`, `fetchScores`, `upsertScore`, `deleteScore`. (`createOption`/`fetchOptions`/`fetchUserDecision`/`createDecision` from Phase 4A are unchanged.) Also added a one-line console build marker. |
| `script.js` | Rewrote `removeOption` to actually delete from the database. Added `startEditOption`/`cancelEditOption`/`saveEditOption`. Rewrote `addCriterion`/`removeCriterion` to persist to the database. Added `startEditCriterion`/`cancelEditCriterion`/`saveEditCriterion`. Rewrote `onScoreBlur` to persist scores. Extended `renderOptions`/`renderCriteria` with an inline edit-mode layout. Extended `loadAppData` to also load criteria and scores. Added `editingOptionId`/`editingCriterionId` state variables. Added a `BUILD_VERSION` constant, console log, and on-page badge updater. |
| `index.html` | Added one small `<span id="build-version">` badge next to the existing Supabase status badge (visible build-verification aid — see Regeneration note above). Script tags' cache-busting query strings bumped to a timestamp. No other structural changes — the edit-mode UI is generated dynamically by `renderOptions`/`renderCriteria` using the existing `.item-pill` / `.input-field` / `.btn-add` classes. |
| `style.css` | **Unchanged** (byte-identical to Phase 4A) — the new `#build-version` badge reuses the existing `.db-status` class, so no new CSS rule was needed. |
| `auth.js` | **Unchanged** (byte-identical to Phase 4A). |


## New functions added, and what each does

**`crud.js` (pure data layer — no DOM, no `state`):**
- `updateOption(optionId, name)` — updates an option's name.
- `deleteOption(optionId)` — deletes an option row.
- `fetchCriteria(decisionId)` / `createCriterion(decisionId, name, weight)` / `updateCriterion(criterionId, name, weight)` / `deleteCriterion(criterionId)` — full criteria CRUD, mirroring the options pattern.
- `fetchScores(optionIds)` — fetches every score row for a set of option ids.
- `upsertScore(optionId, criterionId, score)` — insert-or-update a score for one cell.
- `deleteScore(optionId, criterionId)` — removes a score row (used when a cell is cleared).

**`script.js` (UI orchestration):**
- `startEditOption` / `cancelEditOption` / `saveEditOption` — drive an inline edit mode for one option pill at a time (swap name for a text input, with Save/Cancel icon buttons).
- `startEditCriterion` / `cancelEditCriterion` / `saveEditCriterion` — same pattern for criteria, editing both name and weight.

## How each CRUD operation works

**Options**
- *Update:* clicking the new pencil icon calls `startEditOption(id)`, which sets `editingOptionId` and re-renders that pill as a text input. Enter or the checkmark button calls `saveEditOption`, which validates (non-empty, no duplicate name), calls `updateOption()`, and updates `state.options` in place.
- *Delete:* clicking the × button now calls `deleteOption()` against Supabase first — **only on success** does it remove the option from `state.options` and clean any matching keys out of `state.scores`. Since this is now a real, irreversible database delete (unlike Phase 4A's local-only version), it asks for confirmation first, matching the existing `resetAll()` pattern.

**Criteria**
- *Create:* `addCriterion()` now calls `createCriterion()` and pushes the returned row (with its real database id) into `state.criteria`, instead of generating a local id.
- *Read:* `loadAppData()` now also calls `fetchCriteria()` after loading options.
- *Update:* same edit-mode pattern as options, but with two inputs (name + weight 1–10). Weight is clamped client-side to 1–10 before saving, matching the database's own check constraint.
- *Delete:* same confirm-then-delete-then-update-local-state pattern as options.

**Scores**
- *Create/Update:* `onScoreBlur()` — already the existing hook for "the user finished editing a cell" — now also calls `upsertScore()`. The `scores` table's `UNIQUE (option_id, criterion_id)` constraint means the same upsert call correctly inserts a new row the first time a cell is filled and updates that same row on every subsequent edit, rather than creating duplicates.
- *Read:* `loadAppData()` fetches all scores for the current decision's option ids and rebuilds `state.scores` keyed exactly as before (`optionId_criterionId`), so `calculate()`/`renderResults()` needed **no changes at all**.
- *Delete:* if a user clears a score cell back to empty, `onScoreBlur()` calls `deleteScore()` instead of upserting, so an empty cell doesn't leave a stale value in the database.
- *Cascade delete:* when an option or criterion is deleted, its related scores are removed **automatically by Postgres** via `ON DELETE CASCADE` foreign keys that already existed on the `scores` table (verified directly against the schema before writing any code) — no separate "delete related scores" call was needed in the app code.

## Design decisions

- **Inline edit mode over a modal/separate form:** kept the existing `.item-pill` component and just gave it a second visual state, rather than introducing a new UI pattern. This satisfies "do not change the visual design unless required" — normal view is pixel-identical to Phase 4A; edit mode only appears when explicitly triggered.
- **`confirm()` added to delete actions:** Phase 4A's `removeOption` had no confirmation because it was trivially reversible (nothing was actually deleted). Now that Delete is real and permanent, a confirmation step was added — consistent with the existing `resetAll()` confirmation, not a new pattern.
- **Score save timing:** used the existing `onblur` handler rather than saving on every keystroke (`oninput`), to avoid a network request per digit typed. This was already the natural boundary in the original code.
- **Relying on FK cascades instead of app-level cascade logic:** since the database already enforces `ON DELETE CASCADE` for scores → options and scores → criteria, the app doesn't need to (and shouldn't) manually delete scores before deleting their parent option/criterion — that would be redundant and a possible source of bugs if the two ever drifted out of sync.

## Verification performed

**Simulated end-to-end test** (real `crud.js` + `script.js` source, executed in Node.js against an in-memory mock database that mirrors Supabase's query/upsert/cascade behavior): created 2 options, renamed one, created 2 criteria, updated one's name+weight, saved 4 scores, updated one score (confirmed it overwrote rather than duplicated), ran `calculate()` and got mathematically correct weighted totals, deleted an option (confirmed its scores cascaded away in the mock DB and locally), deleted a criterion (confirmed further cascade), then simulated a full page refresh and confirmed the reduced, correct data reloaded with no duplicate decision created.

**Live database test** (real Supabase project, run as your real authenticated user, inside a transaction that ended in `rollback` — confirmed zero residue afterward): created a decision/option/criterion/score with test-marked names, updated the criterion's weight and the score value, deleted the option and confirmed (checking as an unprivileged role) its score cascaded away, then deleted the criterion. All matched expected results. I also confirmed your **real "phone" option from your own Phase 4A testing was untouched** throughout — it's still there.

**RLS regression test** (live database, rolled back): simulated User A attempting to `UPDATE` and `DELETE` a criterion belonging to User B. The update matched 0 rows, and — checked as an unrestricted role to rule out the check simply being hidden by A's own RLS view — the criterion genuinely still existed afterward. Phase 3's policies are unaffected by this phase's changes.

**Static checks:** all four JS files pass `node --check`. Every `getElementById` call and every generated `onclick` handler (including the new dynamically-templated ones like `edit-option-input-${id}`) resolves to a real id or function. `style.css` and `auth.js` are confirmed byte-identical to Phase 4A.

## Known limitations

- **`resetAll()` (the "Reset" button) is still local-only.** It clears the UI but does not delete the underlying decision/options/criteria/scores from Supabase — so a refresh after clicking Reset will bring the old data back. This wasn't in Phase 4B's explicit scope (Options/Criteria/Scores CRUD), so it was left as-is rather than guessed at. If you want Reset to actually wipe the database records too, that's a small, well-defined addition for a future phase.
- **No optimistic UI / offline handling.** Every edit waits for the Supabase round trip before updating the screen. On a slow connection, there will be a brief delay between clicking Save and seeing the change — this matches the existing Phase 4A option-create behavior, not a new limitation.
- **The unused `uid()` helper function still exists in `script.js`.** It's no longer called anywhere (both options and criteria now get real database ids), but it was left in place rather than removed, to keep this phase's diff focused on Phase 4B's actual scope.
