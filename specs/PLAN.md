# Lite Voyager: Plan (the "how")

Status: Draft v0.2 | Implements `SPEC.md` under `CONSTITUTION.md`.

## 1. Stack

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript, strict mode | |
| Database engine | Primary: Node's built-in `node:sqlite`. Fallback: `sql.js` (WASM) | Primary is disk-backed, so no size limit, and ships no native binary. It needs Node 22+ in the extension host. The fallback keeps the extension working elsewhere, with a memory limit and a visible warning. |
| Engine isolation | `worker_threads` inside a killable helper process | Database work runs in a worker; cancellation kills its enclosing helper and awaits confirmed process exit. The bundled Node/Electron executable is reused; no external CLI or shipped binary. |
| CSV | `papaparse` in streaming mode | Chunked reads, batched inserts in transactions |
| JSON / JSONL | Line reader for JSONL; a streaming JSON parser for big arrays | |
| XLSX | SheetJS or an alternative | Memory-bound by format. Note: the old `xlsx` package on npm is outdated; check SheetJS's current install guidance and security advisories in T-050. |
| SQL editor | CodeMirror 6 (start) | Confirm in T-008 |
| Grid | Virtualized, windowed rendering | Must stay smooth with very tall tables |
| Build | `esbuild`, two bundles (host and webview) | |
| Tests | Vitest for logic; `@vscode/test-electron` for integration | |
| Development packaging | `@vscode/vsce` (MIT), approved for T-006 | Creates a temporary local VSIX during verification; no publishing |

T-006 development tooling uses Node 24 or newer to run TypeScript verification scripts.
This does not establish the extension host's minimum Node or VS Code version;
T-002 measures that separately. Strict typechecking covers host, webview, and tooling.
T-005 raises the development/test minimum to Node 25.7, where node:sqlite no
longer emits an experimental warning. Node 26.5.0 is the observed local runtime.
`verify` runs typechecks, lint, unit tests, both production bundles, and a temporary
VSIX packaging check. `verify:full` adds integration tests in an isolated VS Code.
Every failing command or emitted warning fails the verification pipeline.
Integration tests use a separate profile with VS Code's built-in AI features
disabled (`chat.disableAIFeatures`), exercise the scaffold's declared minimum
VS Code version, and leave runtime diagnostics visible to the verification gate.
Each integration run uses a fresh project-local profile. The full gate checks
both command output and the profile's structured logs, so a host error without
a console severity prefix cannot be mistaken for a clean run.
The test host uses empty profile-local installed and built-in extension directories
(`--extensions-dir`, `--builtin-extensions-dir`), loading Lite Voyager through its
development path. This isolates unrelated Git/Copilot components without modifying
VS Code or filtering diagnostics. These tests do not cover coexistence with built-ins.

### T-005 fixture tooling

- `test/fixtures/manifest.json` inventories committed synthetic assets with sizes,
  hashes, and all applicable VALIDATION section 5 cases. `.gitattributes` preserves
  their exact bytes. `test/fixtures/README.md` documents runtime-only setups.
- `npm run fixtures -- small|stress|large` creates a fresh directory, defaulting
  to the git-ignored `test/fixtures/generated/`. Existing destinations are refused.
- Large CSV writes use a fixed 64 KiB batch and backpressure. SQLite creation runs
  in a worker with 1,000-row transactions. IDs are BigInt; values are parameterized
  and generated identifiers are quoted. No new project dependency is required.
- Defaults: 10 million rows, 96-byte ASCII payload. Optional `--csv-bytes` is a
  minimum, rounded up to a complete record; SQLite has the same resulting rows.
- Stress data covers 1,048,577-byte text cells and 1,000 columns. XLSX's real row/
  cell limits are documented instead of constructing invalid oversize worksheets.
- The curated XLSX has three sheets, exact unsafe integers as text, and a cached
  formula value. Regeneration copies this committed asset; external authoring/
  independent QA tools are not required by project commands or the extension.
- These are fixture/generator tests. They do not claim the future loaders, UI,
  cancellation, file recovery, or T-004 import targets have passed.

Observed T-005 local generation (2026-10-09, Windows, Node 26.5.0):
`npm run fixtures -- large --rows 10000000 --output test/fixtures/generated/t005-10m-validation`
completed in 163,629 ms with 10,000,000 rows, a 1,258,888,906-byte CSV, and a
1,246,060,544-byte SQLite database. This is generation time; peak memory and
extension/import performance were not measured. Large outputs remain git-ignored.
An independent Python csv reader checked every record, exact ID, name and payload;
Python sqlite3 opened the database read-only and confirmed matching counts,
ID bounds 9007199254740993 through 9007199264740992, and aggregate payload length.

## 2. Decision log

**D-3 Engine: two implementations behind one interface, chosen at runtime.** Decided by judgement rather than waiting for a spike, because the downside of being wrong is small and the upside is an extension that never simply crashes.
- **Primary: `node:sqlite` in a worker thread inside a helper process.** Reads from disk and ships no native binary. The helper reuses `process.execPath`; Electron hosts use the documented `ELECTRON_RUN_AS_NODE=1` mode. Native execution does not reliably stop on worker termination alone, so cancel kills the helper with SIGKILL and confirms its exit before reopening. This keeps database work off the extension host and stops all the helper's threads.
- **Fallback: `sql.js`.** Used automatically when `node:sqlite` is missing in a supported Node extension host. The spike uses the same helper/worker lifecycle for both engines. It loads the file into memory, so production T-009 adds a "memory-limited mode" banner and a large-file prompt. The spike announces its 8 MiB input cap and rejects larger files before loading. This is the only place the "any size" promise is relaxed (Constitution 2 and 6). VS Code for Web is not established by this Node-host spike or the current manifest.
- **How it works:** both production engines will implement one `Engine` interface in T-009 (open, schema, page, query, cancel, close). The database worker tries to load `node:sqlite` and chooses sql.js only when the built-in module is absent; corrupt files or query failures do not change engines. Everything above the future interface stays engine-agnostic.
- **Why not a native module (`better-sqlite3`):** it must match VS Code's Electron ABI and be built per platform, which is the maintenance burden we set out to avoid. It stays as a last resort if both engines prove inadequate.
- **Role of spike T-002:** no longer a go/no-go gate. It measures reality (which VS Code versions have `node:sqlite`, whether workers behave) so we can set the documented minimum version and verify the fallback triggers correctly.
- **Cost:** two engine implementations to test, and the CSV import pipeline needs a fallback path (the sql.js route imports into memory, so it is capped).

### T-002 measurements and revised cancellation design (2026-10-09)

- Spike tests cover real worker queries, exact 64-bit integers, NULL/empty
  string distinctions, BLOB placeholders, source-byte safety, malformed inputs,
  trusted_schema=OFF, disabled extension loading, and bounded result messages.
- Installed the plan-named sql.js fallback at registry-verified version 1.14.2
  (MIT). Build copies its loader, WASM, and license into dist; initialization reads
  the local WASM bytes inside the worker. No extension network access is added.
- The spike-only missing-module injection requests an unavailable built-in via
  Node's real resolver and follows the same ERR_UNKNOWN_BUILTIN_MODULE branch
  as an absent node:sqlite. File/query errors do not trigger fallback selection.
- Fallback input is explicitly limited to 8 MiB for this experiment. Result pages
  have at most 100 rows and a 256 KiB payload budget; hasMore announces extra rows,
  and oversized pages fail explicitly. These are not production paging semantics.
- Actual Windows x64 extension-host measurement: VS Code 1.140.0, Node 24.21.0,
  native SQLite 3.53.4. Both engines open/query; sql.js uses SQLite 3.49.1.
- Cancelling after 150 ms of a 20-million-step recursive aggregate: native
  worker.terminate awaited 11,042 ms; sql.js awaited 16 ms and then reopened,
  queried again, and retained the fixture hash. Node 26.5.0 unit testing also
  measured slow native termination (9,308 ms). Early queued-request cancellation
  passed but did not prove cancellation while inside native SQLite execution.
- Owner authorized the cancellation redesign and best-judgment implementation.
  FR-015 now defines a 1,000 ms deterministic-spike cancellation bound, confirmed
  helper exit, and successful reopening; this is distinct from NFR-005's
  main-thread blocking target. The original worker-only failure is retained above
  as evidence for the architectural change, rather than suppressed or ignored.
- Helper-based real-host tests pass: VS Code 1.140.0 native 30 ms / sql.js 47 ms;
  VS Code 1.141.0 native 25 ms / sql.js 27 ms. Both report Node 24.21.0 and native
  SQLite 3.53.4. Tests confirm helper death, fresh reopening, exact integers, and
  unchanged source hashes. The stdout/stderr diagnostics remain inherited.
- The helper has no descendant processes: its database worker is a thread.
  Parent IPC disconnection kills the helper; worker faults are reported clearly.
  Concurrent cancel/close and cancellation during opening have regression tests.
- Helper tests made the existing compiler-test timing failure repeatable.
  Serial file scheduling alone did not fix it and was not retained. The two
  compiler fixtures now share one setup program: the same compiler options,
  full default libraries, imported protocol, and positive/negative assertions
  remain. Both assertions include all shared diagnostics, excluding only the
  other fixture's diagnostics. No assertion timeout or compiler check is disabled.
- Owner-approved scope clarification: the production Engine abstraction and its
  permanent force-fallback hook stay in T-009; T-002 measures the experiment.
- Documented supported minimum: VS Code 1.140.0, matching the manifest and the
  lowest host tested. This does not claim that it is the first historical version
  containing node:sqlite or establish earlier-host/browser support. npm's Node
  25.7 development minimum is separate from the bundled extension runtime.
- Local npm run verify and verify:full pass with 93 unit tests, four real-host
  integration tests, strict diagnostics, all bundles, and a 13-file 346.38 KB VSIX.
  One full run correctly failed two VS Code startup timing warnings; an unchanged
  standalone integration run and subsequent full run passed the strict log gate.
  No warning was filtered or suppressed. Windows results do not establish the
  other platforms. T-002 stays unchecked pending fresh three-platform CI.
- Owner-supplied native manual result in VS Code 1.141.0: node:sqlite on worker
  thread 1, Node 24.21.0, SQLite 3.53.4; cancelled=true, cancelMs=24,
  heartbeatTicks=226, recovered=true. This passes native manual cancellation
  and reopening. Owner-supplied sql.js manual result in the same VS Code/Node
  versions: SQLite 3.49.1, worker thread 1, memoryLimited=true,
  cancelled=true, cancelMs=92, heartbeatTicks=55, recovered=true. This passes
  fallback manual cancellation/reopening with its memory notice. The owner
  confirms typing stayed responsive during both long queries, completing manual
  QA. Requested computer-use automation could not connect to its native pipe;
  no UI input was sent.

**D-6 CSV, JSON, and XLSX become on-disk SQLite tables.** One engine and one SQL dialect for everything, which also makes cross-file joins simple. Cost: a first import of a huge file takes time. Mitigated by instant preview, background import, progress, and cancel.

**D-7 Read-only by default.** SQLite files open read-only. Write mode is an explicit switch (FR-016).

**D-8 Edits are staged in the extension, applied on save.** The grid shows staged changes. Save runs them in one transaction.

## 3. Architecture

```
Extension host (Node.js)                  Webview (sandboxed browser)
------------------------                  ---------------------------
CustomEditorProvider                      Table list, schema panel
Import pipeline (streams to temp DB)      SQL editor (CodeMirror)
Staged-edit manager, save logic           Virtualized results grid
        |                                          ^
      | child-process IPC                        | postMessage
        v                                          |
Killable helper process  <--- host relays typed messages --->
      | MessagePort
DB worker thread (node:sqlite or sql.js, queries, paging)
```

- The webview never touches files or the database. It sends typed requests and renders typed responses.
- Query results are paged in the worker; the webview only ever holds the rows it is showing.
- Cancel kills the helper process, awaits its exit, starts a fresh helper/worker,
  then reopens the database. Worker termination alone is not sufficient for
  synchronous native SQLite execution. T-002 validates a 1,000 ms spike target.

## 4. Message protocol (draft)

Webview to host: `ready`, `listTables`, `getRows {table, offset, limit, sort?, filter?}`, `getSchema {table}`, `countRows {table}`, `runQuery {sql}`, `cancel`, `stageEdit {table, key, column, value}`, `save`, `revert`, `exportResults {format}`, `setWriteMode {on}`.

Host to webview: `tables`, `rows {columns, rows, hasMore}`, `schema`, `rowCount`, `queryResult {columns, rows, ms, hasMore}`, `importProgress {done, total?}`, `dirtyState`, `error {message, context}`.

Define these once in `src/protocol.ts` and import in both host and webview, so protocol drift fails at compile time.

## 5. Import pipeline (CSV, JSONL, JSON)

1. Read the first N rows directly for the instant preview and type inference sample.
2. Create a temp SQLite file in the extension storage folder (check free disk space first, FR-007).
3. Stream the file in chunks. Insert in batches of several thousand rows inside transactions.
4. Report progress by bytes read over file size. Support cancel at any time.
5. Create the table with inferred types; on a type conflict, widen to text instead of failing.
6. On close, delete the temp file. On startup, delete orphans.

## 6. Loader interface

```ts
interface FileLoader {
  extensions: string[];
  preview(path: string, opts?: LoadOptions): Promise<PreviewResult>;
  import(path: string, db: DbHandle, opts: LoadOptions,
         onProgress: (p: Progress) => void, signal: AbortSignal): Promise<ImportedTable[]>;
}
```

SQLite files skip the loader and open directly. New formats such as Parquet implement the same interface later.

## 7. Open behavior (D-5)

- `customEditors` entry for SQLite extensions with `priority: "default"`.
- Entries for csv, tsv, json, jsonl, xlsx with `priority: "option"`.
- Explorer context-menu command "Open in Lite Voyager".
- Editor-title button when a CSV or JSON text file is active.
- Setting `liteVoyager.openCsvByDefault`, default `false`.

### Commands and settings (initial list)

Commands: `Lite Voyager: Open in Lite Voyager`, `Lite Voyager: Toggle Write Mode`, `Lite Voyager: Save as SQLite`, `Lite Voyager: Show Logs`.
Settings: `liteVoyager.openCsvByDefault` (false), `liteVoyager.pageSize` (100), `liteVoyager.maxDisplayRows` (10000), `liteVoyager.fallbackWarnMB` (200).

## 7.5 Release and distribution

- Publish to the VS Code Marketplace and to Open VSX (for VSCodium, Cursor, and similar editors).
- Use pre-release versions for the 0.x line; follow semantic versioning; keep a `CHANGELOG.md`.
- GitHub Actions on every push and pull request: `npm ci` and `npm run verify:full` on Windows, macOS, and Linux; Linux runs `dbus-run-session -- xvfb-run -a npm run verify:full`. A manual run is also available. T-007 uses the observed development runtime Node 26.5.0, `actions/checkout@v6.0.3`, and `actions/setup-node@v6.5.0`; action inputs were checked against their official tagged metadata. The matrix does not cancel other platform jobs after a failure. The workflow has read-only repository permission and does not retain checkout credentials. No new project dependency is needed. Both-engine coverage is added as the engines are implemented in T-002/T-009; the current scaffold tests do not prove it.
- T-007 evidence: six red-first workflow contract tests guard triggers, matrix coverage, locked installation/runtime, Linux xvfb, the isolated session bus, and the full gate without failure bypasses. An independent local YAML parse checks syntax and structure. Actual CI is now verified: [run 37884550873](https://github.com/JreyForFun/lite-voyager/actions/runs/37884550873), attempt 1, commit `93b23bf1420cf10dd8b0ea82d3b4c2be0e35268d`, completed successfully on 2026-10-09. GitHub API metadata confirms successful Full verification jobs on ubuntu-latest, windows-latest, and macos-latest and success of each applicable verification step. Local full verification also passed with 66 unit tests and two integration tests. T-007 is complete; this does not establish later engine/feature coverage.
- Initial supplied Ubuntu evidence (2026-10-09): 65 unit tests, two integration tests, strict checks, lint, bundles and packaging passed, but Electron D-Bus connection errors correctly failed the full gate. The environment fix starts a fresh bus instead of relying on an inherited address, following the [D-Bus test-session documentation](https://dbus.freedesktop.org/doc/dbus-run-session.1.html). No diagnostics are filtered or suppressed. The subsequent successful run above validates the Linux wrapper in CI.
- The Marketplace README leads with a short screen recording of "open a huge CSV and query it".

## 8. Repo layout

```
litevoyager/
├── specs/
│   ├── CONSTITUTION.md  SPEC.md  PLAN.md  TASKS.md
├── src/
│   ├── extension.ts
│   ├── editor/          custom editor provider
│   ├── engine/          Engine interface, node:sqlite and sql.js implementations
│   ├── worker/          db worker host
│   ├── loaders/         csv, json, xlsx
│   ├── staging/         staged-edit manager
│   └── protocol.ts
├── webview/             UI source
├── test/
│   ├── fixtures/        small files, plus a script to generate big ones
│   └── bench/           benchmark scripts
├── LICENSE              MIT
├── package.json
└── tsconfig.json
```

## 9. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Importing huge CSVs into SQLite is slower than DuckDB reading in place | Instant preview, background import, progress; benchmark honestly; keep a DuckDB read path as a future option |
| R-2 | `node:sqlite` availability or maturity varies by VS Code version and by remote host | Runtime feature detection with the sql.js fallback (D-3); spike T-002 sets the documented minimum version; both engines tested in CI |
| R-3 | Counting rows or sorting on multi-GB tables is slow | Lazy and estimated counts; sorting only on indexed columns by default, with a warning otherwise |
| R-4 | XLSX and big single-array JSON can exhaust memory | Honest warnings (Constitution 6); streaming JSON parser; XLSX limit documented |
| R-5 | Editing a CSV and writing back can change formatting or types | Warning shown; atomic write; keep a backup option |
| R-6 | Database being written by another process (for example a running app, WAL mode) | Read-only by default; external change detection (FR-040); never change journal mode |
| R-7 | Competitors are ahead on installs and polish | Focus on G1 to G5 and publish real benchmark results |

## Changelog
- v0.4 T-002 cancellation redesign (2026-10-09): Owner authorized process isolation and a one-second deterministic cancellation target. Recorded passing worker/fallback recovery tests in VS Code 1.140.0 and 1.141.0; supported minimum is the lowest tested host, 1.140.0. Manual QA and new CI are still required.
- v0.4 T-002 investigation (2026-10-09): Recorded real worker/fallback measurements and failing native cancellation evidence. No cancellation redesign or final compatibility minimum selected; production Engine scope stays in T-009 as approved.
- v0.4 T-007 completion (2026-10-09): Recorded verified run/SHA and successful full verification on all three platforms, including the Linux D-Bus fix. Foundation spikes and engine behavior remain unimplemented/unvalidated.
- v0.4 T-007 Ubuntu environment (2026-10-09): Recorded the supplied D-Bus failure, added an isolated session-bus wrapper and red-first regression coverage, and retained strict diagnostics and remote-evidence requirements.
- v0.4 T-007 CI (2026-10-09): Recorded approved full verification on all three platforms, Linux xvfb, tested development runtime, action versions, and the distinction between local workflow checks and remote execution evidence.
- v0.4 T-005 fixtures (2026-10-09): Recorded fixture inventory, safe generators, stress profiles, format limits, and Node 25.7 development minimum. Extension compatibility remains a T-002 measurement.
- v0.4 T-006 validation (2026-10-09): Isolated installed and built-in extensions in fresh test profiles; full verification passes without filtering runtime diagnostics. Built-in coexistence is outside this isolated test's coverage.
- v0.4 tooling clarification: Recorded approved MIT packaging dependency and T-006 verification tooling; development Node minimum is separate from T-002 compatibility measurements.
- v0.4: Added commands/settings list and release plan.
- v0.3: Renamed to Lite Voyager. D-3 now defines a primary engine plus fallback behind one interface.
- v0.2: Engine changed from sql.js to `node:sqlite` in a worker (any-size requirement). Added import pipeline, open behavior, risks.
- v0.1: Initial draft.
