# T-031: add and delete SQLite rows

Owner authorization: 2026-11-08 (Asia/Manila). Implement T-031, resolve its
details, edit disposable fixtures and perform visual QA. Owner retains push/CI.

## Acceptance and decisions

- FR-021 applies only to ordinary SQLite Browse tables. Explicit document write
  mode is required. Imported formats have no editing controls; SQL results disable
  row actions. Views and virtual tables refuse row actions with an explanation.
  Existing write-mode/auto-save/trust restrictions remain.
- Add row opens a keyboard-accessible form, including for empty tables. Select
  a writable column and TEXT/INTEGER/REAL/NULL, or Default (omit). Stage also applies
  the currently entered column, so missing Apply cannot silently omit it. Omitted columns
  use SQLite defaults; an entirely omitted row uses DEFAULT VALUES. Generated
  columns are excluded. No BLOB creation/editor. Exact scalar validation and
  parameter binding reuse FR-020; constraints/defaults/triggers run only on Save.
- Delete acts on one selected saved Browse row after an inline confirmation.
  Worker preparation resolves the displayed saved-data offset to a full original
  primary key or unshadowed rowid, confirms exactly one match and checks the
  selected displayed value. Composite/WITHOUT ROWID and exact 64-bit keys work;
  ambiguous nullable keys and unavailable identities refuse without mutation.
- Pending row operations have a separate bounded, paged review list showing
  additions and deletions across tables. Labelled previews do not truncate stored
  values. Browse paging, sorting, filters, counts and SQL continue to use saved
  rows; additions are not fabricated into saved-data pages and deletions remain
  visible there until Save. The UI explains this. Undo/Redo/Revert remove or
  restore operations; pending added rows can be undone before changing them.
- Repeated deletion and editing a pending-deleted saved row are refused. Within
  a contiguous group of grid edits/deletes, deletion supersedes earlier cell
  edits to that original row, including primary-key edits. SQL/insert operations
  retain queue ordering and separate groups; identity conflicts fail safely.
- Dirty state, split-view sharing, backup/recovery, queue/transport bounds,
  cancellation, source-conflict guards, explicit atomic Save and Save As retain
  T-030 rules and documented limits. All queued writes succeed together or roll
  back; pending work survives errors. No automatic source writes or new dependency.
  Backups synchronously snapshot the accepted immutable queue even while metadata
  or Save is busy. They retain the original source version: an uncertain committed
  Save cannot silently replay that queue. Empty read-only snapshots restore cleanly.
- Write FR-021 Given/When/Then tests before implementation. Cover both engines,
  defaults/NULL/empty/literal NULL, exact int64, awkward identifiers, NUL text,
  rowid/composite keys, generated/BLOB restrictions, constraints/foreign keys,
  rollback, stale selection/source changes, undo/redo/revert/recovery and empty
  tables. Preserve all existing tests and diagnostic/timing guards.
- Required local gates: npm run verify and npm run verify:full. Report exact
  approved host warning records; every other warning/error fails. Retain failed
  runs; no unchanged retry-to-green. Perform scoped light/dark visual QA.
  Independent review and actual-candidate owner-pushed CI remain explicit gates.

## Evidence

Implementation, standalone/full verification and scoped visual QA pass;
independent review/CI remain pending. No T-031
completion claim yet. Owner README/PLAN/TASKS/VALIDATION changes, unrelated files
and six diagnostic ZIPs are preserved. No dependency or diagnostic-policy change.

### Red-first and focused evidence

- `out/t031-red-core.log`: sandbox prevents Vitest spawning; no test result.
  `out/t031-red-core-unsandboxed.log`: eight expected FR-021 failures for missing
  row APIs across both engines. `out/t031-core-1.log`: all 32 staged-edit tests pass.
- `out/t031-red-ui.log`: two expected failures for missing UI/table and typed
  transport behavior. `out/t031-ui-1.log`: 77 UI/provider/browser/protocol tests pass.
- `out/t031-red-insert-guards.log`: three failures prove unapplied current form
  input and trigger-ignored inserts need guards. `out/t031-core-ui-2.log`: all 41
  core/UI tests pass after fixes. Stage applies the current column; SQLite
  `changes()` must confirm exactly one inserted row or the transaction rolls back.
- `out/t031-focused-3.log`: 83 tests pass across row/core UI/provider/source-safety
  suites. Covers defaults, NULL/empty/literal NULL, exact int64, extreme REAL,
  >1-MB Unicode, embedded NUL, awkward identifiers, composite/rowid identities,
  generated/ambiguous targets, BLOB-cell deletion, foreign-key rollback, external
  changes, Save As/source hashes, backup/restore and pending-list paging.
- `out/t031-red-order-preview.log`: child/parent deletion order fails on both
  engines; BLOB-key pending preview exposes hex. `out/t031-order-preview-1.log`:
  all three regressions pass. Deletion takes its own queue position while
  superseding its row's prior cell edits; BLOB keys show byte-count placeholders.
- `out/t031-red-untrusted.log`: an independent small regression using the built
  worker confirms that extra insert-target properties could replace `kind` with
  `sql`. Worker preparation now constructs only known validated insert fields;
  the Vitest regression checks both backends and retained source rows. This code
  changed after `out/t031-verify-1.log` started, so that gate is historical even
  if it passes. A fresh final-candidate standalone/full gate is required.
- `out/t031-red-backup-race-3.log`: two genuine failures demonstrate backup
  rejection during a busy operation and empty-backup restore rejection. Earlier
  shell quoting attempts selected no tests and are not red evidence. The fix
  snapshots accepted state without starting worker work; restore permits an absent
  version only for an empty queue. `out/t031-backup-race-1.log` passes 29 tests;
  `out/t031-backup-race-2.log` passes all 12 provider tests, including metadata/Save
  busy snapshots and empty restoration. The real-host test also requests backup
  while row metadata is busy. No source-conflict/replay protection was relaxed.
- `out/t031-verify-2.log` passes 1,424 tests in 131 files and packaging with zero
  errors/warnings, but predates that backup repair. The first full gate was stopped
  after the reproducible failure was identified; owned process details remain in
  `out/t031-full-1-stopped-processes.json`. It is not a passing run. Fresh final
  standalone/full transcripts are `out/t031-verify-3.log` and `out/t031-full-2.log`.
- Final `out/t031-verify-3.log` exits 0: all 1,427 tests /131 files pass;
  host/webview/tooling type checks, lint, production builds and VSIX dry run pass.
  Zero errors and zero warnings. Package: 36 files, 1,017.98 KB.

### Final complete local gate

`out/t031-full-2.log` exits 0 with all 1,427 tests /131 files and 81 real-host
integration tests passing (33 minutes for the host suite). All type checks, lint,
production builds, packaging and strict runtime log checks pass. The unchanged
large-file memory, paging, source-safety and responsiveness workloads also pass.
The final FR-021 host cases pass native in 1300 ms and fallback in 1526 ms,
including deterministic backup while metadata is busy. All 16 code/test/CSS hashes
still match `out/t031-executable-hashes.json` after the run. No executable change
followed either final gate; subsequent edits only record evidence and handoff.

The full run is NOT warning-free. Its sole approved record is:

```json
{"source":"20261108T183427/window1/renderer.log","line":10,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}
```

There are no other accepted warnings or errors in this final full run. Earlier
failed/interrupted runs and separate visual-session records remain above/below.
Independent review and actual-candidate three-platform CI are still pending.

### Real VS Code tests

`src/test/row-operations.test.ts` exercises actual DOM controls on both engines:
empty-table insertion/defaults, exact int64, confirmation before deletion, source
digests, VS Code dirty state, Undo/Redo, backup contents, atomic Save As and Save.
Unit tests perform actual backup restoration; the host test checks backup data.

`out/t031-host-1.log` retains two failed tests: the test clicked Save before the
Save As Browse refresh settled, when Save was correctly disabled. Cleanup then
logged a closed-database error while the outstanding read was being disposed.
The test now waits for the visible settled Save As state before clicking Save;
no runtime guard/deadline/assertion was relaxed. `out/t031-host-2.log` passes both
tests (native 2544 ms, fallback 1817 ms). It is NOT warning-free. The strict log
check accepts only this exact record:

```json
{"source":"20261108T171412/window1/renderer.log","line":9,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}
```

The focused host pass predates final boundary hardening; final full-gate evidence
must establish the complete final candidate. No three-platform CI claim.

### Visual QA and retained tool failures

Final scoped visual checks pass on 2026-11-08 using supported VS Code **1.140.0**,
both native and forced fallback engines, in an isolated test profile. All ten
saved screenshots were inspected: light form and confirmation, dark pending
changes and form, and clean post-Save state on each engine. Exact integer input,
generated-column exclusion, readable fallback limits, visible focus and source
immutability until explicit Save are covered. The disposable-source assertions
pass; the host exits successfully. Evidence:
`out/t031-supported-visual-launch-2.json`,
`out/t031-supported-visual-host-2.log`,
`out/t031-supported-visual-2-captures.json`, and
`out/t031-supported-visual-2-{native,fallback}-*.png`.
Example captures: [native light form](../out/t031-supported-visual-2-native-light-form.png),
[native dark pending changes](../out/t031-supported-visual-2-native-dark-pending.png),
[fallback light confirmation](../out/t031-supported-visual-2-fallback-light-confirm.png),
and [fallback dark saved state](../out/t031-supported-visual-2-fallback-dark-saved.png).

The unchanged strict scan passes (`out/t031-supported-visual-log-check-2.log`),
with exactly these approved records; this session is NOT warning-free:

```json
{"source":"20261108T180546/window1/renderer.log","line":2,"severity":"warning","rule":"VSCODE-HOST-004","message":"Creation of workbench contribution 'workbench.contrib.chatPetContext' took 21ms."}
{"source":"20261108T180546/window1/renderer.log","line":8,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}
```

An earlier supported-host visual session captured all ten states and passed its
source assertions, but its strict scan FAILED on renderer.log line 10:
`Error: Cannot backup in this state: Wait for the current editing operation to finish.`
The profile `out/integration-profile-t031-supported-visual-a0oCae`, screenshots,
transcript and `out/t031-supported-visual-log-check.log` are retained. The red-first
backup repair above precedes the final run; no unchanged retry or exception was used.
The temporary ignored QA harness uses existing VS Code test APIs for controls and
Electron's documented loopback screenshot endpoint only for PNG capture. It adds
no dependency or extension runtime network behavior.

That failed supported visual run also contained this approved warning:

```json
{"source":"20261108T175636/window1/renderer.log","line":8,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}
```

Earlier scoped visual observations also pass using installed VS Code **1.145.2**
in isolated test-mode profiles, with the production extension and disposable
databases. These are visual observations, not a strict-log/full compatibility
pass for that newer host. Minimum-host automated verification remains 1.140.0.

- Native profile: `out/integration-profile-t031-visual-2m9xEq`;
  launcher/transcript: `out/t031-visual-launch-3.json`, `out/t031-visual-host-3.log`.
  Read-only controls, empty-table form, exact integer input and pending previews
  were inspected in light theme. Dark-theme form, keyboard focus outline,
  generated-column exclusion and explicit deletion confirmation were inspected.
  A roughly half-width split showed wrapped controls/help/previews, shared pending
  operations and a form only in the requesting view. Explicit Save from the
  second view cleared both dirty tabs and both displayed atomic-save success.
- Native source checks: `out/t031-visual-before-save.json` records empty=0,
  observations=2 while an insert and deletion were pending. After explicit Save,
  `out/t031-visual-after-save.json` records empty=1, observations=1 and exact stored
  amount `9223372036854775807`. The source digest changes only across that Save.
- Forced-fallback profile: `out/integration-profile-t031-visual-DKFv3f`;
  launcher/transcript: `out/t031-visual-launch-4.json`, `out/t031-visual-host-4.log`.
  Its full memory-limit banner and default-aware form are readable in light
  theme; the DEFAULT VALUES pending entry is readable in light and dark themes.
  Explicit Save reports atomic success. `out/t031-visual-fallback-before-save.json`
  records empty=0/observations=2; `out/t031-visual-fallback-after-save.json` records
  empty=1/observations=2 and a NULL amount, preserving the omitted-column default.
- Screenshots were inspected in the UI tool output; no exported screenshot file
  is claimed. The visual holds were finished through their owned sentinel files;
  all source edits occurred only on disposable QA databases through explicit Save.
- Installed-host startup consoles also print three vendor product.json proposal
  mismatch notices (`timeline` for remote-repositories/remotehub and
  `agentsWindowActivation` for vscode-pull-request-github). Raw transcripts remain.
  These visual sessions are not called warning-free or a strict diagnostic pass;
  no exception is added. Full acceptance uses the unchanged strict 1.140.0 gate.
  Their strict scans FAILED: native `20261108T173136/main.log:5` and fallback
  `20261108T174013/main.log:5` contain `[error] Error: Error mutex already exists`;
  each renderer.log lines 1–3 contains the three proposal warnings. Exact records
  remain in `out/t031-visual-log-records.json` and the failed scan transcript in
  `out/t031-visual-log-check.log`. No installed vendor file was modified.

The failed installed-native scan additionally contained this approved warning
(the installed fallback scan contained no approved records):

```json
{"source":"20261108T173136/window1/renderer.log","line":10,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}
```

The initial visual tooling failures and invalid development-mode launch below
remain historical evidence. Switching the isolated QA launch to the installed
executable resolved the window binding for these observations; this does not
establish the helper's internal root cause or repair the archived-host binding.

The Windows computer-use skill was initialized and its guidance/API/confirmation
documents read. It lists the isolated QA window, but get_window and direct
get_window_state both fail after refreshed selection:
`window id 198990 no longer belongs to Microsoft.VisualStudioCode; current owner is Microsoft.VisualStudioCode`.
The alternative CUA getApp interface reports the same error. Browser fallback
reports `The browser access host is unavailable`. No screenshot was obtained
from those attempts. The owner offered to reconnect and then reiterated that
the agent should complete both implementation and visual checking.

Initial disposable development-mode visual launch
`out/integration-profile-t031-visual-9RL68u` was also invalid: the deliberately
test-only signed-out authentication fixture refused development mode, generating
authentication timeout/error records; its console emitted DEP0169. Those failures
remain in `out/t031-visual-host.log` and its profile logs. Its exact recorded PID,
executable and launch time were checked before stopping only that hidden host.
The corrected launch uses the unchanged authentication fixture in test mode with
the installed test runner's disable-updates switch and an explicit visual hold.
Its isolated profile is `out/integration-profile-t031-visual-OCooAK`; no source
edit or UI interaction was attempted because window binding failed. Its owned
visual hold was finished after the installed-host workaround succeeded. Neither
of these first two launches is a verification gate or a visual pass. No warning
allowance is added.

### Files in the implementation

- `src/staging/edit-types.ts`, `src/staging/staged-edits.ts`,
  `src/staging/sqlite-edits.ts`: typed preparation, queue, recovery and atomic writes.
- `src/protocol.ts`: bounded row actions, metadata, pending previews and DOM probes.
- `src/editor/sqlite-editor.ts`, `src/editor/sqlite-editor-ui.ts`: routing,
  reversible document events, pending summaries and accessible controls.
- `webview/row-editing-view.ts` (new): row form, confirmation and paged review.
- `webview/editing-view.ts`, `webview/sqlite-browser.ts`,
  `webview/sqlite-browser.css`: integrate controls with selection/busy/theme state.
- `test/unit/staged-edits.test.ts`, `test/unit/editing-ui.test.ts`,
  `test/unit/editing-provider.test.ts`, `test/unit/browser-dom.ts`,
  `test/unit/fixtures/staged-edit-database.ts`: test-first cases and disposable data.
- `src/test/row-operations.test.ts` (new): both-engine real-host behavior.
- `specs/SPEC.md`, `specs/PLAN.md`, this new document and `PROGRESS.md`: acceptance,
  design, evidence and handoff. T-031 remains unchecked until its gates pass.

Ignored `out/t031-*` helpers and transcripts retain test/QA evidence; disposable
profiles/builds are generated artifacts and are not extension payloads.

### Review and owner CI handoff

Run `npm run verify` for the standalone gate and `npm run verify:full` for the
complete local gate. Neither command changes the eight exact warning exceptions.
For independent review, follow `specs/VALIDATION.md` section 6 in a fresh chat:
read the Constitution, FR-021 and this acceptance block, then review the real
task diff (`out/t031-review.patch`, also available from the task commit). Report
concrete defects and missing acceptance tests without rewriting the implementation.
That review is pending; the implementation author's inspection is not independent.
Owner pushes the candidate and runs existing CI, then supplies its commit SHA,
run URL/attempt and Windows/macOS/Ubuntu results. No local run proves those remote
jobs. Keep T-031 unchecked until the required review and CI evidence passes.
