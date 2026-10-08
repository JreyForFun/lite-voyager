# Lite Voyager: Plan (the "how")

Status: Draft v0.2 | Implements `SPEC.md` under `CONSTITUTION.md`.

## 1. Stack

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript, strict mode | |
| Database engine | Primary: Node's built-in `node:sqlite`. Fallback: `sql.js` (WASM) | Primary is disk-backed, so no size limit, and ships no native binary. It needs Node 22+ in the extension host. The fallback keeps the extension working elsewhere, with a memory limit and a visible warning. |
| Engine isolation | `worker_threads` | `node:sqlite` is synchronous, so all database work runs in a worker. This keeps the UI responsive and makes cancel possible (terminate the worker). |
| CSV | `papaparse` in streaming mode | Chunked reads, batched inserts in transactions |
| JSON / JSONL | Line reader for JSONL; a streaming JSON parser for big arrays | |
| XLSX | SheetJS or an alternative | Memory-bound by format. Note: the old `xlsx` package on npm is outdated; check SheetJS's current install guidance and security advisories in T-050. |
| SQL editor | CodeMirror 6 (start) | Confirm in T-008 |
| Grid | Virtualized, windowed rendering | Must stay smooth with very tall tables |
| Build | `esbuild`, two bundles (host and webview) | |
| Tests | Vitest for logic; `@vscode/test-electron` for integration | |

## 2. Decision log

**D-3 Engine: two implementations behind one interface, chosen at runtime.** Decided by judgement rather than waiting for a spike, because the downside of being wrong is small and the upside is an extension that never simply crashes.
- **Primary: `node:sqlite` in a worker thread.** Reads from disk, so any file size works. No native binary, so none of the Electron ABI problems that make `better-sqlite3` painful in VS Code. `node:sqlite` is synchronous, so it must run in a worker to keep the UI responsive and to allow cancel (terminate the worker).
- **Fallback: `sql.js`.** Used automatically when `node:sqlite` is missing (older VS Code, remote hosts on Node 20, VS Code for Web). It loads the file into memory, so it shows a "memory-limited mode" banner and asks before loading large files. This is the only place the "any size" promise is relaxed, and it is announced, never silent (Constitution 2 and 6).
- **How it works:** both engines implement one `Engine` interface (open, schema, page, query, cancel, close). At startup the extension tries to load `node:sqlite` inside a try/catch and picks the engine. Everything above the interface (UI, import pipeline, staging) is engine-agnostic.
- **Why not a native module (`better-sqlite3`):** it must match VS Code's Electron ABI and be built per platform, which is the maintenance burden we set out to avoid. It stays as a last resort if both engines prove inadequate.
- **Role of spike T-002:** no longer a go/no-go gate. It measures reality (which VS Code versions have `node:sqlite`, whether workers behave) so we can set the documented minimum version and verify the fallback triggers correctly.
- **Cost:** two engine implementations to test, and the CSV import pipeline needs a fallback path (the sql.js route imports into memory, so it is capped).

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
        | MessagePort                              | postMessage
        v                                          |
DB worker thread  <------ host relays typed messages ------>
(node:sqlite, queries, paging)
```

- The webview never touches files or the database. It sends typed requests and renders typed responses.
- Query results are paged in the worker; the webview only ever holds the rows it is showing.
- Cancel terminates and restarts the worker, then reopens the database.

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
- GitHub Actions on every push: lint, unit tests, and integration tests on Windows, macOS, and Linux, with both engines.
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
- v0.4: Added commands/settings list and release plan.
- v0.3: Renamed to Lite Voyager. D-3 now defines a primary engine plus fallback behind one interface.
- v0.2: Engine changed from sql.js to `node:sqlite` in a worker (any-size requirement). Added import pipeline, open behavior, risks.
- v0.1: Initial draft.
