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
- **Owner-approved T-007 host exceptions:** only structured `[warning]` records
  in a dated VS Code session's `windowN/renderer.log` may match either exact
  message family below. Report every accepted record with source, line, original
  severity, rule ID and message; never call such a run warning-free. All errors,
  other warnings, altered scopes/messages and records from other log sources fail.
  - `VSCODE-HOST-001`: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
    A signed-out test fixture deliberately has no credentials; the bundled host
    logs this during provider registration even with cloud sandboxes disabled.
  - `VSCODE-HOST-002`: `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took Nms.`
    `N` must be an integer duration. This is the vendor's synchronous startup
    schema contribution, not Lite Voyager work or its responsiveness measurement.
  The original manifest-creation and cloud-dictation timeout warnings remain
  failures. Console diagnostic checks, types, lint and builds retain zero
  errors/warnings. No blanket vendor-warning allowance or retry-to-green is permitted.
- Do not weaken a test, skip it, or delete it to make it pass. Fix the code, or change the spec first.
- Do not silence the type checker (`any`, `@ts-ignore`) or the linter without a written reason next to it.

T-007 CI runs the full gate on Windows, macOS, and Linux; Linux uses
`dbus-run-session -- xvfb-run -a npm run verify:full` for an isolated session bus
and virtual display. Workflow contract tests and a local YAML parse
verify configuration, not runner compatibility. To complete T-007, provide the
GitHub Actions CI run URL, tested commit SHA, and successful conclusions for all
three Full verification jobs. For failures, provide the failing step's log with
its first error or warning. Keep T-007 unchecked until that evidence is seen.
T-002 now covers both real database engines in the foundation spike. Production
Engine selection, fallback UX and its permanent force-fallback hook follow in
T-009; the milestone-specific engine gate below preserves that distinction.

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
follow-up review found no remaining concrete defect. Local full verification
passes with 103 unit tests, six integration tests and strict runtime logs in
VS Code 1.140.0; VS Code 1.141.0 also passes integration tests and strict logs.
The owner pushed the fixes and evidence. [Fresh run 37922970386](https://github.com/JreyForFun/lite-voyager/actions/runs/37922970386),
attempt 1, commit `0e3ec57de8254b80a2aa8bc830ea65c527e8301c`, succeeds on
2026-10-09. GitHub API metadata confirms all three Full verification jobs and
their applicable full-verification steps succeeded. T-002 and its specific
foundation checklist item are complete; all other milestone gate items retain
their previous status. No milestone gate or release tag is complete.

### Layer 2: Per-task validation (spec to test)

T-007 repair evidence (2026-10-10): final local `npm run verify:full` passes on
Windows x64 with 197 unit tests, eight integration tests in VS Code 1.140.0,
strict types/lint, builds and a 15-file VSIX that excludes the authentication
fixture. One `VSCODE-HOST-001` record is reported; no unexpected diagnostic is
accepted. Red-first tests cover missing profile initialization/fixture wiring
and the new diagnostic-policy behavior; rejection tests retain the original
warnings and cover errors, changed scopes/messages and wrong sources.
An earlier standalone `npm run verify` passed with 185 tests before the new
policy tests; final full verification repeats all those stages with 197 tests.
The owner's supplied latest macOS log passed its tests but failed on the
original manifest/dictation warnings. Old Windows annotations report a 5-second
responsiveness-test timeout. Current local tests retain the 100,000-row workload,
timer assertion and timeout, use fewer disk commits, and additionally verify
all rows and unchanged-source hashes. Fresh remote evidence is now verified:
[run 37956761308](https://github.com/JreyForFun/lite-voyager/actions/runs/37956761308),
attempt 1, commit `f3d82bb365f3886a18b950bbf61141a16b321faa`, passes on
2026-10-10. GitHub API metadata confirms successful locked installation and
all three Full verification jobs, including the applicable Linux session-bus/xvfb
step and Windows/macOS full-verification steps. This closes the T-007 repair
under the approved host policy; remote warning counts are not claimed.
Completion-documentation `npm run verify` also passes locally with 197 unit
tests, strict types/lint, builds and packaging; zero errors/warnings.

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
- [x] `npm run verify:full` is green locally and in CI on all three operating systems. *(T-052 adjusted-fixture local full gate plus run 37962951570/attempt 1/6b2d665; approved host policy applies.)*
- [x] NFR-001 test passes: a source file's hash is identical before and after browsing and querying. *(Foundation worker/query and CSV spike scope; production browse coverage follows T-016.)*
- [x] Every requirement for this milestone has at least one test (reconcile `npm run trace` against the milestone's scope; no gap in its required acceptance criteria). *(T-052 coverage regression passes; global future gaps remain reported.)*
- [x] Measured numbers (open time, peak memory) are recorded in `PLAN.md` and compared with the NFR targets. *(T-002 runtime/cancel, T-004 standalone memory/parsed preview, T-008 cache/render measurements; production targets stay open.)*
- [x] Manual QA checklist for the milestone is complete. *(Existing owner T-002/T-004/T-008 evidence reconciled below.)*
- [x] Independent review done (section 6) and its high-severity findings fixed. *(Fresh-context foundation review and post-fix checks below; no remaining concrete HIGH/MEDIUM finding.)*
- [x] No unexplained `TODO` or `FIXME` left in the code. *(Search of src, webview, scripts, test and .github on 2026-10-10 finds no markers.)*
- [x] Specs, changelogs, and `PROGRESS.md` are up to date; git tag created. *(Foundation closure records commit tagged locally v0.0.1; owner pushes.)*

### Milestone 0 (foundation)
Milestone 0 validates the explicit spike criteria, not completed production
features. Its linked requirement IDs are FR-004, FR-015, FR-016 and NFR-001
through NFR-005 plus NFR-009. The foundation coverage regression checks those
links against actual unit/integration test declarations. T-008 and tooling
criteria also have task-ID tests and the recorded owner QA. A matching test
name is an index, not evidence of full requirement completion: review the real
assertions and passing output. The global `npm run trace` must continue reporting
unimplemented later requirements; do not hide gaps, rename unrelated tests, or
implement future features to make the global list empty. Production performance,
fallback UX, custom editors, accessibility and logging remain their later tasks.

- [x] CI is green on three operating systems. *(Run 37962951570/attempt 1 verifies adjusted-fixture candidate 6b2d665, including all applicable full-verification steps.)*
- [x] Spike results (T-002, T-004, T-008) are written into `PLAN.md`. *(Measurement sections and T-052 feasibility decision.)*
- [x] T-002 proves worker open/query/cancel/reopen inside a killable helper, confirms helper exit within 1,000 ms after SQL execution begins, and verifies real sql.js fallback when the built-in is unavailable. Local verification, owner manual QA, and fresh three-platform CI pass (run/SHA above). The production `Engine` interface, fallback banner/large-file prompt, and permanent force-fallback hook follow in T-009 (Milestone 1).

#### T-052 foundation evidence reconciliation (2026-10-10)

The owner authorized necessary gate decisions, repairs and fixture edits and
retains responsibility for pushing. T-052 is the single closure task; T-009 is
not started. D-2 is accepted by delegated judgment and R-1 retains its documented
mitigation. No dependencies or committed fixture data changed.

Acceptance-to-test evidence:
- T-002 source preservation: `test/unit/sqlite-spike.test.ts` hashes disposable
  source copies after SELECT and refused writes on both engines. WAL/source
  hashes and fallback rejection are also tested in `src/test/sqlite-spike.test.ts`.
- T-002 runtime/cancellation/security: real native/fallback worker tests prove
  exact values, trusted_schema off, no extension loading, helper exit within
  1,000 ms, reopening and full serialized-page bounds. Actual cancellation tests
  now start with FR-015; checkpointed-WAL rejection starts with FR-016. Assertions
  and timeouts are retained, and other NFR-001/NFR-002/NFR-005 tests remain.
- T-004: `test/unit/csv-import-spike.test.ts` covers streaming text fidelity,
  malformed input, source hashes, row/value verification, caller responsiveness,
  cancellation/output cleanup and honest NFR-003/NFR-004 measurement scopes.
  PLAN records the owner-run 10-million-row benchmark and independent comparison.
- T-008: protocol, grid-window, virtual-grid and webview-spike unit tests cover
  bounded paging/cache/rendering, full-range navigation, exact/literal text,
  stale replies, CSP, visible failures and disposal. Real-host webview tests
  initialize/close/reopen. PLAN records owner typing, scrolling, navigation,
  resizing, themes and editor-choice checks, plus T-002/T-004 owner checks.
- Foundation tooling: fixture/generator/inventory, compiler/protocol, check-runner,
  CI/config/log-policy, spec-tools and dependency-audit tests cover the other
  completed tasks. `foundation-gate.test.ts` cross-checks all nine linked spike
  IDs against real test declarations; it initially failed on FR-015/FR-016.
  Global trace now reports 22 later requirement naming gaps. A matching spike
  name does not establish completed production FR-004/FR-015/FR-016 behavior.

Independent review: a fresh-context reviewer computed and examined the actual
`04c7bd7..e02f38f` foundation diff and current repair diff, using Constitution
and linked acceptance criteria rather than the author's summary. It reviewed
worker/helper lifecycle, source safety/fallback, CSV import, bounded webview/
protocol/security, fixtures, packaging and diagnostic policy. It found:
- MEDIUM, Constitution 6 / T-004: Papa Parse silently drops whitespace after a
  closing quote. Six new real-import cases reproduced acceptance/data loss before
  the fix. The streaming validator now rejects non-delimiter text after closing
  quotes, including across chunks; seven rejection cases verify source preservation
  and partial-output cleanup, and two valid whitespace/escaped-quote cases pass.
- LOW, NFR-005 recovery: a worker failure message can precede helper exit, so
  immediate reopening fails. The strengthened existing test failed before the
  fix. Failed sessions now terminate and confirm exit before replacement opening;
  the regression also checks the old PID is dead. The current command's explicit
  finally-close flow already allowed recovery, so this was not a user-blocking
  production failure.

Final local `npm run verify:full` passes on Windows x64 / VS Code 1.140.0:
207 unit tests, eight real-host integration tests, strict types/lint/build and
15-file VSIX packaging (468.83 KB). Native/fallback executing-query cancellation
takes 30 ms / 28 ms, with helper exit, reopening and source hashes verified.
One VSCODE-HOST-001 signed-out renderer warning is explicitly reported with
source, line, severity, rule and message. No unexpected warning/error is accepted;
this run is not warning-free. Fresh three-platform CI for the committed T-052
candidate is recorded below; the earlier f3d82bb run does not test these repairs.

The reviewer independently reran the 35 SQLite cases and the original CSV
reproductions after repairs; they pass/reject correctly, with no remaining
concrete HIGH/MEDIUM defect. Earlier focused review ran 135 tests and failed
only the newly strengthened crash regression before repair. Review lowers
risk; it does not prove absence of defects. Existing subjective owner QA is reused honestly;
production multi-GB UI performance, accessibility, dual-macOS-architecture and
built-in-extension coexistence remain later validation.

#### T-052 candidate CI and local fixture timing follow-up (2026-10-10)

The owner supplied [run 37961300752](https://github.com/JreyForFun/lite-voyager/actions/runs/37961300752).
Public GitHub API metadata verifies attempt 1 at exact commit
`d18e5e6c4f9045524bd2ec05bb7dcebea2dbb155`, completed successfully
2026-10-09 16:46:17 UTC (2026-10-10 in Asia/Manila). Ubuntu job 113924516849,
macOS 113924517083 and Windows 113924517213 all succeed, including locked
installation and each applicable platform's full-verification step. Only
inapplicable alternative platform steps are skipped. Remote warning counts
are not claimed; the approved diagnostic policy applies.

Completion-documentation `npm run verify` then failed locally: the existing
FR-004 quoted-header case took 5,045 ms and exceeded its original 5,000 ms
timeout. Its 70 KB header was read in 7-byte chunks (about 10,000 reads).
Retain the entire header, embedded LF, CRLF records, exact text/int64 assertion
and timeout; change this fixture to 4,096-byte reads so the header still spans
18 chunks, and assert that input bytes exceed the chunk size. Other quote and
UTF-8 boundary cases retain tiny/one-byte chunks. This preserves the actual
header-detection acceptance without tying it to thousands of tiny filesystem
reads. The focused adjusted case passes. Independent read-only follow-up review
confirms the original acceptance/assertions/time bound remain covered and finds
no concrete concern. No parser/helper/dependency or committed
data asset changes are made in this follow-up. Because the executable test
fixture changed, fresh full local and three-platform candidate evidence were
required before closure; that evidence is now verified below.
Final adjusted-fixture `npm run verify:full` now passes locally: 207 unit tests,
eight integration tests in Windows x64 / VS Code 1.140.0, strict checks/build and
a 15-file / 468.91 KB VSIX. Native/fallback cancellation is 28 ms / 37 ms, with
helper exit/reopening and source hashes verified. One approved VSCODE-HOST-001
record is explicitly reported from `20261010T005558/window1/renderer.log`, line
10, severity warning; no unexpected warning/error is accepted. This run is not
warning-free. The adjusted fixture's fresh three-platform CI is verified below.

#### T-052 foundation gate completion (2026-10-10)

The owner pushed the adjusted fixture and supplied
[run 37962951570](https://github.com/JreyForFun/lite-voyager/actions/runs/37962951570).
Public GitHub API metadata verifies attempt 1 at exact commit
`6b2d665f39aa5c544a74c1467b838acf6b45ac8a`, completed successfully
2026-10-09 17:00:09 UTC (2026-10-10 in Asia/Manila). All three jobs succeed:
Ubuntu 113930114003, macOS 113930114323 and Windows 113930114353. Locked
installation and every applicable full-verification step succeed; only each
job's inapplicable alternative platform step is skipped. Remote host-warning
counts are not claimed; the approved fail-closed diagnostic policy applies.

All foundation acceptance criteria are met by the existing local full gate,
scoped coverage/source safety, measurements, owner manual QA, independently
reviewed fixes and this fresh three-platform CI. Only closure documentation
changes after the tested candidate. T-052 and Milestone 0 are complete; the
closure records commit is tagged locally `v0.0.1`, which the owner pushes.
This is a foundation checkpoint; production requirements stay open and T-009
starts in a fresh chat.
Completion-record `npm run verify` also passes with 207 unit tests, strict
types/lint/build and packaging; zero errors/warnings.

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
- v0.1 T-052 completion (2026-10-10): Verified run 37962951570/attempt 1/6b2d665 and successful locked installs/full-verification steps on all three platforms; completed the foundation gate and local v0.0.1 checkpoint, preserving production limitations.
- v0.1 T-052 fixture follow-up (2026-10-10): Verified three-platform candidate run 37961300752/d18e5e6, then recorded a real local quoted-header timeout and preserved its data/assertions/time bound while reducing redundant tiny reads; require fresh verification/CI for the adjusted fixture before tagging.
- v0.1 T-052 local gate (2026-10-10): Full verification passes with 207 unit/eight integration tests, source/cancellation evidence and one explicitly reported approved host warning; fresh remote candidate evidence and final tag remain required.
- v0.1 T-052 evidence reconciliation (2026-10-10): Checked evidenced source safety, scoped coverage, measurements, owner QA, independent review, marker search and spike records; reopened only current gate CI items for new executable review repairs. T-007 remains complete and no tag is claimed.
- v0.1 T-052 scope clarification (2026-10-10): Under the owner's delegated closure judgment, clarified the existing milestone-specific coverage rule without changing the global trace or production requirements; the foundation checks explicit spike acceptance and preserves future gaps.
- v0.1 T-007 repair completion (2026-10-10): Verified fresh run 37956761308, attempt 1 at f3d82bb, and successful applicable full-verification steps on Ubuntu/Windows/macOS; rechecked only the two local/CI gate items. Other foundation checklist items remain open.
- v0.1 T-007 local repair evidence (2026-10-10): Recorded final full verification, red-first coverage and the explicitly reported host diagnostic; current local/remote milestone gate checkboxes remain open for fresh three-platform CI.
- v0.1 T-007 host diagnostic policy: Owner explicitly approved two exact, source-restricted VS Code host warning families, with mandatory reporting and fail-closed tests; all other warnings and every error remain failures.
- v0.1 T-007 CI regression repair: Reopened current local/CI gate items after failed owner-supplied runs, preserving the earlier passing evidence and the zero-warning rule.
- v0.1 T-002 completion (2026-10-09): Recorded fresh run 37922970386/0e3ec57 and passing reviewed fixes, local gates and owner manual QA; checked the T-002-specific foundation item only.
- v0.1 T-002 cancellation redesign (2026-10-09): Owner authorized confirmed helper exit within one second; local, manual, and fresh CI evidence are required for closure.
- v0.1 T-002 scope clarification (2026-10-09): Owner approved keeping the production Engine interface in T-009; the foundation gate measures the worker/fallback spike instead.
- v0.1 T-007 completion (2026-10-09): Recorded run 37884550873/commit 93b23bf with three successful full-gate jobs; checked only the two evidenced CI gate items. All other milestone gate items remain open.
- v0.1 T-007 Ubuntu environment (2026-10-09): Added isolated D-Bus session setup after the supplied Ubuntu log passed tests but failed on Electron errors. Error/warning rejection remains required; a fresh three-platform run is still needed.
- v0.1 T-007 CI (2026-10-09): Clarified approved full-gate execution on every platform and remote evidence required before checking T-007; local workflow checks do not establish CI success or engine coverage.
- v0.1 T-005 fixtures (2026-10-09): Linked inventory, runtime recipes and generator evidence; documented format applicability. Corrected the impossible WITHOUT ROWID/no-primary-key QA item to match approved FR-020.
- v0.1: Initial version.
