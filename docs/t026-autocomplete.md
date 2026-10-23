# T-026: schema autocomplete (2026-10-20)

T-026 is complete (2026-10-23). Owner reports PASS; GitHub REST independently
confirms run39904711322/attempt1 at exact
b46a14eda4ba3ad2594e3a8688345da26569d4c0 succeeds for locked installs and applicable
full verification on Windows, macOS and Ubuntu. This clears actual-candidate CI.
Prior unchanged executable59a236f passes literal npm run verify:989 units/100
files, strict types/lint/build/VSIX, zero errors/warnings,585.006s and295 matching
hashes. Scoped FR-012 acceptance, independent reviews and delegated light/dark
renderer QA are retained; historical failures and observation limits stay.
Remote raw counts/approved-warning records are not retrieved; no warning-free
remote claim. The validated macOS default-renderer configuration does not prove
the historical GPU, timer or shutdown cause, or which backend was selected.
Only T-026 closes; milestone-wide QA/review, release/tag and publishing remain
separate. Owner pushes closure records; no executable change or new task.
Details and metadata: docs/t026-ci-repair.md. Earlier pending/unchecked entries
below are chronological snapshots, superseded only for current task status.

Owner delegates implementation, uncertainty resolution, scoped fixes/fixtures and
visual QA; owner retains push and actual-candidate CI. SPEC FR-012 acceptance
precedes tests/code. No whole-milestone closure, release or tag is implied.

Earlier local status (2026-10-22 Asia/Manila): candidate e64859c passes standalone
verify (967 units, zero errors/warnings) and full verification (967 units/76 hosts,
one exact approved HOST-001 warning; not warning-free). Review and scoped
light/dark actual-host renderer QA pass. Preserve all earlier failures. Owner-pushed
actual-candidate three-platform CI remains pending; T-026 stays unchecked.

Owner-supplied run 39771461612/attempt 1/exact 63dadc9 fails all three platforms
at the same four worker fixture cases: out is absent in a clean checkout. The
red-first isolated-root reproduction, fixture-only repair, preserved guards and
current validation status are in [t026-ci-repair.md](t026-ci-repair.md). Earlier
local passes remain valid historical evidence, not a current CI success claim.

Repaired executable candidate `cfa7bee` now passes literal standalone verification
(968 units/98 files, zero warnings/errors) and one full gate (968 units/76 hosts,
all 282 frozen hashes unchanged). The full has one exact approved HOST-001 warning
at 20261022T210019/window1/renderer.log:10 and is not warning-free; its exact text,
windows, metrics and retained logs are in the CI repair record. Independent review
and the clean-root regression pass. Fresh owner-pushed actual-candidate
Windows/macOS/Ubuntu CI remains open; T-026 stays unchecked.

Follow-up run39796846457 at fdf5ad2 passes Windows/Ubuntu but macOS units fail one
older JSON fixture: asynchronous source mutation from parent IPC progress is not
ordered before worker finalization. The clean-root regression passes. Retained
failure, controlled causal trace and deterministic real-worker fixture repair are
in [t026-ci-repair.md](t026-ci-repair.md). Four engine/boundary cases fail first
without injection, then all 51 focused cases and independent review pass. No
production code/UI/workflow/dependency/guard change. Reviewed executable 1c53c72
passes literal standalone (972 units/98 files, zero warnings/errors) and one full
gate (972 units/76 hosts, all 282 captured hashes unchanged). Full has three exact
approved warning records, HOST-002/004/001 at
20261022T234624/window1/renderer.log:2/3/12; it is not warning-free. Exact messages,
timings and raw evidence are in the linked repair record. Fresh owner-pushed
actual-candidate three-platform CI remains open; T-026 stays unchecked.

Run39815054580/attempt1/exact25c95c7 confirms Ubuntu success and Windows/macOS
failures: Windows passes all units/hosts then rejects a shutdown error; macOS
5-GB JSONL has a raw101.417375ms interval against the unchanged100ms limit.
All four FR-012 hosts pass on both. Causes remain unknown. Opt-in external
Windows creation identities and bounded JSON CPU/callback/GC traces preserve
literal gate commands, failure status, raw samples and every workload/guard.
Instrumentation can affect timing; no overlap establishes historical cause.
Eighty focused tests/five files, tooling/integration types and the installed
Node24.21.0 headless recorder probe pass; independent diagnostic review is clear.
Executable 649eb63 passes literal npm run verify: 986 units/100 files, strict
types/lint/build/VSIX, zero errors/warnings; 582.874 seconds, all 293 captured
hashes unchanged. Owner-pushed diagnostic CI remains pending; no new full gate
or repaired-CI claim. Exact evidence: docs/t026-ci-repair.md.

Run39894215400/attempt1/exact7f0a74e passes Windows/Ubuntu locked installs/full
checks. macOS passes972 units/14 platform skips and all76 hosts, including all
four FR-012 and every original populated data/hash/memory/timing workload, then
strict console validation rejects two Chromium ProduceMemory mailbox errors.
All four JSON/JSONL interval maxima are18-20ms; no old timing/exit cause is proved.
Independent lifecycle review finds no concrete product defect. Preserve the log.
Prepare a controlled macOS-only configuration probe: omit the existing
--disable-gpu switch, permitting ordinary VS Code rendering. Actual backend and
historical cause remain unknown. Windows/Linux arguments, isolated profiles,
versions, test sequence/workloads, clocks and error/warning rejection remain.
No sleeps, forced redraws, diagnostic allowances, new switches or dependencies.
Exact-argument regressions fail first for macOS against baseline behavior, then
63 focused cases/three files and scoped lint pass; independent review is clear.
Reviewed executable59a236f passes literal npm run verify: 989 units/100 files,
strict types/lint/build/VSIX, zero warnings/errors; 585.006s and all295
captured hashes unchanged. Owner-pushed controlled platform CI remains pending.
This is a controlled environment probe, not a proven graphics repair. Keep
T-026 unchecked. Exact errors, metadata/hash and limits: docs/t026-ci-repair.md.

## Design and limits

The existing SQLite language supplies keywords. Declare already-installed/locked
MIT @codemirror/autocomplete 6.20.3 directly; shipped declarations/source verify
its APIs and default 75-ms interaction guard. Existing notices already include
its license. No new transitive package, network asset, Engine interface or
database-worker transport operation is needed.

A bounded lexical pass recognizes current-statement FROM/JOIN references, main
qualification, ordinary aliases and quoted identifiers. At statement start only
keywords are offered. Unqualified columns use referenced tables or the selected
browse table. CTE/subquery scopes, SQL documents above 64 Ki UTF-16 units, and over
16 referenced tables receive explanations instead of guessed scope resolution.

Typed browserComplete requests reuse the supervised queue and parameterized
worker-only metadata SELECTs. Columns use temp.pragma_table_xinfo with bound
object names; no user-table data is scanned. Prefix filtering finds names beyond
the first schema page without a whole-schema cache. Replies contain at most 100
matches/65,536 name/table characters; hasMore produces a visible narrowing notice.
Names insert double-quoted with doubled embedded quotes, without rewriting SQL.

Metadata preserves successful query/export/grid context. Keywords stay available
during other work; completion does not supersede that work. Run can supersede
metadata. Superseded/disposed promises settle empty; request IDs and CodeMirror
abort events suppress stale replies. Cancellation/recovery use existing workers.
The notice sits above the editor so the popup cannot obscure its limits.

## Retained tests-first history

1. Sandbox Vitest fails at spawn EPERM. With normal process access, the first
   suite fails on absent completion modules. Two browser lifecycle tests fail
   with view.complete absent before implementation.
2. First worker tests fail on both engines with ambiguous column name: name.
   An outer SELECT sorts the projected metadata union without ambiguity.
3. Initial real-host tests fail both cases: native accepts schema table select
   before keyword SELECT; fallback Enter arrives within CodeMirror's default
   interaction guard. A failing unit reproduces statement-start schema suggestions.
   Correct the context and model a user's reading interval in host tests, keeping
   production guards/deadlines unchanged.
4. Second host run fails because both record_labels and records match rec and
   the test assumes its desired item is selected. Bounded selected-label status
   plus real arrow-key selection fixes that test without weakening assertions.
5. Focused host 3 passes two cases in five seconds. Sole approved diagnostic:
   HOST-001, severity warning, 20261020T190027/window1/renderer.log:9, exact message:
   `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
   This run is not warning-free. Host 1 also has this exact warning at
   20261020T185512/window1/renderer.log:9; host 2 has no approved warning. Both
   failed runs reject renderer `2 tests failed.` errors.
6. Focused units pass 55 tests/five files, including both real engines, 125 tables,
   1,003 columns, distant names, quoted/Unicode/prototype-like names, shadowed
   PRAGMA-function names, broken-view errors/recovery, export preservation,
   sparse messages, aborts and exact source hashes.
7. First lint rejects three unsafe stringContaining matcher assignments in new
   tests. Explicit notice assertions repair them without disables. Offline npm
   lock update fails ENOTCACHED; edit only manifest/root lock entry for the already
   installed version, preserving package records/integrities. No registry fetch.

Logs: out/t026-focused-1.log, -2.log and -3.log. The third harness reports passed
true and runner exit zero; PowerShell stderr redirection gives an outer nonzero
status. Retain this shell artifact separately, not as a clean shell pass.
Expanded host run (profile integration-profile-t026-5H66pw) passes all four cases
in 17 seconds: both engines, all five imported formats, exact quoted-column SQL,
source byte equality and actual CodeMirror keys. Its sole approved diagnostic is
HOST-001 at 20261020T190912/window1/renderer.log:9, severity warning, exact same
message above. It is not warning-free. Harness and shell exit zero.

Final inspection adds three isolation cases. Two fail first: metadata requests
clear a pending slow-sort confirmation, and an unsolicited completion reply can
settle a running SQL request. A warning-state guard and response-kind guard fix
them. The 50 context/browser tests pass afterward, including explicit selected-
table fallback versus FROM context. These guards do not change visual layout.

Repaired verify 2 passes strict types/lint and 935/936 units, failing only the
stale dependency inventory fingerprint after direct autocomplete declaration.
Preserve out/t026-verify-2.log and -status.json (all 272 frozen hashes unchanged).
Update only the inventory fingerprint/direct flag and append its dated dependency
record; all 577 package paths/versions/license evidence stay unchanged. No new
vulnerability audit is claimed. Two further regressions fail first: the test-only
Undo/Redo action lacks Command-key fallback, and a legal alias main is mistaken
for the schema name. Match the existing key-helper fallback and prefer known
aliases. All 17 completion/editor/inventory tests then pass. No weakened types,
test assertions, deadlines or platform guards.

## Visual QA

Native screenshot selection fails twice with the helper's exact message:
`window id 3080210 no longer belongs to Microsoft.VisualStudioCode; current owner is Microsoft.VisualStudioCode`.
The isolated visual host is stopped only after checking its exact profile command
line. The user's editor is untouched. Native physical paint is unobserved.

Chrome component renders use the shipped shell/CSS/JS, original nonce CSP and
synthetic typed metadata. Initial six screenshots in out/t026-render reveal a
covered narrowing notice. A geometry check fails before repair in
out/t026-render-before-fix/narrow-limit-light.dom.html. After placing the notice
above CodeMirror, all six final renders in out/t026-render-final pass the geometry,
CSP and script-error checks and are inspected: light/dark tables/views with
spaces/quotes/emoji, quoted columns/long labels and 640-pixel-wide 100-match lists.
Notice text is readable above the list and selection contrast is visible.
These are component observations; real-host keyboard behavior is separate.

## Gates and handoff

- Expanded four-case host run: PASS with the exact approved warning above.
- First literal npm run verify fails webview strict types: an optional selected-
  table flag is explicitly passed as undefined under exactOptionalPropertyTypes.
  Normalize it to a boolean; no type weakening. Units/build/package are not reached.
  Evidence: out/t026-verify-1.log and -status.json; verify 2 failure is recorded above.
- Repaired literal npm run verify: PASS, 938 units/95 files, strict host/webview/
  tooling types, lint, production bundles and VSIX packaging (34 files/996.33 KB).
  Zero errors and zero warnings; 435.353 seconds. All 272 captured source/spec/
  record hashes are unchanged. Evidence: out/t026-verify-3.log and -status.json.
- First literal npm run verify:full: FAIL, 938 units PASS /75 hosts PASS /one host
  failure, 2298.985 seconds. All 272 captured hashes match. The existing populated
  CSV case fails during its 1-GB workload with `CSV memory observer failed: OS
  observer snapshot exceeded 3000 ms; stage=waiting for next snapshot; snapshots=52.`
  No completed 1/5-GB CSV memory comparison is claimed for that run. All four T-026
  cases pass, alongside populated SQLite and JSON/JSONL workloads. Evidence:
  out/t026-full-1.log and -status.json. No unchanged full retry is started.
- A separate unchanged CSV-only diagnostic PASSes, exit zero, 299.157 seconds,
  with all original workloads/deadlines/assertions. Both sizes pass all 60 Browse/
  20 SQL pages and complete-data/source hashes. Sampled host-plus-helpers peaks:
  313,749,504 /322,875,392 bytes; actual paging growth: 29,921,280 /22,020,096 bytes;
  maximum observation gaps: 1091.0551 /882.0487 ms. Renderer residency is reported
  separately. It does not reproduce, explain or clear the failed full run.
  Evidence: out/t026-csv-diagnostic.log, -status.json and -result.json. Sole approved
  warning: HOST-001 at 20261020T201631/window1/renderer.log:9, severity warning,
  exact same CloudSandboxApi message above. Diagnostic is not warning-free.
- The full runner stops on test failure before its automatic runtime scan, so a
  separate strict scan preserves the rejected renderer error at
  20261020T194207/window1/renderer.log:827, severity error, `1 test failed.` Its only
  approved record is HOST-001 at that renderer.log:10, severity warning, exact
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  The run is failed and not warning-free. Evidence: out/t026-full-1-diagnostics.log.
- Request owner authorization for exactly one unchanged full rerun under the
  section-1 no-retry-to-green policy; do not infer authorization from elapsed time.
  Retain every failure and all guards; the historical snapshot stall's cause is
  unknown. No unrelated observer rewrite or deadline increase is made.
- Owner explicitly answers `Authorize one full rerun; retain the failure` after
  the CSV diagnostic passes (2026-10-20). This permits exactly one unchanged
  canonical full attempt with all prior failures/unknown cause retained and all
  existing checks intact. No second unchanged attempt is authorized. Commit the
  scoped candidate first; record the new full result separately.
- The one authorized unchanged literal `npm run verify:full` runs after local
  candidate commit `35f23ca`: FAIL, 938 units/95 files PASS, 75 hosts PASS and one
  host failure. Started 2026-10-20 12:26:58.889 UTC, finished 13:01:31.383 UTC
  (2072.494 seconds); all 272 captured hashes match. All four T-026 cases pass.
  This time the existing populated JSON memory case fails while generating its
  first 1-GB JSON fixture: `Command failed: ...Code.exe ...scripts/json-memory-fixture.mts
  ...out/t023-memory-mMC9SO/source.json 1000000000 json`. The command is capped at
  the unchanged 180000-ms generation deadline, but retained Mocha output contains
  no exit-code/signal/killed details; it does not establish the failure's cause.
  No populated 1/5-GB JSON/JSONL memory result is claimed for this attempt. Both
  ten-million-row JSON/JSONL full-data/hash cases pass. Evidence:
  out/t026-full-authorized-1.log and -status.json; no third full run is started.
- The authorized full does pass complete 1/5-GB CSV import/data/source checks and
  all 60 Browse/20 SQL pages per size, without changing any workload or guard.
  Sampled host-plus-helper peaks are 314,331,136 /308,731,904 bytes; paging growth
  is 32,948,224 /27,992,064 bytes; maximum observation gaps are
  1096.1203 /1157.8703 ms. Renderer residency is separate. This passing CSV result
  does not establish why the first full's OS snapshot stalled.
- Because the authorized full stops before automatic log scanning, a separate
  unchanged strict scan rejects `20261020T203829/window1/renderer.log:827`,
  severity error, `1 test failed.` Its only approved record is VSCODE-HOST-001
  at that renderer.log:10, severity warning, exact message:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  It is failed and not warning-free. Evidence:
  out/t026-full-authorized-1-diagnostics.log.
- On 2026-10-21, an isolated diagnostic runs only the unchanged first 1-GB JSON
  fixture command with the exact Electron Node runtime and original 180000-ms
  deadline. Generation PASSes in 8734.8942 ms; elapsed time through complete file
  hashing is 12812.1914 ms. The isolated fixture is then removed. All
  1,000,016,431 bytes match the generated recipe's
  243,313 rows and SHA-256
  `41eacc598a3e38c50ac6f7b7deffb88ea3786126d1da2e954c7c3b9bf9205454`;
  stderr is empty. Evidence: out/t026-json-fixture-diagnostic-result.json.
  This is fixture generation only, not an import, memory case or full-gate pass.
  It neither reproduces nor explains/clears the authorized full's failure.
  No concrete source/fixture defect is identified, so no speculative code edit,
  assertion weakening, deadline increase or additional unchanged full is made.

Historical acceptance before the later repairs: schema/keyword/quoted insertion, aliases, bounds/notices,
stale/disposed/busy/error paths, both engines, all imported formats, source safety
and scoped component visuals have passing evidence. Both canonical full attempts
remain failed for the distinct reasons above. Native physical-paint QA and
actual-candidate three-platform CI are unobserved. The single authorized rerun
is consumed; further unchanged full attempts need a new owner decision under
VALIDATION section 1. T-026 cannot be checked on this evidence.
- On 2026-10-21 the owner explicitly answers: `Retain the failed gates; no further
  full rerun`. Keep both failed fulls and separate diagnostics for investigation;
  do not start another full attempt. This decision does not clear either failure
  or change any acceptance criterion, guard or task checkbox.
- Owner-pushed actual-candidate three-platform CI: pending.
- T-026 remains unchecked. Whole Milestone 2 QA/review and release/tag stay open.

**Later owner-requested investigation (2026-10-21):** Windows Kernel-Power records
confirm idle Modern Standby spanning both failing steps. The fixture interval
includes 20:50:34 entering standby through 20:55:20 resume, followed by failure at
20:55:21. Verification lacked an awake request; isolated execution did not exercise
that interruption. The tooling-only repair and tests are in
[t026-standby-repair.md](t026-standby-repair.md). This adds evidence to the earlier
unknown-cause record, without inventing historical exit/signal details or clearing
either failed full. The owner prohibition on further full runs remains in force.

**Subsequent authorization (2026-10-21):** Owner directs full local validation,
repairs/fixtures and delegated visual QA on the repaired candidate, superseding
the earlier no-full instruction. Preserve original failures and unchanged guards;
owner retains push/remote CI. Actual-host renderer observations and separate
visual-launch diagnostics are recorded in [t026-native-qa.md](t026-native-qa.md).
The repaired-candidate full result is pending. Fresh-context independent review
reads the actual task diff and finds a MEDIUM alias defect: Unicode toLowerCase
merges SQLite-distinct Ä/ä aliases. Red-first context and both-worker tests return
lower_table.first_lower instead of upper_table.first_upper. A related ſelect
alias also fails because Unicode uppercasing mistakes it for SELECT. Two more
red cases cover quoted AS aliases and SELECT identifiers inside parentheses.
Use ASCII-only name folding and require name tokens for SQL keywords.

Independent follow-up finds one further MEDIUM case: a quoted dot alias is
mistaken for structural punctuation. Its lexical and both-worker regressions
fail before isSymbol requires symbol tokens for dots/parentheses. All 19 focused
context/worker cases then pass, including accepted identifiers executing against
both actual engines and exact unchanged source hashes. Final read-only independent
inspection reports no remaining concrete material defect in these repairs.
No guards, budgets, fixture sizes, existing assertions or dependencies change.
Actual-host post-repair Unicode completion and light/dark renderer observations
are in t026-native-qa.md. Canonical standalone/full validation follows this repair.

Candidate c55ec7f then passes literal standalone verification with 956 units/96
files and zero errors/warnings, all 277 hashes unchanged. The authorized full
passes 956 units/75 hosts and all four FR-012 cases, but fails the existing CSV
observer's separate counter/metadata discovery. Every populated JSON/JSONL size
passes; no standby event occurs. Preserve this third failed full and its exact
strict runtime diagnostics. The reproduced process-exit race, red-first repair,
independent review, original guards and fresh validation status are recorded in
[t026-csv-observer-repair.md](t026-csv-observer-repair.md). No unchanged retry or
task/whole-milestone closure is claimed.

The final reviewed fixture candidate e64859c749d1fd5cca50f5c1b19eef56337b3ea6
passes literal standalone and full gates with all 280 captured hashes unchanged.
All four FR-012 hosts and every original populated SQLite/JSON/JSONL/CSV workload
pass. Exact timestamps, measurements, retained power events and approved renderer
warning are in t026-csv-observer-repair.md. No executable changes follow these
passes; final record changes do not tick the task or claim remote CI.

New production modules: src/editor/sql-completion.ts, webview/sql-completion.ts.
Changed production: src/editor/sqlite-browser.ts, src/protocol.ts,
webview/sql-editor.ts, webview/sqlite-browser.ts, package.json, package-lock.json.
New tests: test/unit/sql-completion.test.ts, test/unit/sql-completion-engine.test.ts,
src/test/sql-completion.test.ts. Changed tests: test/unit/browser-view.test.ts,
test/unit/sql-editor.test.ts.
Records: this file, specs/SPEC.md, specs/PLAN.md, specs/VALIDATION.md,
specs/TASKS.md, specs/DEPENDENCIES.md, specs/dependency-licenses.json, PROGRESS.md.
Preserve existing owner edits; README, unrelated
fixtures/debug files and ignored out/t026-* evidence are excluded from the task.

## Complete changed-file inventory

All 44 task files relative to baseline 3d41443; owner edits are excluded:

```
.github/workflows/ci.yml
.vscode-test.mjs
PROGRESS.md
docs/t026-autocomplete.md
docs/t026-ci-repair.md
docs/t026-csv-observer-repair.md
docs/t026-native-qa.md
docs/t026-standby-repair.md
package-lock.json
package.json
scripts/ci-diagnostics.mts
scripts/csv-memory.mts
scripts/integration-launch.mts
scripts/keep-awake.mts
scripts/verify.mts
scripts/windows-awake.ps1
scripts/windows-exit-diagnostics.ps1
specs/DEPENDENCIES.md
specs/PLAN.md
specs/SPEC.md
specs/TASKS.md
specs/VALIDATION.md
specs/dependency-licenses.json
src/editor/sql-completion.ts
src/editor/sqlite-browser.ts
src/protocol.ts
src/test/csv-memory-windows.ts
src/test/host-interval-diagnostics.ts
src/test/json-import-memory.test.ts
src/test/sql-completion.test.ts
test/unit/browser-view.test.ts
test/unit/ci-diagnostics.test.ts
test/unit/csv-memory-windows.test.ts
test/unit/host-interval-diagnostics.test.ts
test/unit/integration-config.test.ts
test/unit/keep-awake.test.ts
test/unit/json-import.test.ts
test/unit/sql-completion-clean-checkout.test.ts
test/unit/sql-completion-engine.test.ts
test/unit/sql-completion.test.ts
test/unit/sql-editor.test.ts
webview/sql-completion.ts
webview/sql-editor.ts
webview/sqlite-browser.ts
```

```
npm test -- test/unit/sql-completion.test.ts test/unit/sql-completion-engine.test.ts test/unit/browser-view.test.ts test/unit/browser-startup.test.ts test/unit/sql-editor.test.ts
npm run verify
npm run verify:full
```
