# Lite Voyager

A VS Code extension in development for browsing SQLite, CSV, JSON, and XLSX
files and querying them with SQL in an editor tab.

## Current status

Milestone 0 is complete. T-009 adds a production, worker-backed `Engine` interface
with native disk-backed SQLite and the memory-limited sql.js fallback, plus an
**Engine Check** command to exercise mode notices and large-file consent.
The project also provides **Hello World** and experimental
T-002 worker/fallback spike commands. The spike runs its worker in a killable
helper process and passes local open/query/cancel/reopen checks, owner manual QA,
and recorded three-platform CI.
Data browsing and querying in editor tabs
are planned and are not implemented yet.
See [PROGRESS.md](PROGRESS.md) and [specs/TASKS.md](specs/TASKS.md).
T-008 now provides an experimental CodeMirror editor and synthetic grid;
owner manual QA passes and confirms CodeMirror 6 (steps and evidence below).

## Development

Use Node.js 25.7 or newer for the development tools and SQLite fixture tests,
then run (Node 26.5.0 was tested):

```sh
npm ci
npm run verify
npm run verify:full
```

`verify` checks strict TypeScript for the host, webview, and tooling, runs lint
and unit tests, builds the host, webview, helper and worker bundles, and creates then removes a local VSIX as
a packaging check. Any failed command or warning fails verification.

`verify:full` adds the integration tests in an isolated VS Code instance and
checks its structured runtime logs for warnings and errors.
The test runner downloads VS Code when it is not already cached. Development
tool downloads are separate from the extension, which makes no network calls.

Press **F5** to build and open an Extension Development Host. Run **Hello World**
from its Command Palette. The expected message is **Hello World from Lite Voyager!**

Useful individual checks:

```sh
npm run check-types
npm run lint
npm test
npm run test:integration
npm run package
```

`npm run package` performs a local packaging check; it does not publish.
The supported minimum is VS Code 1.140.0, the lowest host tested by T-002.
This is separate from the development Node version and does not claim that
1.140.0 was the first historical VS Code version with node:sqlite.

## T-009 Engine and fallback check

Run **Lite Voyager: T-009 Engine Check** in an F5 Extension Development Host
and select `test/fixtures/sample.sqlite`. The panel reports the selected engine
and remains open until closed; closing it releases the database helper.
Select an invalid or zero-byte fixture to check the clear opening error.

To exercise the permanent force-fallback hook in F5, temporarily add
`"env": { "LITE_VOYAGER_FORCE_FALLBACK": "1" }` to the **Run Extension**
configuration in `.vscode/launch.json`, then start a fresh debug host. Remove
that entry to restore normal runtime detection. Other variable values do not
force fallback. This hook does not remove the supported VS Code minimum.

Fallback displays a persistent **Memory-limited mode** notice. A file strictly
above 200,000,000 bytes prompts before reading it into memory; **Proceed**
allows loading, while Cancel/dismissal leaves it unloaded. The notice explains
that memory use can exceed the file size and that upgrading VS Code or using a
supported host with `node:sqlite` enables disk-backed access. WAL-mode files and
WAL/journal sidecars are rejected explicitly in fallback. Files that change
while being approved/read must be retried after the writer closes them.

```sh
npm test -- test/unit/engine.test.ts test/unit/fallback-ui.test.ts
npm run verify
npm run verify:full
```

Tests exercise both real engines, runtime module absence, exact integers,
source safety, bounded pages, prompt decline/approval (including a disposable
file above 200 MB), changed snapshots, and cancellation/recovery. Integration
tests run the production Engine and command/panel in the VS Code host. Test
fixtures for these runtime conditions are temporary; no large data is committed.

The public async interface is in `src/engine/engine.ts`. `EngineClient` supervises
both worker backends so cancellation can kill the helper, await exit, and reopen.
Queries return one page (at most 1,000 rows and 4 MiB); an oversized page gives
an explicit error without truncation. Offset paging re-executes and skips earlier
rows with bounded memory, so deep-page latency and stable browsing results remain
work for subsequent tasks. No multi-GB extension-memory or visible-row performance
target is claimed by T-009. SQL editor/table browsing belongs to later tasks.
Read-only queries accept SELECT/WITH, optionally preceded by EXPLAIN or
EXPLAIN QUERY PLAN; EXPLAIN PRAGMA is rejected because some PRAGMAs take
effect during preparation (see [SQLite's PRAGMA documentation](https://www.sqlite.org/pragma.html)).

## T-051 spec tools

```sh
npm run ctx -- T-012
npm run trace
npm test -- test/unit/spec-tools.test.ts
```

`ctx` prints the exact task line, complete directly linked FR/NFR definitions
from `specs/SPEC.md`, and the Constitution. Repeated links appear once; ranges
such as `FR-001 to FR-003` include every ID. Missing IDs and invalid input fail
with a concise message. Tasks without FR/NFR links say so explicitly.
Unnumbered sections and plan decisions are not automatically included;
provide relevant sections, `AGENTS.md` and `PROGRESS.md` separately for a new chat.
For context without npm's command banner, use `npm run --silent ctx -- T-012`.

`trace` reports FR/NFR definitions without a matching test-name prefix in
`test/unit/**/*.test.ts` or `src/test/**/*.test.ts`. It parses source with the
already installed TypeScript package, adds no dependencies, and executes no
test code. Literal names on `test`/`it`, imported aliases and parameterized tests
count, as do template names with a fixed ID and delimiter before interpolation.
Comments, fixture strings, suite names, skipped/todo tests and skipped suites
do not count. Dynamically computed requirement prefixes are not counted; use
a literal requirement prefix. Compiled output and fixture directories are excluded.

Trace is a naming check: it does not prove that tests passed or that every
acceptance criterion is covered. Reports (including gaps) exit successfully;
invalid arguments or unreadable inputs exit with code 1. Run `npm run verify`
for the automatic task gate. Both commands locate the repository relative to
their script files and make no network calls or file changes.

## T-008 editor/grid spike — owner manual check

Owner QA on 2026-10-09 in VS Code 1.141.0: all checks below PASS. The owner
observed 512 cached rows and about 20–23 rendered rows, and chose to keep
CodeMirror 6. Detailed evidence and limitations are recorded in PLAN.md.

Run `npm run verify` and `npm run verify:full`, then press **F5** and run
**Lite Voyager: T-008 Editor and Grid Spike** in the development window's
Command Palette. No fixture generation or file selection is required.

1. Type SQL, select text, and try undo/redo. Syntax highlighting should be
   readable. SQL execution is outside this spike.
2. Scroll the grid rapidly with a wheel/trackpad and drag its scrollbar. While
   scrolling, edit SQL to assess whether the editor stays responsive.
3. Use **Middle**, **Last**, and the row input. The last row is **10000000**;
   row 1's exact integer is **9007199254740993**. Script-looking cell text must
   remain literal text. The footer reports the visible row range, rendered rows
   and cached rows; cached rows must never exceed **512**.
4. Focus the grid and try arrows, Page Up/Down and Home/End. Use horizontal
   scrolling on a narrow panel. Resize the editor area/window, then repeat.
5. Repeat in VS Code light and dark themes. Close and reopen the spike twice.

Paste the verify/full-verify conclusions and this report:

```text
T-008 manual QA
VS Code version / OS:
Editor typing, selection, undo/redo: PASS or issue
Wheel/trackpad and scrollbar smoothness: PASS or issue
First/middle/last/jump correctness: PASS or issue
Keyboard, horizontal scrolling and resize: PASS or issue
Light/dark themes and close/reopen: PASS or issue
Largest rendered/cached counts observed:
Editor decision: Keep CodeMirror 6 / Change (reason)
```

Synthetic rows test the UI mechanics; they do not measure real database query
latency, large-file memory, or production first paint. T-008 is complete: passing
verification, owner manual QA and task commit 8fed6f0; the owner reports pushing.
The strict integration-log warning and remaining foundation tasks/gate remain open.

## T-002 experiment status

On Windows x64, VS Code 1.140.0 and 1.141.0 expose `node:sqlite` through
their bundled Node 24.21.0 (SQLite 3.53.4). The real sql.js 1.14.2 fallback also opens and
queries the fixture when the built-in module is deliberately unavailable.
sql.js is [MIT licensed](https://github.com/sql-js/sql.js); its loader, WASM,
and license are copied into the package, without runtime downloads.

Database work runs in a worker inside a helper process launched with the
bundled executable; no system Node installation or external CLI is needed.
Cancellation kills that helper and awaits confirmed exit before reopening.
Worker termination alone waited 11,042 ms inside native SQLite; the revised
design stopped in 30 ms on 1.140.0 and 25 ms on 1.141.0 in measured runs.
Both engines meet the approved 1,000 ms spike target, reopen successfully,
and preserve source hashes. This does not claim full NFR-003 memory/performance
coverage or measure NFR-005's main-thread blocking target.

Run the automated checks:

```sh
npm test -- --run test/unit/sqlite-spike.test.ts
npm run test:integration
npm run verify
```

For another exact VS Code version in PowerShell, set the version override and
run the integration check, then remove the override:

```powershell
$env:LITE_VOYAGER_TEST_VSCODE_VERSION = '1.141.0'
npm run test:integration
Remove-Item Env:LITE_VOYAGER_TEST_VSCODE_VERSION
```

For the required manual QA:

1. Press F5, then run **Lite Voyager: T-002 SQLite Worker Spike** in the
   Extension Development Host and choose `test/fixtures/sample.sqlite`.
2. Wait for the long-query message. Type or move around in another editor, then
   click **Cancel** in the progress notification.
3. Repeat with **Lite Voyager: T-002 SQLite Fallback Spike**, accepting its
   memory-limited notice. This experiment refuses inputs over 8 MiB.
4. Paste both **T-002 manual result** lines from the **Lite Voyager T-002**
   Output channel and say whether typing stayed responsive. Expect `cancelled`
   and `recovered` to be true, `cancelMs` below 1000, and heartbeat ticks above zero.

Owner manual QA passes both engines, including responsive typing, cancellation
(native 24 ms, fallback 92 ms), and reopening. [CI run 37916047454](https://github.com/JreyForFun/lite-voyager/actions/runs/37916047454)
passes all three full-verification jobs for commit f3085869c88262b2ffdbfddb47805f6287cdcc3a.
Red-first regressions cover the review's WAL omission and statement-leak defects.
Fallback now rejects WAL-mode files, WAL/rollback-journal sidecars, and observed
changes during copying, with an actionable message. The native engine can read
committed WAL rows. The fallback never checkpoints or modifies source files;
its copy checks do not provide an atomic snapshot against arbitrary writers.
All sql.js statement paths free resources, and complete JSON pages fit 256 KiB.
Independent follow-up review found no remaining concrete defect. Local full
verification passes with 103 unit tests, six integration tests, and strict logs;
VS Code 1.141.0 also passes the integration/log gate. [CI run 37922970386](https://github.com/JreyForFun/lite-voyager/actions/runs/37922970386)
passes all three Full verification jobs and their applicable verification steps
for the review fixes at commit 0e3ec57de8254b80a2aa8bc830ea65c527e8301c.
T-002 is complete; T-052 subsequently closed the foundation gate.
T-009 now supplies the production Engine interface, fallback banner/large-file
prompt, and permanent force-fallback hook (see the Engine Check section above).

## Continuous integration

[CI](.github/workflows/ci.yml) runs on every push and pull request, with a manual
run option. Each Windows, macOS, and Linux job installs the lockfile with `npm ci`
using Node 26.5.0 and runs `npm run verify:full`. Linux runs
`dbus-run-session -- xvfb-run -a npm run verify:full` to provide a fresh session
bus and a virtual display for VS Code. All three jobs report results even if one
fails; errors and warnings fail the existing verification gate. CI does not
generate the large 10-million-row datasets.

[Run 37884550873](https://github.com/JreyForFun/lite-voyager/actions/runs/37884550873)
passed all three Full verification jobs on 2026-10-09 for commit
`93b23bf1420cf10dd8b0ea82d3b4c2be0e35268d`. GitHub's job metadata confirms that
the Linux session-bus/display step and the Windows/macOS verification steps
succeeded. T-007 is complete; the remaining Milestone 0B tasks are still open.

For subsequent changes, open the repository's **Actions** tab and select **CI**
for the tested commit. Paste the run URL, SHA, and all three job conclusions.
For a failure, paste the complete failing-step log. Local workflow tests check
configuration; actual platform runs establish runner compatibility.

## Test fixtures

Small SQLite, CSV/TSV, JSON/JSONL, and XLSX inputs are committed in
[test/fixtures](test/fixtures/README.md), including malformed and empty cases.
The inventory records exact bytes/hashes and runtime scenario instructions.

```sh
npm run fixtures -- small
npm run fixtures -- stress
npm run fixtures -- large --rows 10000000
```

The generator writes a new directory under the git-ignored
`test/fixtures/generated/`. It refuses existing destinations. The large profile
creates CSV and SQLite with matching rows; `--csv-bytes` requests a minimum CSV
size and `--payload-bytes` changes record width. See the fixture guide for all
options, format limits, and what to paste back from a local generation run.

## Credits and license

The query-a-file-with-SQL idea is inspired by
[nao1215/filesql](https://github.com/nao1215/filesql). Lite Voyager is an
independent TypeScript implementation and shares no code with it.

Licensed under the [MIT License](LICENSE).
