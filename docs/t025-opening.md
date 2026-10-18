# T-025 opening integration

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

Fresh read-only review establishes no new concrete implementation defect from
these four failures. Do not add clipboard retries/readback or change any budget.
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

## Project files

- `package.json`, `CHANGELOG.md`, `PROGRESS.md`.
- `src/extension.ts`, `src/editor/file-opening.ts`,
  `src/editor/tabular-editor.ts`, `src/editor/csv-import.ts`.
- `test/unit/file-opening.test.ts`, `test/unit/opening-defaults.test.ts`,
  `test/unit/tabular-editor.test.ts`, `test/unit/csv-import-panel.test.ts`,
  `src/test/file-opening.test.ts`.
- `webview/browser-grid.ts`, `webview/sqlite-browser.ts`,
  `test/unit/browser-grid.test.ts`.
- `specs/SPEC.md`, `specs/PLAN.md`, `specs/TASKS.md`, `specs/VALIDATION.md`,
  `docs/t025-opening.md`.

Disposable fixtures, QA harnesses, logs, profiles, screenshots and the scoped
index-preparation patch are in ignored `out/t025-*` / `out/integration-profile-t025-*`.
No committed fixture or dependency is changed. Preserve and exclude preexisting
README/T-015 edits, debug.log, gingTryWan and unrelated untracked fixtures.
