# T-022: temporary storage and Save as SQLite

The owner delegates implementation, fixtures, fixes and visual QA on 2026-10-15,
with work resumed on 2026-10-16. Only T-022 / FR-007 is in scope. The owner
retains push and actual-candidate CI. No dependency or lockfile change is needed.

## Behavior

Full CSV/TSV import checks available space on extension storage before creating
session files. The estimate is three source sizes plus 64 MiB, calculated with
BigInt. Below it, Cancel or explicit Import anyway is offered. The estimate does
not reserve disk space or impose a primary-engine size cap. Disk-check and actual
exhaustion errors are actionable; existing fallback limits remain unchanged.

New storage uses private `session-v1-PID-random` directories. Each import/database
helper gets a PID marker before receiving work. Closing cancels and awaits work,
database helpers and any save copy before deleting owned storage. Startup removes
only recognized directories whose host and helpers are demonstrably absent.
Live/unknown PIDs, PID reuse, links, unknown names and legacy directories are
retained conservatively. Cleanup errors notify the user and preserve ownership;
a subsequent import must successfully clean retained storage before starting.

Opened imported tabs offer Save as SQLite and Cancel save. The matching command
is `Lite Voyager: Save as SQLite`. Saving copies the entire committed database,
independent of SQL, filters and the current page, and leaves the tab open. It
preserves original binary SQLite bytes, including exact integers and BLOBs.

A worker copies through a 1-MiB buffer, reports bounded byte progress, syncs and
closes the output. The host publishes a complete temporary sibling with an
exclusive hard link for new files or atomic rename for explicitly approved
replacement. Destination space must cover the database plus 1 MiB. Source and
sidecar paths/aliases, links, directories, private storage and destinations with
SQLite sidecars are refused. Source/destination state is checked again before
publication. Cancellation works through copying; Saving is the commit boundary.
Closing prevents late dialog answers from publishing and awaits worker exit.
Publication/cleanup errors remain visible even after the tab closes.

The original source's canonical name and file identity are retained at import
time and survive save-dialog reconfiguration. Moved originals/hard links remain
protected. Saving the intact imported database works after deleting the CSV.
An external destination writer can still race the final filesystem operation;
there is no cross-platform Node atomic compare-and-replace API. New-file
publication is exclusive, and observed destination changes abort replacement.

## Acceptance and regression coverage

- `temp-storage.test.ts`: exact large estimates, sufficient/low/unavailable
  space, explicit override, pending-dialog cancellation, dead/live/helper/unknown
  ownership, PID permission uncertainty, linked paths and removal confinement.
- `storage-helper-registration.test.ts`: helper exit/spawn errors during marker
  registration settle without starting storage work or an unhandled error.
- `sqlite-save.test.ts`: complete publication, replacement consent, source and
  sidecar aliases, private/linked storage, low space, failures/retry, late dialogs,
  concurrent requests, close/copy cancellation and the Saving boundary. Includes
  deleted originals and renamed/replaced original inode/hard-link protection.
- `sqlite-save-faults.test.ts`: locked publication, post-publication cleanup
  failure, preserved prior output and externally created destinations.
- `sqlite-save-worker.test.ts`: real worker, both import engines, all 250 rows,
  >1-MiB cells, exact int64, multiline Unicode/quoted names, empty/NULL/missing
  fields, binary BLOB preservation, empty database, 64-MiB cancellation/recovery,
  unavailable worker and changed source. Saved files reopen on both backends.
- `sqlite-save-ui.test.ts`: import-only accessible controls and bounded typed
  scoped protocol. `csv-import-panel.test.ts`: context wiring, waiting for save
  settlement, exact post-close notification, live cleanup failure and retry.
- `browser-package.test.ts`: actual VSIX whitelist includes the built save
  worker. Dependency audit includes its bundle and confirms no new notices.
- `src/test/sqlite-save.test.ts`: real VS Code controls on both engines, full
  database after a one-row SQL result, error/cancel DOM states, late answers,
  moved/deleted sources, helper exit, cleanup and reopening after storage removal.
  A third real-host case exercises startup dead/live/unknown directory handling.

## Preserved failures and verification

The initial restricted test launch fails before loading Vitest (`spawn EPERM`).
Authorized subprocess access reaches the expected two missing-module failures.
The first implemented service run passes 15 tests and fails the Saving/cancel
boundary; the commit flag is moved before announcing Saving. Three UI/context
tests fail before the controls/protocol are connected.

Additional failing-first evidence: low-space-dialog close times out; helper exit
during registration times out twice and the spawn-error handler count is zero.
Both lifecycle repairs pass their focused tests. A strict type run catches stale
AbortSignal narrowing; a closure reads its current state instead. The first
standalone gate fails two unnecessary test type assertions; both are removed.

An earlier candidate's standalone gate passes 702 units / 71 files in 295.76 s,
strict types/lint/build and 28-file / 675.26-KB packaging, zero errors/warnings.
This is earlier-candidate evidence only: it predates review/package repairs.
The package listing exposes an omitted save worker; a new actual-whitelist
regression fails first, then the whitelist and audit are repaired.

Independent fallback review (fresh agent, no inherited conversation) finds HIGH
renamed-original overwrite, MEDIUM missing-original save refusal and MEDIUM
unhandled live cleanup failure. Three regressions fail first: original moved data
is overwritten, absent original refuses Save, and cleanup rejects with `locked`.
Repairs retain import-time identity and make cleanup settle visibly with retry
ownership. Independent read-only follow-up clears all three and the packaging
repair, finding no remaining concrete T-022 defect. No expensive gates are run by
the reviewer; the specialized Bugbot API is unavailable.

Before host execution, a full run is deliberately interrupted during unit tests
to wire the existing 5-GB acceptance fixture's explicit low-space decision. Its
unchanged 13-GB working-space guard can pass while T-022's conservative estimate
requests approval. A new regression first fails with the missing decision-provider
method, then verifies the exact preflight still runs. The headless fixture supplies
explicit approval only below the estimate; the normal modal remains the default.
No workload, actual-space guard, memory target, deadline or diagnostic is relaxed.
The independent host run exercises this path with 12,056,330,240 available bytes
against 15,067,119,640 estimated bytes; the original pre-generation working-space
assertion remains unchanged.

The subsequent full gate fails at units: 706 pass / one fails, 70 passing files /
one failing file (437.89 s). Exact failure is the unchanged foundation
`test/unit/sqlite-spike.test.ts:169`, native `NFR-002: Given zero-byte.sqlite,
When opened, Then it fails clearly without falling back on database errors`,
exceeding its existing 5,000-ms test deadline. No build/package/integration/log
pass is claimed for that invocation. All T-022 unit cases pass, but that does
not clear the universal gate. Full output is retained in `out/t022-full.log`.

A separate instrumented diagnostic of the same source and real helpers observes
invalid-open rejection 271.382 ms, recovery open 223.693 ms, query 2.794 ms and
close 20.138 ms (524.516 ms total). The zero-byte fixture is still zero bytes;
both helpers exit. This does not reproduce or explain the 5-second failure and
is not a replacement gate. Phase/event evidence is in
`out/t022-spike-diagnostic.json`; no test/deadline/source change or automatic
unchanged retry is made. Real-host acceptance is run independently while the
failed unit gate remains open.
After this report, the owner explicitly authorizes one unchanged full rerun after
host QA: "Authorize one rerun; retain the failure." The first failed gate and
unknown cause remain recorded; no other retry, exception or guard change follows.

Independent `npm run test:integration` passes all 60 cases in 15 minutes, including
both-engine T-022 lifecycle/save assertions and unchanged populated 1/5-GB memory
acceptance. CSV combined peaks are 408,854,528 / 396,554,240 bytes; actual paging
growth is 29,298,688 / 30,691,328 bytes, with exact source hashes retained.
Its only approved diagnostic is `VSCODE-HOST-001`, severity `warning`, source
`20261016T024746/window1/renderer.log:10`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This host run is not warning-free. The owner-authorized unchanged full rerun
starts only after this independent host acceptance finishes.

The earlier targeted real-host run passes three cases in VS Code 1.140.0. Its
only approved diagnostic is `VSCODE-HOST-001`, severity `warning`, source
`20261016T021502/window1/renderer.log:10`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
That run is not warning-free. Final repaired gates are recorded in VALIDATION.md.

The single owner-authorized unchanged `npm run verify:full` rerun passes: strict
host/webview/tooling types, lint, all 707 units / 71 files (278.63 s), production
build, 29-file / 676.66-KB VSIX with the save worker, integration compilation and
all 60 real-host tests (14 minutes) in VS Code 1.140.0. Its only approved record:
`VSCODE-HOST-001`, severity `warning`, source
`20261016T031110/window1/renderer.log:10`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This full run is not warning-free. It consumes the one explicitly authorized
rerun; the earlier timeout remains unexplained and retained above.

In that passing full run, populated CSV sizes are 1,000,013,832 / 5,000,003,592
bytes with 244,144 / 1,220,704 rows. Combined host/helper peaks are
365,527,040 / 364,597,248 bytes, actual paging growth 25,387,008 / 33,861,632 bytes,
first-DOM times 482.377 / 505.156 ms and maximum host timer gaps
60.132 / 48.650 ms. All 60 Browse / 20 SQL pages per size and original source
hashes pass. SQLite combined peaks are 276,332,544 / 284,983,296 bytes with
8,011,776 / 14,503,936-byte actual paging growth and unchanged source hashes.
Renderer memory is observed separately, not included in the extension/helper
cap; these are sampled warm generated workloads, not universal physical-paint
or unsampled-peak claims. No workload or guard changes between the failed gate,
independent host QA and owner-authorized full rerun.

## Delegated visual QA

Windows Computer Use's native pipe is unavailable after the documented retry and
kernel-reset recovery. A separate disposable VS Code 1.140.0/Electron host is
inspected through its local Chromium debugging connection. No owner profile or
settings are modified. Native OS picker appearance, physical display latency and
other-platform behavior are not established. Canonical tests control destination
selection and replacement consent; file writing/publication remains production.

Observed checks pass within this scope:

1. Primary import: light-theme Save/Cancel controls, explanatory copy and readable
   12,288-byte Save success. The tab stays open and exact source text is retained.
2. The public command targets the active imported tab and visibly refuses an
   original-source destination. Dark 780 x 960 layout wraps controls/help and
   preserves the actionable error without horizontal overflow.
3. Fallback imports 250 rows, shows its memory-limited banner, and saves a complete
   28,672-byte SQLite file. Save receives keyboard focus; Enter through the active
   workbench activates it and produces readable success in the narrow dark view.
   Initial Enter sent to the iframe target does not activate the button; routing
   through the foreground workbench corrects the QA input. Screenshot 04 proves
   focus only; screenshot 05 proves success. This is an instrumentation correction.

Screenshots are local ignored artifacts under `out/t022-qa/`: `01-light-save.png`,
`02-light-saved.png`, `03-dark-narrow-error.png`, `04-fallback-keyboard-saved.png`
(focus only), and `05-fallback-saved.png`. Final review repairs change backend
ownership/path checks; the inspected webview assets are unchanged. Final real-host
tests validate those backend changes.

Both generated sources retain their expected hashes: `exact.csv` (96 bytes),
`71db5e47f6f0e8431450d675bb679416f22bc095379e1e034e18f74078f8ade5`;
`pages.csv` (6,148 bytes),
`dd7bda310873eaabf56b895bcd8579247f87d10a2bac6d027b533f8269147293`.

The visual bridge case passes and its host exits 0, but the strict runner rejects
the launch's exact console warning:
`Warning: 'remote-debugging-port' is not in the list of known options, but still passed to Electron/Chromium.`
This is a failed instrumentation gate, not a passing verification run or an added
exception. Its runtime log scan accepts no warnings. Canonical full verification
uses the normal launch without that debugging flag.

## Commands and remaining handoff

Final `npm run verify` passes after the full rerun/evidence update: all 707 units /
71 files (287.38 s), strict host/webview/tooling types, lint, production build and
29-file / 676.66-KB packaging. Zero errors and zero warnings. The final evidence
status updates change documentation only; no code/test/guard changes follow.

Reproduction commands are `npm run verify` and `npm run verify:full`.
Local acceptance covers all scoped T-022 behavior, both-engine real-host tests,
independent review and delegated visual observations described above. Native OS
picker appearance and other-platform behavior remain unobserved locally. The
owner pushes the scoped local commit and supplies fresh Windows/macOS/Ubuntu CI
URL and tested SHA. Keep T-022 unchecked until that candidate evidence passes.
No T-023, milestone closure or release/tag is included here.

## Complete task file list

Modified:

- `.vscodeignore`, `esbuild.js`, `package.json`
- `src/editor/csv-import.ts`, `src/editor/sqlite-editor-ui.ts`
- `src/engine/engine-client.ts`, `src/extension.ts`
- `src/test/csv-import-memory.test.ts` (explicit low-space decision provider)
- `src/loaders/csv-import-client.ts`, `src/loaders/file-loader.ts`, `src/protocol.ts`
- `webview/sqlite-browser.ts`
- `test/unit/browser-package.test.ts`, `test/unit/csv-import-panel.test.ts`,
  `test/unit/dependency-audit.test.ts`
- `specs/SPEC.md`, `specs/PLAN.md`, `specs/VALIDATION.md`, `specs/TASKS.md`, `PROGRESS.md`

Created:

- `src/editor/sqlite-save.ts`
- `src/storage/temp-storage.ts`, `src/storage/copy-database.ts`
- `src/worker/sqlite-save-worker.ts`, `webview/sqlite-save.ts`
- `src/test/sqlite-save.test.ts`
- `test/unit/temp-storage.test.ts`, `test/unit/storage-helper-registration.test.ts`
- `test/unit/sqlite-save.test.ts`, `test/unit/sqlite-save-faults.test.ts`,
  `test/unit/sqlite-save-ui.test.ts`, `test/unit/sqlite-save-worker.test.ts`
- `docs/t022-storage.md`

Ignored QA tools created under `out/`: `t022-host.mts`, `t022-host.config.mjs`,
`t022-qa-start.mts`, `t022-qa.config.mjs`, `t022-qa.test.cjs`, `t022-cdp.mts` and
the `t022-qa/` fixtures, bridge messages, protocol requests, screenshots and profile
reference; `t022-stage.mts`/`.patch`, `t022-repair-index.mts` and its
`t022-index-*` staging artifacts, `t022-spike-diagnostic.cjs`/`.json`,
`t022-spike-probe.cjs`, and `t022-full.log`. Build outputs and fresh isolated host
profiles are generated artifacts.
Unrelated owner README/T-015 edits and untracked fixtures are preserved.
