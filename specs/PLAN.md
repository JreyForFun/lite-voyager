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

### T-004 streaming CSV import spike (2026-10-09)

Owner authorized implementation and clarification of the measurement scope.
The standalone `npm run spike:csv -- --input CSV` command runs local UTF-8 CSV
parsing and `node:sqlite` inserts in a worker. `papaparse` 5.7.0 and
`@types/papaparse` 5.5.2 are MIT development dependencies, pinned in the lockfile;
they are not packaged in the extension. Tooling enables DOM declarations solely
because the upstream parser types describe browser APIs too. Official parser
behavior: [Papa Parse documentation](https://www.papaparse.com/docs);
[parser MIT license](https://github.com/mholt/PapaParse/blob/master/LICENSE).

- Default reads are 64 KiB; 1,000 inserts per transaction. Insert statements use
  parameters and quoted identifiers. A collision-free INTEGER PRIMARY KEY
  preserves record order even when CSV headers shadow every rowid alias;
  `rowOrderColumn` identifies this metadata, excluded from CSV-value digests.
  SQLite's durable journal/synchronous
  defaults stay enabled, the cache target is 8 MiB and temporary work is on disk.
  There is no queue of whole-table results or JavaScript row batches.
- Fields remain TEXT, including exact int64/REAL spellings, empty strings and
  literal `NULL`. The spike requires a comma delimiter, a nonblank unique
  header, UTF-8 and consistent LF/CRLF endings. BOM, quotes and multiline fields
  are supported. Ambiguous blank records, ragged rows, invalid encoding/NUL,
  malformed quotes, duplicate/blank headers and mixed/bare-CR endings fail
  clearly rather than changing or dropping values. Production delimiter/header
  controls, type inference and encoding selection remain FR-004's later tasks.
- Each invocation reserves a fresh directory, refuses existing destinations,
  and never writes the source. Failure/Ctrl+C waits for worker exit, removes
  only known partial SQLite files, and refuses to recursively remove unknown
  files. Source changes fail verification. Success retains `import.sqlite` and
  `report.json`; generated files remain git-ignored.
- The import duration includes parsing, inserts, streamed source hashing and
  a digest of all inserted text values. Verification duration is separate:
  rehash the source, compare size/mtime, iterate every SQLite row in order and
  compare the value digest/count, then check database integrity. Progress covers
  import and the verification stages. No file values are printed.
- Peak memory is the whole standalone process, including its worker, native
  SQLite and verification. Use the maximum of OS lifetime peak RSS and 10 ms
  RSS samples. Node reports `resourceUsage().maxRSS` in KiB, converted to bytes;
  see [Node process documentation](https://nodejs.org/api/process.html#processresourceusage).
  Memory is bounded relative to row count but depends on the largest record,
  header and read chunk. A sampling-only peak could miss short spikes.
- Parsed preview latency measures up to 100 data rows during import, including
  reads/parsing/inserts and excluding worker startup. It is supporting evidence
  for NFR-004, not visible first paint. A 1 GB standalone run is preliminary
  NFR-003 evidence; even a 5 GB run would not measure VS Code extension memory.
  Keep the original 5 GB / 500 MB and visible-under-two-second targets open.

Commands, disk-space requirements and owner evidence instructions are in
`test/fixtures/README.md`. T-004 stays open until owner benchmark evidence is
received. R-1 and the foundation milestone remain open; no comparison with
DuckDB or production extension performance is implied.

Observed final local run (2026-10-09, Windows x64, Node 26.5.0, SQLite 3.53.3):
`npm run spike:csv -- --input test/fixtures/generated/t005-10m-validation/large.csv --output test/fixtures/generated/t004-validated-1gb`
used the existing synthetic 1,258,888,906-byte CSV with 10,000,000 rows.
Import: 190,407.9622 ms; separate verification: 89,125.0099 ms;
total including worker startup: 279,844.9193 ms. Peak process RSS:
223,363,072 bytes (223.4 MB decimal); sampled peak: 222,420,992 bytes.
The first 100 parsed rows took 41.5683 ms. All 10,000,000 rows verified in
10,000 transactions; the resulting SQLite file was 1,406,361,600 bytes.
Source hashes matched at
`8caacc5001048cc3d7058b9c73aace7b100f9647a28f55af50082c4183b3e350`;
parsed/stored value digests matched at
`8be97c64febb03e2bc0ccd20de56962710601d2e28da2d6538aef0639b06a111`.
Verification and other heavy project commands were not run concurrently with
the final benchmark. Earlier diagnostic runs are not the final evidence.
An independent Python 3.14.6 / SQLite 3.53.2 read-only comparison checked all
10,000,000 CSV records against SQLite, including every field and the generator's
exact unsafe-integer/name/payload pattern. It also independently confirmed the
source SHA-256 (134,857 ms). The ignored `t004-validated-1gb` directory retains
the benchmark report, comparison script and comparison report. The large local
SQLite output was removed after validation to restore space for the owner's run;
the source CSV and pre-existing T-005 reference database were left untouched.

Feasibility decision: retain NFR-003's starting 500 MB target and NFR-004's
two-second target provisionally. The standalone memory/parsed-preview results
are encouraging; they do not establish either production target. No 5 GB run
was attempted because local free disk space was insufficient. Full import
takes several minutes here, so R-1 remains material: keep instant preview,
background progress and cancellation in the production plan. There is no
numeric full-import-time target or measured DuckDB comparison to justify
changing the database backend in this spike. Owner confirmation remains open.

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
  other platforms without the separate CI evidence below.
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
- Fresh CI evidence: [run 37916047454](https://github.com/JreyForFun/lite-voyager/actions/runs/37916047454),
  attempt 1, commit f3085869c88262b2ffdbfddb47805f6287cdcc3a, passed on
  2026-10-09. GitHub API metadata confirms successful Full verification jobs
  on windows-latest, ubuntu-latest, and macos-latest, including the applicable
  full-verification steps. Local verification, owner manual QA, and three-platform
  CI pass; the independent review below found missing edge cases, so T-002
  stays unchecked pending fixes and new verification/CI evidence.
- Final evidence-documentation gate: npm run verify passes with 93 unit tests,
  all strict checks, build, and a 346.49 KB VSIX in a disposable checkout. This
  preserves the owner's uncommitted edit to test/fixtures/empty.json; no claim
  is made that the edited local fixture passes the inventory hash check.
- Independent fresh-context review of 3a6bcf8..f164fd2 (2026-10-09) confirmed:
  HIGH: fallbackFile reads only the main database, so an open WAL writer's
  committed second row is silently omitted by sql.js (native returns 1,2;
  fallback returns 1 with hasMore=false). Reject unsupported WAL state clearly
  or read a complete committed snapshot, without modifying/checkpointing source.
  MEDIUM: collect rejects oversized column metadata before starting the row
  generator, bypassing its statement.free cleanup. Three rejected queries left
  three prepared sql.js statements alive after a subsequent successful query.
  Disposable reproductions use real sql.js 1.14.2 and current transpiled sources:
  node test/fixtures/generated/t002-review-wal-pr3sfi/reproduce.cjs
  node test/fixtures/generated/t002-review-statements-H4ezlu/reproduce.cjs
  Both ran on Windows, Node 26.5.0; statement instrumentation counts prepare/free.
  At review time, no code fixes were applied. Add failing WAL/file-in-use and pre-iteration cleanup
  tests before fixes. No other concrete lifecycle/cancellation/fidelity defect
  was found; the review does not prove absence of further defects.
- Owner authorized all T-002 fixes and restoration of empty.json. Red-first
  regressions reproduced both findings, checkpointed WAL without sidecars,
  sidecars appearing during copying, and observed file changes during copying.
  The fallback now resolves the source path, rejects WAL header versions and
  WAL/rollback-journal sidecars before/after reading, and compares file identity,
  size, and nanosecond modification/change timestamps. It never checkpoints,
  removes sidecars, or writes source files. These are conservative rejection
  guards, not an atomic snapshot/locking guarantee against arbitrary writers.
- sql.js statements now have explicit cursor cleanup around complete result
  collection; binding/metadata failures also free immediately. Real-engine
  prepare/free accounting covers repeated rejected metadata, binding/metadata
  failures, stepping/row-reading failures, oversized rows, empty results,
  successful queries, and paging stop.
- A red-first exact-boundary test found result-budget accounting omitted JSON
  object overhead and row separators. The 256 KiB cap now includes the complete
  UTF-8 JSON page value (columns, rows, hasMore), excluding its IPC envelope.
  The exact boundary succeeds; one additional byte fails on both engines.
- Independent fresh-context follow-up review found no remaining concrete
  T-002 defects. Its isolated build/reproduction verified native committed WAL
  reads, fallback live/checkpointed WAL rejection, unchanged source/WAL hashes,
  repeated oversized metadata and stepping-failure cleanup, paging cleanup,
  exact page boundary, and exact 64-bit integers. Reproduction:
  node out/t002-independent-fixes-review/reproduce.cjs
  Cross-platform CI and production performance remain separate evidence.
- Final-gate investigation: isolated VS Code startup intermittently logs a core
  cloud-dictation timeout because GitHub's built-in provider is absent. A
  test-only empty provider resolved that lookup but produced other core warnings
  (undeclared provider and no cloud account); the experiment was removed.
  No authentication feature, fabricated session, diagnostic filter, skipped
  engine test, or weakened warning gate is retained. Record clean full-gate and
  fresh CI results separately; the host startup timing remains a known issue.
- Final local full gate for the fixes passes: 103 unit tests, six real-host
  integration tests in VS Code 1.140.0, all strict runtime logs/typechecks/lint,
  and a 13-file 347.26 KB VSIX. Executing-query cancellation takes 21 ms native
  and 22 ms fallback; actual helper exit, reopening, and source hashes pass.
- VS Code 1.141.0 compatibility recheck also passes all six integration tests
  and strict runtime logs; cancellation is 20 ms native and 35 ms fallback.
- Fixes committed as 9b80bbfe805a84edf65e72297daf20a65ea8d041; final local
  evidence committed as 0e3ec57de8254b80a2aa8bc830ea65c527e8301c. After
  the automated push lacked credentials, the owner pushed the commits.
  [Fresh run 37922970386](https://github.com/JreyForFun/lite-voyager/actions/runs/37922970386),
  attempt 1 at 0e3ec57de8254b80a2aa8bc830ea65c527e8301c, passes on
  2026-10-09. GitHub API metadata confirms all three Full verification jobs
  (windows-latest, macos-latest, ubuntu-latest) and each applicable verification
  step succeeded. Together with local gates, owner manual QA and reviewed fixes,
  this closes T-002. The remaining foundation tasks and milestone gate stay open.

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
- v0.4 T-004 spike (2026-10-09): Recorded owner-approved scope, streaming/transaction settings, exact text fidelity, strict input rejection, safe output cleanup, final 1.26 GB measurements and independent 10-million-row comparison. Original NFR-003/NFR-004 targets remain unchanged; owner evidence is still required.
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
