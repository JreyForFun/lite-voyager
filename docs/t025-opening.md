# T-025 opening integration

T-025 is complete after repaired d6cdaf9 passes Windows/macOS/Ubuntu CI run
39369888255. Exact confirmation and retained limits are in
[t025-ci-repair.md](t025-ci-repair.md#repaired-candidate-ci-confirmation-2026-10-20).
T-026 starts in a fresh chat; no milestone closure or release/tag follows.

Post-push run 39304280687 fails the Ubuntu runtime-log gate despite all tests
passing. The scoped fixture-lifecycle repair and fresh evidence are recorded
in [t025-ci-repair.md](t025-ci-repair.md); this file preserves earlier history.

## Owner-approved acceptance (2026-10-18)

The owner authorizes implementation, fixtures, necessary scoped repairs and
assistant visual QA; the owner retains push and actual-candidate CI.

- D-5: Given a saved local CSV, TSV, JSON, JSONL or XLSX file, Open With /
  Reopen Editor With offers one Lite Voyager entry that opens the existing
  appropriate bounded preview/import flow in the actual custom-editor tab.
- D-5: Explorer's Open in Lite Voyager and an editor-title button route the
  selected/active supported source through the same editor. SQLite retains
  header validation and its existing defaults, including arbitrary-extension
  files opened explicitly. Unsupported non-local/untitled inputs fail clearly.
- D-5: All five tabular formats keep their normal editor by default. The
  application-scoped liteVoyager.openCsvByDefault setting defaults to false
  and opts all five formats into Lite Voyager for subsequent opens.
- D-5: Stable VS Code APIs cannot dynamically change contributed editor
  priority. Opt-in therefore adds missing global workbench.editorAssociations
  entries. Existing explicit global/workspace/folder associations take priority.
  Conservatively, any explicit pattern potentially affecting a format prevents
  adding its global default, even if that pattern targets only some filenames.
  Turning the setting off removes only unchanged entries created by this feature.
  User edits/removals while enabled are respected, including across reloads;
  changing defaults never forcibly reopens an existing or dirty text editor.
- D-5: One optional all-filename registration dispatches to SQLite or tabular
  documents, avoiding duplicate indistinguishable picker entries. The title
  button covers all five tabular formats and the four SQLite extensions.
- NFR-001 / FR-004 / FR-005 / FR-006 / FR-007: Reuse existing worker loaders,
  exact values, paging, import options, source protection, warnings/consent,
  explicit import, SQLite save and cancellation/cleanup. Closing a custom editor
  cancels its session; late resolution cannot revive it. Split views are isolated.
- Test first; run standalone verification and applicable real-host/visual QA.
  Preserve every failed run and exact diagnostic, with unchanged gate rules.
- D-5 / FR-002: Arriving preview/result pages render their bounded visible
  cells even when animation frames do not run. Old data is never reported under
  a replacement page; browser status publishes after controls/messages settle.
- FR-018: A native clipboard write that resolves without preserving the exact
  prepared text must not produce a success message. Perform one write and one
  exact readback, with no retry or rollback. A mismatch or API rejection reports
  that the copy could not be verified; a failed verification cannot promise the
  clipboard was unchanged. Preserve cancellation/context/disposal guards and
  never log clipboard contents. This verifies a snapshot, not future ownership
  of the system clipboard or the cause of an intermittent platform failure.

## Test coverage

- `test/unit/file-opening.test.ts`: format routing, contribution contract,
  default-off, all-five-format opt-in, conservative explicit associations,
  unchanged owned removals, user edits/removals and reload behavior.
- `test/unit/opening-defaults.test.ts`: real configuration adapter with mocked
  host events, serialized writes, ownership journaling, write failure/recovery,
  disposal, selected/active URI command dispatch and actionable input failures.
- `test/unit/tabular-editor.test.ts`: existing-controller panel dispatch,
  existing SQLite validation route, pending disposal/cancellation and backups.
- `test/unit/csv-import-panel.test.ts`: custom-editor mounting handshake;
  inherited exact imports, consent, source safety, saves and shutdown remain.
- `src/test/file-opening.test.ts`: actual custom-editor registration and supplied
  panels for all five formats on both engines, normal default-off opening,
  command/Open With routes, exact int64/literal text preview/import DOM,
  hide/show restoration, cleanup/source bytes, two isolated views with
  cancellation, opt-in normal opening, explicit JSON text association and
  preservation of a dirty buffer without saving it.

## Retained failures and repairs

- Initial sandbox Vitest/esbuild startup fails with `spawn EPERM`. Normal process
  access resolves this tooling restriction; neither attempt is an application pass.
- Red-first new suites fail on missing opening modules. The first focused suite
  then passes 20 tests; broader existing SQLite/import regressions pass 52.
- Initial strict checks catch missing explicit custom-document context fields,
  unbound test method references, unsafe matcher nesting and test mock typing.
  Fix the tests without dropping their assertions or weakening checks.
- First focused host (`out/t025-focused-first-failed.log`, profile
  `out/integration-profile-t025-4KJuoM`) fails two cases: resolving a custom editor
  waits for an initial message delivery before VS Code mounts the webview, so
  it disposes its own panel. A new unit regression fails with `error` instead of
  `ready`. Custom-editor attach now returns before mounting; its ready handshake
  starts preview asynchronously. Standalone command initialization is retained.
- Second focused host (`out/t025-focused-repaired.log`, profile
  `out/integration-profile-t025-YJMvZb`) passes all three behavior tests but fails
  the unchanged strict runtime-log gate: two `Blocked vscode-webview request`
  errors at `20261018T153854/main.log:8` and `:9`. The defaults fixture closes tabs
  while they are still mounting. Add assertions for ready state and actual
  rendered preview before closing; no diagnostic is exempted or suppressed.
- Third focused host (`out/t025-focused-third.log`, profile
  `out/integration-profile-t025-HlFbg5`) passes all four tests in 32 seconds,
  including the new split-view cancellation case. The strict runtime scan passes
  with one exact approved diagnostic: source
  `20261018T154150/window1/renderer.log:9`, original severity `warning`,
  `VSCODE-HOST-001`, message
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  This run is not warning-free. Earlier failures remain failed.
- Initial standalone `npm run verify` passes all 884 units /89 files in
  397.39 seconds, strict types/lint, production build and 34-file /981.1-KB
  packaging, with zero errors/warnings (`out/t025-verify.log`). This precedes
  the later review repairs and does not validate those repairs.
- Owner explicitly authorizes one independent read-only reviewer. Self-audit
  and review confirm extension-only routing loses SQLite files renamed with
  tabular suffixes, and a configuration edit/disposal during journal persistence
  can publish stale settings. Three new regressions fail before the bounded
  16-byte asynchronous header read and snapshot/disposal guards are added.
- Reviewer then identifies tentative unpublished ownership claiming a user's
  explicit matching Lite Voyager association. Three more regressions fail for
  snapshot change, rejected settings publication and disposal. Roll back to
  confirmed ownership when publication does not happen; preserve committed
  ownership after a successful in-flight write. Both repaired suites pass all
  20 tests; the read-only follow-up finds no remaining concrete defects and
  explicitly does not claim reviewer-run tests. New real-host assertions cover
  actual SQLite files under all five tabular suffixes on both engines.
- First final-candidate full gate (`out/t025-full.log`) stops at lint: the
  regression's closure-captured defaults variable needs `const`. Its initializer
  schedules asynchronous work, so the callback safely captures the later const
  declaration. Correct only that test declaration; retain every assertion and
  the failed gate. This attempt does not run unit or host tests.

## Delegated visual QA

Read the complete computer-use skill/guidance/API/confirmation policy and
initialize the supplied `@oai/sky` runtime. An initial VS Code capture returns a
Chrome screenshot beside a VS Code accessibility tree, so it proves no VS Code
appearance. A separately launched disposable VS Code QA window is discovered,
but binding and the one refreshed-binding retry both fail with
`window id 5178968 no longer belongs to Microsoft.VisualStudioCode; current owner is Microsoft.VisualStudioCode`.
Stop native input attempts under the documented recovery limit. Only disposable
QA processes with the exact cached executable and isolated QA profile marker
are closed afterward; the user's VS Code/browser sessions are preserved.

Render actual production HTML/JS/CSS and real loader previews in six disposable
local Chromium profiles, with mocked VS Code transport and test-only theme
variables/CSP style relaxation in generated HTML. Inspect every image in
`out/t025-render/`: CSV, JSON and XLSX each in light and dark themes. Import
controls, first-row headers, literal script-looking text, emoji, exact
9007199254740993 and the persistent XLSX memory explanation are readable;
CSV options and XLSX expandable help remain reachable. This is component layout
QA, not physical VS Code/native menu/title-button/dialog observation. Real-host
execution and DOM assertions are separate evidence. Native physical interaction,
macOS/Linux visuals and actual-candidate CI remain unobserved.

## Gate status

The repaired full gate (`out/t025-full-repaired.log`) passes 890 units /89 files,
types/lint/build and packaging, then FAILS with 62 host passes /10 failures (44m).
The 5-GB JSONL full-data query has cachedRows=100/renderedRows=0; all four T-025
cases time out in ready phase without DOM status. Two T-020 and three T-021
cases likewise lack rendered DOM despite loaded preview data. Both populated
1/5-GB CSV memory/paging cases pass. These failures remain evidence.

Two grid regressions fail first with no animation frame and with a queued scroll
frame during replacement. The repair renders only bounded visible cells on
setPage, cancels the pending frame, preserves disposal and old-DOM guards and
keeps scrolling/resizing frame-coalesced. Existing FR-018 status-ordering coverage
then catches an intermediate stale operation message; browser callers now publish
only after the whole page/control/status update. All 52 grid/browser/import-view
tests pass, including late-callback disposal. Independent read-only review finds
no remaining concrete defect. Why the original host frames stalled is unproven;
this repair removes that liveness dependency without changing any budget.

The failed full-run runtime scan also fails on renderer.log line 248, severity
error, `10 tests failed.` Its approved warning is HOST-001 at
`20261018T160558/window1/renderer.log:10`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The repaired focused host (`out/t025-focused-grid-repaired.log`, isolated profile
`out/integration-profile-t025-tJx2Dh`) passes all four cases in 38 seconds. Its
sole approved record is the same exact HOST-001 message at
`20261018T165355/window1/renderer.log:9`, severity warning. Neither run is
warning-free. The new actual-candidate full gate in
`out/t025-full-grid-repaired.log` is INTERRUPTED: 892 units /89 files (332.27 s),
types/lint/build/package and both populated SQLite sizes pass; output stops at
17:13 during populated JSON checks without a final result. On owner instruction
to strictly continue, the 22:53 inspection finds no surviving owned gate/test
process. The interruption cause is unknown. This partial run is not a pass and
does not replace the earlier failure. An unchanged full gate resumes as
`out/t025-full-grid-resumed.log`; a hidden local wrapper records final exit status
in `out/t025-full-grid-resumed-status.json` without changing any gate or budget.
The interrupted profile's partial strict scan reports only HOST-001 at
`20261018T170355/window1/renderer.log:10`, severity warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This is not a warning-free run or a completed host/log gate.
The resumed run FAILS with 68 host passes /4 failures in 41 minutes, exit 1:
- Native T-018 clipboard readback is empty instead of 1,100,000 `x` characters;
  fallback T-018 readback is empty instead of `\N`. The production service
  correctly awaits VS Code's write API before reporting success. Installed host
  adapters also return/await the native API; origin of empty readback is unknown.
- Native T-013 exceeds the unchanged 60-second Mocha deadline. The trace does not
  locate the stage; neither teardown failure nor a highlighting race is proven.
- The final 5-GB JSONL case fails the strict OS-observer 3,000-ms snapshot guard.
  Earlier JSON sizes and 1-GB JSONL pass. This is not a loader-failure finding.

All four T-025 opening cases, T-020 preview (including sparse 3 GB), both-engine
T-021 imports/cancellation and both populated CSV sizes pass. CSV 1/5-GB sampled
peaks are 323,555,328 /312,291,328 bytes, paging growth 33,890,304 /28,073,984 bytes
and maximum host timer gaps 48.635 /46.903 ms. Source hashes match. Renderer
residency is separate; this is sampled warm-input evidence, not physical paint.

Strict scan (`out/t025-full-grid-resumed-diagnostics.log`) rejects three errors:
`20261018T230426/window1/fileWatcher.log:1` and
`20261018T230426/window1/renderer.log:83` both report
`[File Watcher (node.js)] Failed to watch c:\Users\ADMIN\lite-voyager\out\t013-host-tteULt\browser.sqlite for changes using fs.watch() (Error: EPERM: operation not permitted, watch, undefined)`;
renderer.log line 226 reports `4 tests failed.` Its sole approved record is
HOST-001 at renderer.log line 10, severity warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This run is not warning-free. Preserve every failure and unknown cause.

At that point fresh read-only review establishes no new concrete implementation
cause for these four failures. No clipboard retry/readback or budget change is
made in that phase; the later owner-delegated repair is recorded separately.
Temporary stage and clipboard-length diagnostics are prepared only in generated
host-test output; original compiled bytes are restored after that isolated probe.
It cannot clear the failed full gate. Final six component renders are refreshed
and inspected with the same native-appearance/physical-interaction limits.

The stage-instrumented probe (`out/t025-host-diagnostic.log`, profile
`out/integration-profile-t025-diagnostic-lWTKyE`) passes all four T-018/T-013
cases in 21 seconds. Both large clipboard reads return 1,100,000 characters;
both SQL cases finish normally. These failures do not reproduce in this isolated
workload, and their original causes remain unknown. The generated test is restored
byte-for-byte (SHA-256 `4a477553476808ec854b922fe6daaaf47a98f8d2758c44b614dc0a3e92c76570`).
The probe's sole approved record is HOST-001 at
`20261018T235654/window1/renderer.log:9`, severity warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
It is not warning-free and cannot clear the failed full gate. No automatic
unchanged full retry is performed; owner authorization or actual-candidate CI
remains necessary before completion can be assessed.

Final repaired-candidate standalone verification PASSES (`out/t025-verify-final.log`):
892 units /89 files (375.18 seconds), strict types/lint, production build and
34-file /981.57-KB VSIX packaging; zero errors and zero warnings. Only evidence
records and ignored diagnostic harnesses change afterward. T-025 remains
unchecked. No new dependency, other task, milestone closure, release, tag or push.

## Single owner-authorized full rerun (2026-10-19)

The owner replies `OK` to the explicit request for one unchanged full verification
attempt with all earlier failures retained. This authorizes only one run; it does
not explain the earlier clipboard, SQL-timeout or OS-snapshot failures or relax
any assertion, budget or diagnostic rule. Production source and tests remain at
candidate `798d2365d3b07dfc1e8c34ed27a505d338763871`.

`npm run verify:full` runs once in `out/t025-full-authorized.log`, with its final
exit status recorded in `out/t025-full-authorized-status.json`. The isolated
generated-output diagnostic has already been restored; this is the canonical
gate. The explicit one-run authorization is consumed by this attempt. No second
unchanged run is authorized automatically. Push and actual-candidate CI remain
with the owner; T-025 stays unchecked pending completion evidence.

The authorized attempt FAILS in the unit phase, exit 1: 891 tests pass and one
fails across 89 files (88 pass /one fail), 468.02 seconds. Host, webview and
tooling typechecks and lint pass. The failing case is
`T-051: Given real requirement definitions, When trace runs, Then it reports precisely the uncovered IDs without claiming passing tests`
at `test/unit/spec-tools.test.ts:219`, with `Test timed out in 5000ms.` Build,
packaging, integration compilation and the real-host/runtime-log gate are not
reached by this attempt; no new host diagnostic result exists.

Read-only inspection confirms the test covers both the trace CLI and a second
in-process source scan/AST analysis. Discovery stays inside `test/unit` and
`src/test`; these scripts and the failing test are unchanged. The timeout does
not locate the delayed phase or establish a T-025 defect. Its cause remains
unknown. Do not increase the deadline, optimize unrelated T-051 code or turn a
later isolated result into a full-gate pass. Preserve the earlier 892-test
standalone pass and all failed/interrupted runs separately. This explicit
one-run authorization is consumed; no second unchanged full attempt is started.

## Owner-delegated validation repairs (2026-10-19)

The owner requests all outstanding fixes before push/CI, including fixture
repairs. This is authorization to investigate and repair the failed gates;
it does not change the single unchanged-run history, any deadline, workload,
assertion or diagnostic policy. Push and actual-candidate CI remain owner actions.

The trace fixture serializes two independent scans/AST analyses inside its
existing 5000-ms budget. A phase probe records 4562.8456 ms total: CLI 2785.13,
source reading 219.02 and expected-value AST analysis 1551.73 ms. Both paths
still scan all 109 sources /790425 characters independently. Running those
independent paths concurrently takes 2505.9561 ms in the companion probe and
preserves exact stdout and empty stderr assertions. No production tooling or
deadline changes. The focused tooling suite passes 26 tests (12.24 seconds).
This identifies avoidable fixture serialization, not the exact scheduling cause
of the earlier full-run timeout. Logs: `out/t025-trace-phases.log`,
`out/t025-trace-parallel.log`, `out/t025-trace-repaired.log`.

Observer and SQL/closure diagnostics now identify the pending stage. The OS
watchdog still shares one strict 3000-ms window across snapshot processing and
the next native read; completion does not re-arm it. T-013 keeps 60 seconds and
all original assertions/cleanup. Two new regressions fail first (2 fail /12 pass)
then both suites pass all 14 tests after implementation. The first name-filter
probe selects no tests and is not evidence of a pass. Logs:
`out/t025-stage-red.log`, `out/t025-stage-red-all.log`,
`out/t025-stage-green.log`. Independent read-only review of the actual six-file
diff finds no concrete issue; it runs no tests.

Standalone `npm run verify` passes all 894 units /89 files (469.53 seconds),
strict types/lint, production build and 34-file /981.57-KB VSIX packaging with
zero errors and zero warnings: `out/t025-repair-verify.log`. This covers the
trace fixture and stage diagnostics, with no clipboard production change.
It does not clear the earlier failed full or establish the causes of empty
clipboard readbacks, the native SQL timeout or final JSONL OS-snapshot timeout.

The workload-prefixed diagnostic (`out/t025-warm-diagnostic.log`, profile
`out/integration-profile-t025-warm-6fKySa`) passes seven host cases in eight
minutes before the clipboard production repair: observer calibration, populated
1/5-GB SQLite, direct short/1,100,000-character clipboard controls and both-engine
T-018/T-013. Both native large writes/readbacks and all adapter/readback hashes
match; neither the clipboard failures nor SQL timeout reproduce. SQLite combined
host/helper peaks are 261103616 /260608000 bytes; paging growth 6516736 /0;
source hashes match. The sole approved diagnostic is HOST-001 at
`20261019T014424/window1/renderer.log:9`, severity warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
It is not warning-free and cannot replace the canonical full gate. Generated
test and extension bundle bytes are restored exactly; hashes and restoration
checks are in `out/t025-warm-restoration.json`. No clipboard content or hash
instrumentation enters production source.

The clipboard helper now awaits one native write and one read, compares the
entire exact text and rejects mismatch without retries/rollback or logging.
Both SQLite and tabular-import adapters use it. The service only acknowledges
verified writes and says `Clipboard copy could not be verified. Retry copying,
or select fewer cells.` on failure. Existing stale-request/disposal/context
guards remain. This fixes a false-success path; it does not establish the
platform failure's cause or promise clipboard ownership after the read.
The initial missing-helper test fails at module loading; a write-only baseline
then fails all eight behavioral tests, including silent write loss and a changed
final character in a 1,100,000-character value. The repaired four suites pass
40 tests (4.34 seconds), covering ordering, API rejection, no automatic retry,
explicit recovery and cancellation/disposal/context changes during verification.
Logs: `out/t025-clipboard-red-missing.log`,
`out/t025-clipboard-red-behavior.log`, `out/t025-clipboard-green.log`.
Independent read-only review of the actual helper/adapters/tests finds no
concrete defect; it runs no tests and preserves the unknown original cause.
The first canonical repaired full (`out/t025-repaired-full.log`, status
`out/t025-repaired-full-status.json`) passes strict types but fails lint with
two require-await errors in the new clipboard mocks; units/build/host are not
reached. The mocks now return explicit promises with identical behavior, without
disabling a rule. The new full runs in `out/t025-repaired-full-2.log`; no
generated-output diagnostic instrumentation is active. Earlier
failed/interrupted runs remain failed.
The second repaired full passes all 902 units /90 files (571.85 seconds),
strict types/lint, production build, packaging and integration compilation.
Its host log records a new failure: 5-GB SQLite first populated DOM is
2019.3015 ms, exceeding the unchanged 2000-ms target; 1-GB is 1469.7331 ms.
Both clipboard and both T-013 SQL cases pass. The log stops after T-019 schema
at 02:21:58 Manila time on 2026-10-19, without final totals or exit status.
At 11:17 Manila time, process inspection confirms no matching full runner or
isolated test VS Code process survives. This run is interrupted with a retained
first-DOM failure, not a full pass. The interrupted runner's session ID is gone;
no unchanged restart is performed or inferred successful.

Startup inspection identifies avoidable serialization: initial table/page
requests waited for synchronous CodeMirror construction. Browser startup now
registers response handlers and dispatches the initial worker request before
constructing/attaching the editor, allowing worker IO to overlap editor setup.
Three actual-bootstrap regressions fail first, then the initial four suites pass
55 tests. They cover immediate/delayed worker delivery and constructor failure
with late responses. An additional realistic persisted-state test passes
immediately: the existing saved-SQL fallback already preserves exact SQL across
early state updates, so no restoration repair is made. Logs:
`out/t025-startup-red.log`, `out/t025-startup-green.log`,
`out/t025-startup-restoration-red.log` (despite the last filename, all four tests
pass and it is not claimed as a red baseline). The startup reorder removes a
concrete dependency; it does not establish the sole cause of the 19-ms overrun
or relax any first-DOM/observer/workload/assertion/diagnostic gate.
The final four focused suites pass 56 tests (3.76 seconds), strict types pass,
and the reviewer finds no concrete startup/state/cleanup defect. Global lint
initially rejects the unused typed placeholder in the new mock. Its callback
type is now declared explicitly without an unused implementation parameter;
the unchanged scoped lint check passes, with no rule disabled. Production build
passes. Logs: `out/t025-startup-green-final.log`, `out/t025-startup-types.log`,
`out/t025-startup-lint.log` (one retained failure),
`out/t025-startup-lint-repaired.log`, `out/t025-startup-build.log`.

The interrupted full's partial runtime scan approves only HOST-001 at
`20261019T021355/window1/renderer.log:10`, severity warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Log: `out/t025-repaired-partial-diagnostics.log`. The partial run is not
warning-free or complete, and its first-DOM failure remains failed.

The added clipboard visual probe exposes a QA fixture issue: injected theme
styles lack the CSP nonce, so earlier nominal light/dark captures use fallback
styling. The ignored harnesses now nonce their theme overrides. Preserve those
earlier images; six refreshed CSV/JSON/XLSX screenshots are inspected in
`out/t025-render-nonce/`, and actual CellService verification-failure responses
are rendered/inspected in `out/t025-clipboard-render-final/` under both themes.
Computed background assertions confirm light/dark, and bounding-rectangle
assertions confirm the complete failure message is inside the final capture.
The intermediate 900px clipboard captures cut off that message and are not
claimed as complete visual evidence. The final unscrolled 1280x1600 captures
show it legibly with the controls and exact literal value. No production CSS
or native-binding retry is needed. These remain Chromium component renders
with mocked transport/test theme variables, not physical native menu/dialog
appearance or macOS/Linux visual evidence.

Canonical `npm run verify:full` of the startup-repaired candidate starts once in
`out/t025-repaired-full-3.log`, using a hidden local runner with final status at
`out/t025-repaired-full-3-status.json`. This follows an actual startup repair,
not an unchanged retry to green. All original guards remain. Results are pending;
owner push/CI and T-025 completion stay open.

## Unit runner bootstrap repair (2026-10-19)

Full3 FAILS in units, exit 1: 900 tests /90 files pass (506.59 seconds), with one
unhandled Vitest pool error. The `export-service.test.ts` fork never sends its
startup acknowledgement, so its six tests do not execute. There is no assertion
failure in those six tests and no evidence that ExportService caused bootstrap
failure. Types/lint pass; build/package/integration/host are not reached. Preserve
`out/t025-repaired-full-3.log` and `out/t025-repaired-full-3-status.json` as failed.
The six omitted tests pass in a narrow diagnostic (919 ms):
`out/t025-fork-start-diagnostic.log`; that does not clear the full gate.

Installed Vitest 5.0.3 pool code starts/acknowledges the runner before dispatching
the test file. Its observed error occurs in that pre-dispatch startup, not inside
the export fixture. The OS-fork stall's cause remains unknown. The authorized
reviewer finds no compatibility blocker to using fresh isolated thread workers:
test-body process exit/IPC matches are generated helper fixtures; real helper
PID/kill assertions, serializer child-process RSS measurements and unique
temporary roots retain their meaning. Globals/mocks are restored, and installed
Vitest creates fresh isolated thread workers per file.

The runner now sets `pool: 'threads'` and explicitly retains `isolate: true` plus
`maxWorkers: 1`. All existing tests, assertions, deadlines, diagnostic gates and
actual engine/export helper processes remain. This removes the failing per-file
OS-fork bootstrap mechanism; it does not prove why it stalled or guarantee a
thread can never fail to start. No dependency or production engine is changed.

A new black-box fixture preloads only a disposable child Vitest process to make
OS fork startup unavailable. Two generated suites use mutually different module
mocks and mutate global, shared-module and environment state without cleanup;
both must see fresh state. The fixture imports the actual project runner config,
runs both suites, requires exact two-file/two-test success and empty stderr, then
removes only its verified generated output directory. It has a new 10-second
child /15-second outer deadline; no existing deadline is changed. The initial
probe fails for a Windows preload path scheme, then `pathToFileURL` fixes that
fixture path before the valid red baseline. The original fork pool then fails
the synthetic fork-start case; the repaired runner plus engine/spike/export/
tooling/bootstrap suites pass all 127 tests /six files (64.35 seconds).
Logs: `out/t025-runner-red.log` (path-fixture failure),
`out/t025-runner-red-fork.log` (valid behavioral red),
`out/t025-runner-green.log`. Strict types and global lint pass, with no rule
disabled: `out/t025-runner-types.log`, `out/t025-runner-lint.log`.
Actual-diff review finds one LOW observability gap: successful nested stdout was
not forwarded to the outer strict scanner. The fixture now forwards it while
retaining its exact summaries/empty-stderr assertions. The runner plus existing
strict diagnostic suites pass 29 tests /two files (35.39 seconds), with the two
nested suite results visible: `out/t025-runner-diagnostics-green.log`. Review
confirms the finding is resolved and finds no further concrete issue.

Canonical `npm run verify:full` of this repaired candidate starts once in
`out/t025-repaired-full-4.log`, with final status in
`out/t025-repaired-full-4-status.json`. No source or specification file changes
during this run. All assertions, isolation, existing deadlines, memory limits,
workloads and diagnostic guards remain; no unchanged full retry is performed.
Results and owner-pushed CI remain pending.

## Frozen full4 result and next repairs (2026-10-19)

The frozen candidate full4 ends with exit 1 after 907 unit tests /92 files pass
(376.08 seconds), strict types/lint/build/package/host compilation pass, and
65 host passes /seven failures (33 minutes). Log/status:
`out/t025-repaired-full-4.log`, `out/t025-repaired-full-4-status.json`.
All four T-025 cases, both clipboard cases, both CSV sizes and ten-million-row
JSON/JSONL aggregate/source-hash checks pass. The CSV 1/5-GB sampled combined
peaks are 228155392 /225316864 bytes; actual paging growth is 34037760 /28008448
bytes, with all 60 Browse /20 SQL pages and source hashes retained per size.

Five failures expose frame-dependent readiness/navigation: the T-008 spike
does not report ready within its original 15-second panel timer, both T-013
cases select column 999 while their reported DOM still contains columns 0–6,
and both T-012 fidelity cases likewise retain the old viewport. The populated
SQLite first-DOM times are 625.7164 ms for 1 GB and 3900.7543 ms for 5 GB; the
latter fails the unchanged 2000-ms target. The large JSON case fails its
unchanged 100-ms host interval assertion at 207.6439 ms. It is not an OS-snapshot
watchdog failure; only the earlier 1-GB JSON memory evidence completes. No new
cause is established for either performance failure.

The final strict scan (`out/t025-repaired-full-4-diagnostics.log`) rejects
`20261019T120044/window1/renderer.log:753`, severity error, `7 tests failed.`
Its sole approved record is HOST-001 at the same renderer log line 10, severity
warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This run is failed and not warning-free. No tracked source/specification file
changed during the run; subsequent regression edits belong to a new candidate.

Independent read-only review confirms the spike initialization/page and browser
selection paths depend on animation frames. It requires silent DOM rendering
before publishing updated cell details, preventing old completed details from
being acknowledged under a new action ID. Six withheld-frame/failure/disposal/
selection-order regression cases are written before implementation. An ignored
separate opening-phase diagnostic preserves the original two-second predicate,
resolver promise/binding, fixture size/recipe checks and exact source hashes.
It measures phase boundaries only; it cannot replace the full gate or identify
unmeasured bundle-evaluation/OS scheduling causes. Diagnostic review repairs
clock placement and cleanup after a partially created document. Execution and
the red-first rendering repairs are pending; no unchanged full retry is made.

## Frame-independent navigation repair and scoped QA (2026-10-19)

All six new regressions fail against the unchanged implementation, while its
50 existing cases pass: `out/t025-frame-red.log`. The production spike now
renders initialization/accepted pages immediately, cancels pending frames and
guards rendering after failure/disposal. Explicit browser selection commits a
bounded silent viewport render before updating details and publishing status;
ordinary scroll/resize stays coalesced. The spike host fixture closes its panel
in `finally`, retaining every assertion and its original deadlines. No page,
cache, one-in-flight, precision, diagnostic or memory limit changes.

The repaired five suites pass 75 tests in 4.18 seconds, including startup and
cell details: `out/t025-frame-green.log`. Strict types, global lint, build and
host compilation pass in `out/t025-frame-{types,lint,build,compile-tests}.log`.
Actual six-file independent review finds no concrete issue in notification
ordering, failure/disposal guards, boundedness or fixture cleanup. The targeted
host run passes all 12 cases in two minutes, including every previously failed
frame-dependent path, both clipboard engines, the ten-million-row browser and
all four T-025 opening cases: `out/t025-frame-host.log`. Its sole approved record
is HOST-001 at `20261019T124102/window1/renderer.log:9`, severity warning, exact
message `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The run is not warning-free and does not clear the full gate.

Both `out/t025-navigation-render/{light,dark}.png` captures are inspected.
Current production browser JavaScript/CSS shows the selected last cell of a
100-row /1000-column page, its complete literal script-shaped text in details,
and the exact adjacent int64 value, with all animation frames withheld. Actual
computed theme backgrounds and visible exact cells are asserted before image
inspection; no production styling is changed. This brings the corrected-nonce
component renders to ten. Native UI and other-platform appearance remain
unobserved. QA log: `out/t025-navigation-render.log`.

The first isolated startup diagnostic fails during its generator child after
about three minutes, before any opening-phase measurements. Retain
`out/t025-opening-phase-diagnostic.log`; it cannot explain startup latency.
The strict scan rejects `1 test failed.` at
`20261019T123414/window1/renderer.log:27`, severity error, and approves HOST-001
at line 9, severity warning, same exact signed-out message above. It is failed
and not warning-free. A separate prepared-fixture diagnostic leaves that failed
attempt untouched and prepares its inputs before launching the host case,
using the canonical generator setup budget. The original diagnostic outer
deadline, populated size/recipe assertions and two-second opening target remain.
It has no concurrent test workloads and cannot replace full verification.

Read-only JSON host-path review finds no proven blocking defect. Parsing and
insertion run in the worker; progress is throttled/coalesced and importing
states omit preview data. The measured interval covers helper startup,
publication, database opening and HTML handoff; native process calls are useful
attribution boundaries, not established causes of the 207.6439-ms gap.
The existing JSON timer fixture now retains one bounded record of the phases
observed around its largest interval, printed after measurement stops (also on
import failure). Its original start anchor, every-tick maximum, 10-ms cadence,
100-ms assertion and cleanup remain. Read-only review finds no concrete issue;
endpoint labels do not attribute the earlier delay. This diagnostic-only edit
is in `src/test/json-import-memory.test.ts`; no production import path changes.
The prepared-fixture diagnostic also fails during setup, at the unchanged
canonical 300000-ms generator cap, with `code: null`, `signal: SIGTERM`,
`killed: true`: `out/t025-opening-phase-prepared.log`. It never launches its
host case and yields no new opening measurements or runtime diagnostic result.
No further generation retry or budget increase is performed. Read-only host
inspection at 12:50 Manila shows 1056328 KiB free physical memory of 16083528
KiB, with 92044263424 disk bytes available and other substantial workloads.
That is environmental context, not a proven cause of any timing failure. The
owner is asked whether heavy jobs can be paused for final performance checks;
no user process is stopped or modified by the assistant.

## Canonical full5 continuation (2026-10-19)

The owner offers to pause heavy jobs, then requests continuation. At 18:43
Manila the previously observed VMware/compiler PIDs are absent and available
physical memory is 1666204 KiB. This does not establish a timing failure cause.
The JSON diagnostic-only fixture edit passes host compilation and global lint:
`out/t025-json-timing-compile.log`, `out/t025-json-timing-lint.log`. No diagnostic
case remains installed in integration discovery. All six frame regressions,
their production repair, reviewed JSON phase evidence and scoped visual QA now
form a new candidate; earlier failed/interrupted runs remain failed.

One canonical `npm run verify:full` starts in
`out/t025-repaired-full-5.log`, final status
`out/t025-repaired-full-5-status.json`. Tracked source/specification files stay
frozen until it ends. This is validation of the substantive rendering repair,
not an unchanged retry or a claim that earlier performance causes are fixed.
All existing clocks, memory/page/cache limits, workloads, assertions and strict
diagnostic policy remain. Final standalone verification and owner-pushed
actual-candidate three-platform CI are still required.

## Full5 unit failure and probe cleanup repair (2026-10-19)

Full5 ends with exit 1: types/lint pass, then 912 unit tests pass /one fails
across 92 files in 405.61 seconds. The existing million-row export-memory test
exceeds its unchanged 60000-ms deadline; build/package/host are not reached.
Logs: `out/t025-repaired-full-5.log`, `out/t025-repaired-full-5-status.json`.
It has no new host/runtime diagnostic outcome. The same probe completes its
serialization in 15205.5307 ms in full4; the full5 timeout does not identify
which setup, build, child-start or serialization phase stalled. Preserve both
results and the unresolved host performance failures; no unchanged full retry.

Read-only inspection finds a concrete fixture cleanup gap: its child has no
cancellation signal, and a Vitest timeout need not await its body/finally.
Installed Vitest 5 types/runtime expose a test signal aborted on timeout and
awaited `onTestFinished` hooks. Two real-child regressions fail against the
original missing cancellation behavior, then the fixture gains a test-only
probe helper that rejects pre-aborted starts, wires cancellation to the child,
awaits actual closure before returning, and kills/awaits pending work in the
registered cleanup hook before deleting only its verified temporary directory.
The existing 60000-ms deadline, million rows, >100-MB output, per-chunk RSS peak,
65536-byte bound and memory-growth assertion remain. Phase labels now identify
setup/build/child progress. No production serializer behavior changes.

The timeout's cause is still unknown. No orphan matching the test probe is
observed after the failed full. Review identifies repeated full
`process.memoryUsage().rss` calls as a profiling target; the installed Node API
also provides RSS-only sampling. No sampler change is made without measurement.
Red baseline: `out/t025-export-cancel-red.log` (two behavioral failures).
The first repaired two suites pass three tests in 16.00 seconds; stage evidence
places build completion at 185.0550 ms, child completion at 14712.6687 ms and
serialization at 14290.5518 ms (`out/t025-export-cancel-green.log`). This narrow
observation does not reproduce or explain the full5 timeout. Normal cleanup
remains awaited inside the original test's `finally`; an idempotent registered
hook awaits that same cleanup on timeout/cancellation paths.

The first strict lint run rejects two non-Error promise rejection paths in the
new helper, while strict types pass. Explicit Error normalization fixes them
without disabling rules: `out/t025-export-cancel-{types,lint}.log` retains those
results. Three focused suites then pass ten tests (17.10 seconds), including
the existing serializer fidelity/Unicode/slow-sink/failure cases:
`out/t025-export-cancel-green-final.log`.

Read-only actual-diff review finds a LOW diagnostic regression: unlike the
previous promisified `execFile`, callback errors lost captured stdout/stderr.
A new real-child case fails first (one fail /two pass), then both streams are
attached to the original Error while preserving its exit status. The repaired
three suites pass all 11 tests in 16.45 seconds; the original million-row body
finishes at 14077.1257 ms. Logs: `out/t025-export-diagnostics-{red,green}.log`.

The sampler comparison (`out/t025-export-rss-profile.log`) keeps the exact
one-million-row /141888926-byte output, 2166 chunks, 2167 RSS samples, 65536-byte
maximum chunk and original memory/time guards in each isolated run. Full
memory accounting consumes 47.3912 ms cumulatively during 14640.7876 ms of
serialization; RSS-only sampling consumes 27.3390 ms during 15184.5322 ms.
That gives no evidence for a sampler change or explanation of the timeout.
The original full sampler remains; no production serializer change is made.
Final strict types/global lint pass in `out/t025-export-final-{types,lint}.log`.
Independent follow-up confirms captured-error diagnostics are preserved and
finds no remaining concrete issue in the three-file fixture repair. This
closes the review finding, not the unexplained full5 timeout or host timing
failures.

## Canonical full6 (2026-10-19)

`npm run verify:full` ends with exit 1 after 48m06s overall: strict types/lint,
916 unit tests /93 files (384.48 seconds), build, 34-file /981.8-KB package and
host compilation pass; the host reports 71 passing /one failing (38 minutes).
Logs: `out/t025-repaired-full-6.log`, final status
`out/t025-repaired-full-6-status.json`. Tracked source/specification files stayed
frozen until completion. Every previous failure remains; no timeout, workload,
sampling or diagnostic guard changed.

All four T-025 cases and all five repaired frame-dependent host paths pass.
Populated SQLite 1/5-GB first-DOM times are 896.0408/1046.7321 ms; sampled
host-plus-helper peaks are 281108480/289910784 bytes with 5861376/15519744-byte
paging growth. Both ten-million-row JSON/JSONL aggregate/hash checks pass.
All four populated JSON/JSONL 1/5-GB checks pass: host timer maxima are
44.8390/50.0183/66.8695/56.4028 ms, with peaks
296030208/292343808/290693120/295448576 bytes. CSV 1/5-GB cases both complete
60 Browse and 20 SQL pages and source hashes; first DOM is 233.3016/502.4583 ms,
peaks 306651136/298569728 bytes and paging growth 16384000/42098688 bytes.
These observations clear neither prior failures nor unexplained causes.

The sole failed host is native T-018's first two-character SQL-NULL copy.
Its final status has cell (0,0), exercise 42, revision 11, busy false and the
explicit message `Clipboard copy could not be verified. Retry copying, or select fewer cells.`
The success-only predicate reaches its unchanged 15000-ms DOM deadline.
The log establishes honest failure reporting, not whether the native write
rejected, read rejected or readback differed. Fallback T-018 passes. The strict
scan (`out/t025-repaired-full-6-diagnostics.log`) rejects severity error
`1 test failed.` at `20261019T191725/window1/renderer.log:747`; its only approved
record is HOST-001 at that renderer's line 10, severity warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The full run is failed and not warning-free.

One narrow generated-bundle diagnostic records API stage, lengths and exact
equality only, without clipboard contents, retries or changed assertions.
Both T-018 engines pass in 12 seconds; every write fulfills and readback matches,
including the two-character and 1100000-character values. It does not reproduce
or explain the full failure. Logs: `out/t025-clipboard-phase.log`; restoration
record: `out/t025-clipboard-phase-restoration.json`. Original/restored bundle
SHA-256 is `dc8dfb1e027c49866a1dc1f40930f9a881ca08f982646018af2cee7bc1c26842`.
Its sole approved HOST-001 record is
`20261019T195724/window1/renderer.log:9`, severity warning, same exact message
above; it is not warning-free. No tracked implementation is instrumented.

Independent read-only review traces the installed VS Code 1.140.0 API through
MainThreadClipboard, NativeClipboardService and mainImpl to Electron's native
clipboard calls. RPC promises are awaited and our adapters preserve receiver
binding. It finds no evidenced production defect or premature JavaScript
acknowledgement. The historical native failure remains unexplained. No unchanged
full retry, arbitrary clipboard retry, weakened test or closure claim follows.
Final literal `npm run verify` passes with exit 0: 916 units /93 files in
362.16 seconds, strict host/webview/tooling types, lint, production build and
34-file /981.8-KB VSIX packaging, with zero errors and zero warnings.
Log: `out/t025-final-standalone.log`. Only evidence/status edits follow.
The failed full gate and owner-pushed actual-candidate CI remain open.

## Native clipboard metadata follow-up (2026-10-20)

Owner requests continued repairs. One targeted diagnostic repeats the populated
SQLite predecessor workload before both T-018 engines, retaining every original
assertion and clock. All four hosts pass in four minutes, including populated
1/5-GB SQLite paging/source hashes and 26 production copy operations. All 26
writes fulfill and all 26 readbacks match, including the first two-character
NULL marker and 1100000-character cells. No rejection or mismatch recurs.
Log: `out/t025-clipboard-owner.log`; ignored harness:
`out/t025-clipboard-owner.mts`. Generated extension bytes restore exactly to
SHA-256 `dc8dfb1e027c49866a1dc1f40930f9a881ca08f982646018af2cee7bc1c26842`,
recorded in `out/t025-clipboard-owner-restoration.json`. No tracked executable
file changes. The existing 916-unit standalone pass remains separate evidence.

Its sole approved record is HOST-001 at
`20261020T013446/window1/renderer.log:9`, severity warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The diagnostic is not warning-free and does not clear the failed full gate.

A passive Windows helper records sequence number, owner/open window handles,
process IDs/names and timestamps; it never opens, reads or writes clipboard
contents. API contracts are checked against Microsoft's documentation for
[GetClipboardSequenceNumber](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboardsequencenumber),
[GetOpenClipboardWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getopenclipboardwindow),
[GetClipboardOwner](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboardowner)
and [GetWindowThreadProcessId](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid).
Null handles cannot exclude clipboard access with a null associated window.
Requested polling is 20 ms; actual samples are roughly 30 ms apart and can miss
shorter access intervals. The first monitor's stdout buffers until completion;
a second direct-file monitor supplies continuous records across the copy tests.
Both stop cleanly. Helper: `out/t025-clipboard-owner-monitor.ps1`; raw metadata:
`out/t025-clipboard-owner-metadata.jsonl` and
`out/t025-clipboard-owner-direct.jsonl`; direct stderr is empty.

The direct monitor observes clipboard-open HWND 66764 /PID 7492 /process `fdm`
at Unix milliseconds 1792431549384, sequence 96; owner is test VS Code PID 21168.
Read-only process metadata identifies Free Download Manager's `fdm.exe`.
The preceding 70-character copy starts at 1792431549361, its write fulfills at
9365 and exact readback fulfills at 9371 (same millisecond prefix): the captured
FDM sample timestamp is 13 ms after that successful read. The timestamp is taken
after separate API/process lookups; it is not the exact opening instant. This
establishes a competing clipboard accessor during the tests, not the cause of
the historical failure.
The first monitor misses this brief open interval; absence in a sample is not
proof of exclusive access. No process is stopped and no user setting changes.

The concrete next check is to have the owner temporarily disable FDM clipboard
monitoring or exit it, then explicitly authorize one controlled full run. This
tests an environment hypothesis; it is not an established production repair.
Independent read-only review confirms that interpretation, the successful
26-copy result and exact restoration, with no demonstrated production defect.
The owner explicitly answers `FDM is closed; run once`, authorizing one full
check. Preflight still finds background `fdm.exe` PID 7492 with no main window;
the run has not started and the authorization remains unused. The owner is
asked to exit the tray process or confirm clipboard monitoring is off; no
process is terminated by the assistant. The prepared wrapper is
`out/t025-controlled-full-1.mts`, using fresh full log/status paths and the
unchanged literal `npm run verify:full`. Tracked source/spec files will remain
frozen while that run executes. No additional full retry is authorized.
The owner subsequently confirms `FDM has now exited`; preflight at
2026-10-20 01:47:35 Manila finds no FDM process. The single authorized controlled
`npm run verify:full` now starts, without diagnostic bundle instrumentation or
passive monitor workloads. Logs: `out/t025-controlled-full-1.log` and final
`out/t025-controlled-full-1-status.json`. This consumes the one-run approval;
the earlier failures and unknown historical clipboard cause remain. Tracked
source/specification files stay frozen until completion. A pass alone would
not establish that FDM caused the earlier failure.
Preserve all failures, the no-automatic-unchanged-full-retry policy, original
clipboard behavior and all test/diagnostic guards. T-025 remains unchecked.

## Controlled full outcome (2026-10-20)

The explicitly authorized `npm run verify:full` passes with exit 0, from
2026-10-20 01:48:12 to 02:32:03 Manila (43m51s overall). Strict types/lint,
916 units /93 files (349.37 seconds), production build, 34-file /981.8-KB VSIX,
host compilation and all 72 real-host cases (35 minutes) pass. Its log/status
are `out/t025-controlled-full-1.log` and
`out/t025-controlled-full-1-status.json`. Both clipboard engines, all four T-025
cases, all previously repaired frame paths and every populated stress case pass.

SQLite 1/5-GB first-DOM times are 825.3111/1071.0894 ms. Sampled host-plus-helper
peaks are 283418624/294379520 bytes and paging growth 6635520/12296192 bytes;
both ten-million-row sources retain exact hashes. The JSON/JSONL ten-million-row
aggregates and hashes pass. JSON 1/5-GB peaks are 299315200/301694976 bytes and
host timer maxima 59.0710/38.7369 ms; JSONL peaks are 301060096/294670336 bytes,
with maxima 38.9022/44.1787 ms. All four complete native imports retain exact
data and hashes. CSV 1/5-GB cases complete all 60 Browse and 20 SQL pages plus
source hashes: first DOM 528.7129/420.5905 ms, peaks 319479808/309006336 bytes,
paging growth 34353152/39395328 bytes and host timer maxima 73.6143/40.9655 ms.
Original clocks, population, all samples and all assertions remain unchanged.

The canonical runtime scan accepts only HOST-001 at
`20261020T015703/window1/renderer.log:10`, severity warning, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No other warning/error is accepted. This full run is not warning-free.

FDM is absent at preflight, immediately after the native clipboard pass and
after completion. Its prior sampled access remains an environment hypothesis,
not an established cause of the historical failure. All failed/interrupted
runs remain failed/interrupted records; this pass does not erase them. The
single controlled-run authorization is consumed; no further retry is implied.

The post-run freeze check compares all 316 captured tracked/new-source paths
and finds no content change (`out/t025-controlled-full-1-freeze.json`). No
diagnostic instrumentation or passive monitor runs beside the canonical gate.
The preceding literal standalone `npm run verify` remains a separate 916-unit
/93-file pass (362.16 seconds), strict types/lint/build/package and zero errors
or warnings. Executable code is unchanged since that standalone; only evidence
and status edits follow this full pass. No redundant executable test rerun or
new production change is made merely to replace a retained failure.

Local functional, regression, populated performance and scoped component visual
acceptance are covered. Ten corrected-theme component renders remain inspected;
physical native menu/dialog and other-platform appearance are unobserved.
The scoped repairs can be prepared for the owner's push and actual-candidate
Windows/macOS/Ubuntu CI. T-025 remains unchecked pending that CI; no milestone,
release, tag or remote warning-free claim follows.
Final independent read-only audit confirms the passing-run records, exact
warning, freeze parity and 30-file staged scope with no concrete findings.
Owner README/PLAN/T-015 edits and unrelated fixtures remain unstaged.

## Project files

- `package.json`, `vitest.config.mts`, `CHANGELOG.md`, `PROGRESS.md`.
- `src/extension.ts`, `src/editor/file-opening.ts`,
  `src/editor/tabular-editor.ts`, `src/editor/csv-import.ts`.
- `test/unit/file-opening.test.ts`, `test/unit/opening-defaults.test.ts`,
  `test/unit/tabular-editor.test.ts`, `test/unit/csv-import-panel.test.ts`,
  `src/test/file-opening.test.ts`.
- `webview/browser-grid.ts`, `webview/sqlite-browser.ts`,
  `test/unit/browser-grid.test.ts`, `test/unit/browser-startup.test.ts`,
  `test/unit/test-runner.test.ts`.
- `webview/virtual-grid.ts`, `test/unit/virtual-grid.test.ts`,
  `test/unit/browser-view.test.ts`, `src/test/webview-spike.test.ts`.
- `src/test/json-import-memory.test.ts`.
- `test/unit/export-memory.test.ts`, `test/unit/export-memory-probe.ts`,
  `test/unit/export-memory-probe.test.ts`.
- `src/test/sqlite-browser.test.ts`, `src/test/sqlite-editor-lifecycle.ts`,
  `src/test/sqlite-memory-observer.ts`, `test/unit/spec-tools.test.ts`,
  `test/unit/sqlite-editor-lifecycle.test.ts`, `test/unit/sqlite-memory.test.ts`.
- `src/editor/clipboard.ts`, `src/editor/cell-service.ts`,
  `src/editor/sqlite-editor.ts`, `test/unit/clipboard.test.ts`.
- `specs/SPEC.md`, `specs/PLAN.md`, `specs/TASKS.md`, `specs/VALIDATION.md`,
  `docs/t025-opening.md`.

Disposable fixtures, QA harnesses, logs, profiles, screenshots and the scoped
index-preparation patch are in ignored `out/t025-*` / `out/integration-profile-t025-*`.
No committed fixture or dependency is changed. Preserve and exclude preexisting
README/T-015 edits, debug.log, gingTryWan and unrelated untracked fixtures.
