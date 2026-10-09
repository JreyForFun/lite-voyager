# Lite Voyager: Validation

Status: Draft v0.1 | Applies to every task and every milestone.

**Rule:** nothing is "done" because an AI says it is. Done means there is evidence: command output you have seen, or a manual check you have performed.

**Honest limit:** validation lowers the risk of errors; it cannot prove there are none. Large-file speed, memory use, and behavior on other operating systems are only validated by actually running them.

---

## 1. Three layers of validation

### Layer 1: Automatic gate (every task, every commit)

Two commands, defined in task T-006:

| Command | Runs | When |
|---|---|---|
| `npm run verify` | typecheck (`tsc --noEmit`), lint, unit tests (Vitest), build (esbuild), and a `.vsix` package dry run | After every task, before every commit |
| `npm run verify:full` | everything in `verify`, plus integration tests in a real VS Code (`@vscode/test-electron`) | Before a phase gate, and in CI on Windows, macOS, and Linux |

Rules:
- Zero errors and zero warnings. A warning is a defect that has not been explained yet.
- Do not weaken a test, skip it, or delete it to make it pass. Fix the code, or change the spec first.
- Do not silence the type checker (`any`, `@ts-ignore`) or the linter without a written reason next to it.

T-007 CI runs the full gate on Windows, macOS, and Linux; Linux uses
`dbus-run-session -- xvfb-run -a npm run verify:full` for an isolated session bus
and virtual display. Workflow contract tests and a local YAML parse
verify configuration, not runner compatibility. To complete T-007, provide the
GitHub Actions CI run URL, tested commit SHA, and successful conclusions for all
three Full verification jobs. For failures, provide the failing step's log with
its first error or warning. Keep T-007 unchecked until that evidence is seen.
The current scaffold does not cover both database engines; their tests follow
their implementation tasks. The milestone's engine gate remains required.

T-007 evidence recorded on 2026-10-09:
[run 37884550873](https://github.com/JreyForFun/lite-voyager/actions/runs/37884550873),
commit `93b23bf1420cf10dd8b0ea82d3b4c2be0e35268d`. The user supplied the run URL;
GitHub API metadata confirms successful Ubuntu, Windows, and macOS jobs and
each applicable full-verification step. Local full verification also passed.
Only the two CI-related gate items below are checked; the milestone is open.

T-002 CI evidence recorded on 2026-10-09:
[run 37916047454](https://github.com/JreyForFun/lite-voyager/actions/runs/37916047454),
attempt 1, commit `f3085869c88262b2ffdbfddb47805f6287cdcc3a`. GitHub API metadata
confirms successful Windows, Ubuntu, and macOS Full verification jobs and each
applicable verification step. Owner manual QA confirms both engines cancel
(native 24 ms, fallback 92 ms), recover, and keep typing responsive. Independent
fresh-context review under section 6 found HIGH silent omission of committed WAL
rows in fallback and MEDIUM leaked sql.js statements on oversized column
metadata. Owner-authorized fixes now have red-first regressions; independent
follow-up review found no remaining concrete defect. Fresh final verification
and three-platform CI are required for the fixes; no task or milestone is closed.

### Layer 2: Per-task validation (spec to test)

- Every acceptance criterion (Given / When / Then) becomes at least one test.
- Test names start with the requirement ID, for example `FR-002: shows NULL differently from empty string`. This lets you search for coverage.
- `npm run trace` (task T-051) lists every requirement that has no test yet, so gaps are visible rather than discovered later.
- Bug rule: when you find a bug, first write a failing test that reproduces it, then fix it. If the cause was an unclear spec, update the spec in the same commit.

### Layer 3: Manual QA (end of every milestone)

Some things automated tests cannot judge: whether scrolling feels smooth, whether an error message makes sense, whether a 2 GB file really opens fast. Use the checklists in section 4, in a real VS Code window (F5), with the fixtures from T-005.

---

## 2. Definition of Done (per task)

A task may be ticked in `TASKS.md` only when all of these are true:

- [ ] Acceptance criteria are covered by tests, and the tests fail without the code (the test is real).
- [ ] `npm run verify` passes with no errors and no warnings. You saw the output.
- [ ] Every new failure path shows a clear message to the user (no silent failures, no raw stack traces in the UI).
- [ ] No Constitution rule is violated (see the checklist in section 3).
- [ ] Spec and plan still match the behavior; changelogs updated if they changed.
- [ ] `PROGRESS.md` updated; changes committed with a message naming the task ID.

---

## 3. Constitution checklist (use in reviews)

- [ ] Source files are never modified except on explicit save (NFR-001).
- [ ] No network calls, no telemetry.
- [ ] No main-thread blocking; heavy work is in the worker; results are paged.
- [ ] SQL never built by concatenating user data; identifiers quoted.
- [ ] 64-bit integers displayed exactly.
- [ ] No silent truncation; limits are announced.
- [ ] Nothing added that the milestone does not need (stay lite).

---

## 4. Phase gates

A milestone is finished only when its gate passes. Then, and only then, tag the commit (for example `v0.1.0`) and start the next milestone in a **fresh AI chat** (see `CONTEXT.md`).

### Universal gate items (every milestone)
- [x] `npm run verify:full` is green locally and in CI on all three operating systems. *(Current M0 evidence: T-007 run/SHA above.)*
- [ ] NFR-001 test passes: a source file's hash is identical before and after browsing and querying.
- [ ] Every requirement for this milestone has at least one test (`npm run trace` shows no gaps).
- [ ] Measured numbers (open time, peak memory) are recorded in `PLAN.md` and compared with the NFR targets.
- [ ] Manual QA checklist for the milestone is complete.
- [ ] Independent review done (section 6) and its high-severity findings fixed.
- [ ] No unexplained `TODO` or `FIXME` left in the code.
- [ ] Specs, changelogs, and `PROGRESS.md` are up to date; git tag created.

### Milestone 0 (foundation)
- [x] CI is green on three operating systems. *(T-007 run/SHA above.)*
- [ ] Spike results (T-002, T-004, T-008) are written into `PLAN.md`.
- [ ] T-002 proves worker open/query/cancel/reopen inside a killable helper, confirms helper exit within 1,000 ms after SQL execution begins, and verifies real sql.js fallback when the built-in is unavailable. Local verification, owner manual QA, and fresh three-platform CI are required. The production `Engine` interface, fallback banner/large-file prompt, and permanent force-fallback hook follow in T-009 (Milestone 1).

### Milestone 1 manual QA (read-only SQLite)
- [ ] Open every fixture database. Open an invalid file, an empty (0-byte) file, and a database with no tables: each gives a clear result.
- [ ] A generated multi-GB database shows its first rows within the NFR-004 target, and memory stays flat while scrolling.
- [ ] NULL, empty string, BLOB placeholder, and a 64-bit integer (for example 9223372036854775807) all display correctly.
- [ ] Table and column names with spaces, quotes, and unicode work.
- [ ] Run a long query and cancel it: the UI stays responsive and the app recovers.
- [ ] A bad SQL statement shows the error and keeps the previous results.
- [ ] Sort and filter work on a large table; sorting an unindexed column shows the warning.
- [ ] Export results to CSV, open the exported file, and compare it with the grid.
- [ ] Two tabs open on the same file; closing a tab during a query does not crash.
- [ ] Light and dark themes; the grid is usable by keyboard only.
- [ ] Force the fallback engine and repeat the basics; the banner appears.

### Milestone 2 manual QA (other formats)
- [ ] CSV files with a BOM, CRLF line endings, quoted commas, quoted line breaks, and ragged rows all load correctly.
- [ ] A generated 1 GB CSV: preview appears quickly, import shows progress, cancel works, and the temp file is removed afterward.
- [ ] Kill VS Code in the middle of an import, restart, and confirm the orphaned temp file is cleaned up.
- [ ] Low disk space (simulated) gives the pre-check message instead of a crash.
- [ ] JSONL streams; a JSON array of objects loads; nested JSON can be queried with `json_extract()`; a bad shape gives a clear message.
- [ ] XLSX with several sheets loads as several tables; the large-file warning appears.
- [ ] "Open With", the Explorer menu entry, the editor-title button, and the `openCsvByDefault` setting all behave as specified.
- [ ] Autocomplete suggests real table and column names.

### Milestone 3 manual QA (editing)
- [ ] Edit, save, close, reopen: the change persisted. Edit then revert: the file is unchanged.
- [ ] The dirty marker appears and clears correctly; write mode is clearly indicated.
- [ ] A table without a primary key edits by `rowid`; a valid `WITHOUT ROWID` table edits by its full primary key, including composite keys.
- [ ] Kill VS Code in the middle of a save: the database is still intact and openable.
- [ ] Changing the file from another program triggers the refresh prompt and never silently overwrites it.

### Milestone 4 manual QA (differentiators)
- [ ] `orders.csv JOIN customers.json` returns the right rows; name collisions get suffixes and are shown.
- [ ] CSV write-back is atomic: kill during write and confirm the original file is intact.
- [ ] Benchmark results (T-060) are recorded, and README claims match the numbers.

---

## 5. Edge cases every format must be tested against

T-005 creates fixtures for these. Add new ones whenever a bug is found.
The inventory and setup guide are [manifest.json](../test/fixtures/manifest.json)
and [fixture README](../test/fixtures/README.md). Checks validate fixture data;
future feature tasks still need tests that use these inputs against real behavior.
Static assets retain byte-for-byte hashes. Dynamic file conditions, cancellation,
and worker exit are reproduced on disposable copies using the runtime guide.
Generated stress files are git-ignored; run `npm run fixtures -- stress` and
`npm run fixtures -- large --rows 10000000` locally. Retain the printed output
directory, row/byte report, and `generation.json` as evidence, not large assets.
Apply cases to formats that can represent them: Excel worksheets allow 1,048,576
rows and 32,767 characters per cell, so the 10-million-row/1-MB-cell cases use
CSV/JSON/JSONL/SQLite where applicable. No format limit authorizes silent truncation.

- Empty file, 0-byte file, header-only CSV, database with no tables
- Corrupt or truncated file, non-UTF-8 text, binary data inside a text file
- A single cell larger than 1 MB; a table with 1,000 columns; a table with 10 million rows
- Names with spaces, quotes, emoji, and SQL keywords (`select`, `order`)
- NULL versus empty string versus the text `NULL`
- Integers beyond 2^53; very small and very large REAL values
- Duplicate or blank column headers in CSV
- Read-only file, file in use by another program, file deleted while open
- Cancel in the middle of a query; cancel in the middle of an import
- Worker crash: the extension must recover and tell the user

---

## 6. Independent review (fresh chat, once per milestone and for risky tasks)

The AI that wrote the code is the worst reviewer of it. Open a **new chat**, ideally with a different model, and use this prompt. Paste the real diff, not a summary.

```
You are a strict code reviewer. Do NOT rewrite the code. Find defects.

Context:
- specs/CONSTITUTION.md (pasted below)
- Requirements this change must satisfy (pasted below)
- The diff (pasted below)

Report, in order of severity (HIGH / MEDIUM / LOW):
1. Violations of the Constitution or the requirements. Cite the ID.
2. Bugs, race conditions, unhandled errors, resource leaks.
3. Missing tests or edge cases from the list below.
4. Anything that is not in the spec (scope creep).
For each finding: where it is, why it is a problem, and a suggested test
that would catch it. If you are not sure, say so. Do not invent problems.
```

Then triage the findings yourself. For each real one, write a failing test first, then fix.

---

## 7. When the AI goes wrong

- It claims success without evidence: ask for the exact command, run it yourself, paste the output.
- It starts changing unrelated files: stop, revert with git, start a new chat with the task pack.
- Tests pass but behavior is wrong: the tests are too weak. Add the missing test from the acceptance criteria.
- The same bug comes back twice: the spec is probably unclear. Fix the spec.

## Changelog
- v0.1 T-002 cancellation redesign (2026-10-09): Owner authorized confirmed helper exit within one second; local, manual, and fresh CI evidence are required for closure.
- v0.1 T-002 scope clarification (2026-10-09): Owner approved keeping the production Engine interface in T-009; the foundation gate measures the worker/fallback spike instead.
- v0.1 T-007 completion (2026-10-09): Recorded run 37884550873/commit 93b23bf with three successful full-gate jobs; checked only the two evidenced CI gate items. All other milestone gate items remain open.
- v0.1 T-007 Ubuntu environment (2026-10-09): Added isolated D-Bus session setup after the supplied Ubuntu log passed tests but failed on Electron errors. Error/warning rejection remains required; a fresh three-platform run is still needed.
- v0.1 T-007 CI (2026-10-09): Clarified approved full-gate execution on every platform and remote evidence required before checking T-007; local workflow checks do not establish CI success or engine coverage.
- v0.1 T-005 fixtures (2026-10-09): Linked inventory, runtime recipes and generator evidence; documented format applicability. Corrected the impossible WITHOUT ROWID/no-primary-key QA item to match approved FR-020.
- v0.1: Initial version.
