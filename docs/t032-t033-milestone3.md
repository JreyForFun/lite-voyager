# T-032 and T-033: query history and source refresh

Owner authorization: implement both tasks sequentially in this chat, use judgment
for details/fixtures/visual QA, then run the combined gates. Owner retains push
and remote CI. This overrides the usual one-task/chat approval pause only for
T-032/T-033. The owner reports T-031 CI failed on Ubuntu and macOS; retain that
failure as unresolved, without retrying or claiming a cause. No release/tag.

## T-032 / FR-013 acceptance

- Keep the last 50 successful explicit read-only SQL runs per original file URI,
  newest first, including repeats. Store the exact executed selection/statement,
  including whitespace and Unicode. Paging, count, export, completion, restored
  results, failed/cancelled execution and staged SQL writes add no entries.
- Persist locally in extension global storage across reopen/reload. SQLite and
  CSV/TSV/JSON/JSONL/XLSX use their original source URI; temporary import paths
  never become history identities. Split views share one serialized store.
- Keep at most 50 bounded metadata entries in memory; store SQL in separate owned
  files, read one full query only when requested, and never load all 50 queries.
  Reuse the existing 4-Mi-character SQL bound; never truncate stored statements.
  Publish the bounded metadata index atomically. Evict only owned history files.
- History UI is keyboard accessible and theme aware. Show labelled previews and
  lengths, explicitly explain local retention. Loading replaces editor text with
  the complete statement, supports editor undo, and never runs SQL automatically.
  Clear history affects only that source's history. Storage/corruption failures
  are visible and do not erase earlier history or successful query results.
- Typed transport validates counts, IDs, bounds and SQL. No dependency/network.
  Test persistence, 51-entry eviction, concurrent runs, independent files, long
  exact text, malformed storage/messages, explicit-run-only recording and UI load.

## T-033 / FR-040 acceptance

- Monitor open local sources, including outside the workspace, replacement,
  deletion/recreation and SQLite WAL changes. Use asynchronous metadata checks;
  never hash/read a whole source in the extension host. Coalesce notifications,
  detect missed events by periodic checks, and dispose all timers/watchers.
- Offer an accessible visible Refresh / Keep current view prompt. Detection and
  dismissal never write a source or discard edits. Keep suppresses the current
  observed change; a later change offers again. Deleted/unreadable sources show
  an actionable message; detection failures are not silently treated as unchanged.
- Refresh is explicit. SQLite refresh reopens every view and turns write mode
  off. If dirty, require a separate explicit discard confirmation through VS Code;
  dismissal preserves the entire queue/dirty state. Failed refresh preserves the
  queue and never authorizes replay against a new source version. Refresh cannot
  race an edit/save/export operation. Own successful saves update the baseline.
- Imported formats refresh through a new preview, retaining original URI/history
  and requiring explicit Import again. Stop/clean up the old read-only import
  safely; no automatic import or source writes. Save As protections remain.
- Existing save source-version checks remain mandatory: newer on-disk changes
  are never overwritten. The refresh prompt does not weaken them or automatically
  retry a save. No new diagnostic exceptions or resource/timing limits.
- Test same-path replacement, WAL-only change, delete/recreate, dismissal/reoffer,
  disposal, dirty-confirm/cancel, refresh failure/busy states, shared views and
  imports. Inspect both engines and light/dark UI on disposable sources.

## Validation and closure

Write failing acceptance tests before each implementation. Run focused checks
during work and `npm run verify` / `npm run verify:full` after both features.
Preserve every failed attempt; never retry unchanged to get green. Standalone
requires zero errors/warnings; full permits only the existing eight exact host
warning families with complete record reporting. Independent fresh-chat review,
the unresolved T-031 CI failures and owner-pushed candidate CI remain explicit
gates. No task/milestone checkbox closes without its evidence.

## Implementation and regression evidence

History uses SHA-256 original-URI directories under global storage, a serialized
atomic index and individual exact SQL files. Only metadata is listed; loading
reads one query. Previews have both character and serialized-byte bounds so JSON
escaping cannot make a valid 50-entry index unreadable. SQL is never shortened.
CodeMirror isolates history loads into their own undo group. A failed history
write leaves successful results visible and reports the storage failure.

Source monitoring watches the parent directory and checks async metadata every
two seconds, including the SQLite WAL. Keep suppresses the observed change;
replacement/deletion/recreation or another version offers again. Own Save uses
the worker's committed version, allowing later external changes to be detected.
Every SQLite reader must settle successfully before the queue is discarded.
Dirty refresh awaits the custom-provider result as well as the VS Code command:
the command can return before the provider has reopened the readers. Clean
documents reopen directly because VS Code skips clean-document Revert. Refresh
locks also reject queue-changing Undo/Redo. Imports return to preview and require
explicit Import again; standalone CSV preview rereads only on explicit refresh.

All failed attempts remain under `out/`; no tests or guards were weakened:

- Initial missing-module/API red tests: `t032-red-storage.log`,
  `t032-red-ui.log`, `t032-red-history-undo.log`, `t033-red-monitor.log`,
  `t033-red-ui.log`, `t033-red-host-busy.log`.
- `t032-t033-view-1.log` and `-2.log`: invalid test preview objects, a fake
  editor missing focus, and an explicit-query expectation missing `remember`.
  Fixtures were corrected to the actual protocol; production checks remained.
- `t033-red-clean-refresh.log` selected zero tests because of command quoting;
  only `t033-red-clean-refresh-2.log` establishes the clean-Revert regression.
- `t033-red-refresh-settlement.log` proves early reader failure released the
  lock too soon. `Promise.allSettled` now waits for every reader.
- `t032-t033-focused-4.log`: 136 passing tests /10 files before final QA fixes.
  Initial lint/type errors and their corrected runs are retained separately.
- Focused real-host `t032-t033-host-1.log` and `-2.log` each passed eight import
  cases and failed two SQLite cases. First exposed clean Revert; second exposed
  a test action sent before mode-change Browse refresh settled. The corrected
  helper waits for the existing painted/not-busy condition, without relaxing
  assertions, workload or deadlines. `t032-t033-host-3.log` passed all ten.
- Visual QA exposed the deferred Revert completion bug. Failing
  `t033-red-deferred-revert.log` precedes the repair; the provider suite then
  passed 16 cases in `t033-deferred-revert-green.log`.
- `t032-red-preview-bytes.log` reproduces a self-produced oversized history
  index. `t032-preview-bytes-green.log` passes 34 tests /3 files after the repair
  and corrected typed import fixtures.
- `t032-t033-red-action-types.log` and `-2.log` reproduce malformed array
  actions passing the guards. `t032-t033-action-types-green.log` passes six
  cases after requiring string actions.
- `t033-red-refresh-undo.log` reproduces queue-changing Undo during refresh;
  `t033-refresh-undo-green.log` passes all 17 provider cases after locking it.
- First combined `t032-t033-verify-1.log` failed tooling types on the new import
  fixture's preview union and missing ImportedTable columns. Both were repaired.
- `t032-t033-verify-2.log`: types/lint pass; 1,457 units pass and the two
  malformed-array regressions fail (135 files, 493.35 s). This attempt overlapped
  test-first guard review; it is not evidence for a frozen final source.
  Keep it failed. Guard changes and focused green evidence precede the frozen
  final-source gates below. No unchanged retry-to-green.

## Scoped visual QA and its limits

Used the computer-use skill with actual Windows UI input on disposable files.
The supported archived VS Code 1.140.0 window could not be targeted because the
desktop helper rejected its ownership binding twice. Installed VS Code 1.145.2
was used for scoped visual behavior only. No compatibility or clean-log result
is inferred from that fallback environment.

Native evidence is `out/t032-t033-visual-6-native-*.png` and matching status JSON;
fallback evidence is `out/t032-t033-visual-7-fallback-*.png` and matching JSON.
Inspected light history, visible source warning with one pending edit, real
native Cancel confirmation, dark Discard confirmation and refreshed dark split
views. Cancel retains the queue; approved Discard clears dirty/write mode;
both views read the external value; source digests are unchanged. Query history
survives refresh. Controls wrap in narrow split views and use theme colors.
Fallback helper finishes with `visual-finished.json` status `passed`; numbering
ends at ten across the native and fallback checkpoints.

Earlier visual attempts are retained: run 1 desktop ownership failure; run 2
split-view exercise correlation timeout; run 3 TestMode refused native dialogs;
run 4 helper profile-case guard failure followed by interruption/deadline;
run 5 genuine deferred-Revert bug; run 6 completed native assertions then failed
on an unavailable helper-only cleanup command. That command was removed and
run 7 covered the remaining fallback cases. No production deadline changed.

**These installed-host visual sessions fail the strict diagnostic scan.**
They contain unapproved product-proposal warnings and a main-process mutex
error, plus retained helper/forced-shutdown failures in earlier attempts. They
are behavior evidence only, never a substitute for `verify:full`. Every exact
unapproved/approved record from all ten focused/visual profiles is retained in
`out/t032-t033-profile-diagnostics.json` and `.log`, including original source,
line, severity and message. No new allowance was introduced.

The passing earlier focused host scan contains this approved warning (not a
warning-free run):

```json
{"source":"20261108T225317/window1/renderer.log","line":9,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}
```

## Final combined gates

Final-source `npm run verify` passes (exit 0): `out/t032-t033-verify-3.log`;
1,459 unit tests /135 files, unit duration 475.69 seconds.
Strict host/webview/tooling types, lint, units, production build and VSIX dry run
all pass with zero errors/warnings. All 332 executable/test/config hashes match
the frozen snapshot before and after this gate. `npm run verify:full` is running.
Independent fresh-chat review and owner-pushed Windows/macOS/Ubuntu CI remain
pending. The reported earlier T-031 Ubuntu/macOS failures remain unresolved.
Do not tick T-031, T-032, T-033 or a milestone checkbox from this record yet.

## 2026-11-20 repair: lost exercised Start and read-only wording

Owner-authorized (full implementation, fixture edits, visual QA; owner pushes/CI).

**Failure (recorded, not retried):** `verify:full` 90 pass / 1 fail.
`FR-013 FR-040: Given json fallback=false ...` timed out after 15000 ms in phase
`ready` with `browserStatus` undefined. Cause: the host reaches `ready` before
the (re)loaded import frame has received that state. An exercised Start that
arrives while the frame is still `loading` clicks a disabled control and is
ignored by design. On source refresh the host replaces the frame HTML and
immediately re-previews, so both Starts in the test could race. Product behavior
for real users is correct (a disabled button cannot be clicked); the test lacked
a frame-confirmed readiness signal. CSV passed only by timing.

**Fix:** `CsvImportSession.previewStatus` keeps the current frame's latest
preview DOM report (mirrors `browserStatus`). It is cleared when refresh replaces
the frame and when a frame announces `csvPreviewReady`. The host test waits for
painted preview rows in the current frame before each exercised Start. The
frame renders preview rows only after it received `ready`, so the Start click is
real. No deadline, workload or assertion was relaxed.

**Visual QA finding fixed:** read-only import/preview views said "Pending edits
are retained until you explicitly discard them", but imports cannot be edited
(Constitution 6, honest messages). `SourceChanges` takes `editable` (default
true, SQLite editor unchanged). Import and standalone preview pass `false` and
get wording without pending edits or save-conflict claims for change, missing,
unreadable, Keep and failed-refresh messages.

**Tests first:** `FR-040: Given a rendered preview frame ...` (csv-import-panel)
and `FR-040: Given a read-only imported or previewed source ...` (source-changes)
both failed before the fix; panel tests now also assert import/preview wording.
Focused: 83 tests / 6 files pass. Isolated host suite
`history-refresh.test.js`: 10/10 passing on four consecutive runs (40/40).

**Visual QA (archived VS Code 1.140.0, isolated profile, loopback CDP
screenshots):** helper `out/import-refresh-qa-run.mts` + `out/import-refresh-qa-test.ts`
(ignored). JSON native and CSV fallback: light preview, light query history,
light source-changed offer, dark refreshed preview with the external value and
Import required again, dark re-imported view with history retained (2 of 50).
Source digests unchanged throughout; 10/10 checkpoints passed. Final screenshots:
`out/import-refresh-qa-*.png`; pre-wording run kept in `out/import-refresh-qa-run1/`.
The isolated profile shows VS Code's "extensions temporarily disabled" toast.

**Gates:** `npm run verify` (final source) exit 0: 1,461 units / 135 files, zero
errors/warnings. An earlier `verify:full` on the race fix alone passed 91/91
with one approved VSCODE-HOST-001 (not warning-free). The first final-source
`verify:full` failed 90/1: T-021 NFR-003 5-GB CSV import ended `error` (not
`opened`) because the disk filled during the run: Windows expanded the
automatically managed `pagefile.sys` at 15:23 (failure 15:25), leaving 7.1 GB
free; the import's own space check correctly refused. Remediation: removed the
orphaned, unreferenced 6.7 GB disposable `out/t016-memory-fsrUKr` fixture
(2026-10-27, regenerated by every T-016 run). Code unchanged; post-remediation
`verify:full` (14,011 MB free at start, 13,966 MB at end) exit 0: 1,461 units /
135 files and 91/91 hosts (32 min). Its sole approved diagnostic, so it is not
warning-free:

```json
{"source":"20261120T153933/window1/renderer.log","line":10,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}
```

Run every gate from an uppercase `C:/` working directory: a lowercase `c:\` cwd
(Git Bash `cd /c/...`) makes Vitest load itself twice and fail every suite.
This machine runs near its disk limit; keep at least 14 GB free before `verify:full`.
Owner-pushed Windows/macOS/Ubuntu CI and an independent review remain pending.

### Windows CI abort: watcher on an 8.3 short directory name

First CI of branch `t032-t033-history-refresh` (commit 77b418e): Ubuntu and
macOS pass; Windows aborts during units before any result:
`Assertion failed: !_wcsnicmp(filename, dir, dirlen), file src\win\fs-event.c, line 72`,
exit code 3221226505 (0xC0000409). GitHub's Windows temp is the 8.3 alias
`C:\Users\RUNNER~1\...`. `SourceChanges` watched `dirname(path)` as given; libuv
expands changed file names to their long form, the prefix check against the
short watched directory fails, and libuv aborts the whole process. This is a
product defect too: a source opened through a short path could abort the
extension host. Local temp (`C:\Users\ADMIN\...`) has no short alias, so local
gates could not see it.

Test first: `FR-040: Given a source reached through a Windows 8.3 short directory
name ...` (source-changes) reproduces the identical assertion abort locally.
Fix: watch `realpath(dirname(path))` (native canonical long path); if it cannot
be resolved, notifications are reported unavailable and periodic checks remain;
a monitor disposed during resolution never creates a watcher. Related suites:
66 tests / 5 files pass. Gates were run with `TEMP`/`TMP` set to the 8.3 alias
`C:\Users\ADMIN\AppData\Local\Temp\LV-CI-~1` so every temp-using unit and host
test exercises the runner's short-path condition.

- `npm run verify` (short TEMP) exit 0: 1,462 units / 135 files, zero errors/warnings.
- `npm run verify:full` (short TEMP) exit 1. 1,462 units and 91/91 hosts pass (37 min),
  and the crash does not recur. The strict log scan fails on one unapproved VS Code
  renderer startup-timing warning (not product code), recorded and not retried:
  `20261120T192754/window1/renderer.log:2: 2026-11-20 19:27:58.966 [warning] Creation of workbench contribution 'chat.usagesTool' took 21ms.`
  Approved in the same run (not warning-free):
  `{"source":"20261120T192754/window1/renderer.log","line":11,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}`
- Proposal awaiting owner decision (not adopted): VSCODE-HOST-009, exactly
  `^Creation of workbench contribution 'chat\.usagesTool' took \d+ms\.$`, with the
  unchanged renderer.log source, `[warning]` severity and metadata-reporting guards
  of HOST-002..008. Every other warning/error still fails; no retry-to-green.

## Changed files

Task documentation: `PROGRESS.md`, `docs/t032-t033-milestone3.md`,
`specs/PLAN.md` (only the two T-032/T-033 additions), `specs/SPEC.md`.

Host: `src/extension.ts`, `src/protocol.ts`, `src/editor/query-history.ts`,
`src/editor/source-changes.ts`, `src/editor/source-change-ui.ts`,
`src/editor/sqlite-browser.ts`, `src/editor/sqlite-editor.ts`,
`src/editor/sqlite-editor-ui.ts`, `src/editor/csv-import.ts`,
`src/editor/csv-preview.ts`, `src/editor/csv-preview-ui.ts`.

Webview: `webview/history-view.ts`, `webview/source-view.ts`,
`webview/sql-editor.ts`, `webview/sqlite-browser.ts`,
`webview/sqlite-browser.css`, `webview/csv-import.ts`, `webview/csv-preview.ts`.

Tests: `src/test/history-refresh.test.ts`, `test/unit/query-history.test.ts`,
`test/unit/query-history-ui.test.ts`, `test/unit/source-changes.test.ts`,
`test/unit/source-change-ui.test.ts`, `test/unit/editing-provider.test.ts`,
`test/unit/browser-view.test.ts`, `test/unit/csv-import-panel.test.ts`,
`test/unit/csv-preview-panel.test.ts`, `test/unit/sql-editor.test.ts`,
`test/unit/sqlite-browser.test.ts`.

Ignored local QA helpers/artifacts: `out/t032-t033-focused.mts`,
`out/t032-t033-visual-test.ts`, `out/t032-t033-visual-launch.mts`,
`out/t032-t033-development-qa.ts`, `out/t032-t033-rebuild-development-qa.mts`,
`out/t032-t033-capture.mts`, `out/t032-t033-capture-5.mts`,
`out/t032-t033-capture-6.mts`, `out/t032-t033-capture-7.mts`,
`out/t032-t033-scan-profiles.mts`, `out/t032-t033-source-hashes.mts`, their
transcripts/metadata/screenshots and disposable profiles. They are not shipped.

Owner changes to `README.md`, T-015 parts of `specs/PLAN.md`,
`specs/TASKS.md`, `specs/VALIDATION.md` and unrelated untracked files were
preserved. No dependency, CI configuration or existing workload was changed.
