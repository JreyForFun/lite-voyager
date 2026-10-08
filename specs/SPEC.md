# Lite Voyager: Spec (the "what" and "why")

Status: Draft v0.2 | Read `CONSTITUTION.md` first.
Companion files: `PLAN.md` (how), `TASKS.md` (work items).

Credit: the "query a file with SQL" idea is inspired by [nao1215/filesql](https://github.com/nao1215/filesql) (Go, MIT). Lite Voyager is an independent TypeScript implementation and shares no code with it.

---

## 1. Vision

Open any data file in VS Code, of any size, browse it, query it with SQL, and edit it, without leaving the editor.

**Target users:** developers whose project uses SQLite, and developers handed large CSV / JSON / Excel exports who want answers fast.

**Name:** Lite Voyager (see decision D-1). "Lite" is a nod to SQLite and a promise: small, fast, focused.

## 2. Competitive landscape and "beat them all"

Checked on the VS Code Marketplace and GitHub. Install counts come from search snippets and may be out of date; **re-verify in task T-001**.

| Extension | What it does | Gap we can exploit |
|---|---|---|
| DuckDB (Charlie Jonas), ~23k installs | Query CSV, Parquet, JSON, Excel with DuckDB | Query-centric; editing is not its focus |
| DuckDB Viewer (Caio Ricciuti), ~2.5k installs | Browse and query DuckDB, Parquet, CSV, JSON | Uses native bindings |
| Duckweed, 1 install | Browse and edit SQLite and CSV, WebAssembly engines | Brand new; WASM engines load files into memory |
| SQLite Viewer (qwtel) | Polished read-only SQLite viewer | Its README says read-only, no query runner, files must fit in memory |
| SQLite3 Editor (yy0931) | SQLite-focused editor | SQLite only |
| vscode-sqlite (alexcvzz) | Query and explore SQLite | Relies on bundled sqlite3 CLI binaries |

**Reality check:** multi-format querying inside VS Code already exists, mostly built on DuckDB. Our edge cannot be "nobody does this". "Beat all of them" is turned into measurable goals:

| Goal | Measurable target | Requirements |
|---|---|---|
| G1. Any size, bounded memory | Opens a multi-GB SQLite or CSV with memory staying flat and first rows visible in about 2 s | FR-001, FR-004, NFR-003, NFR-004 |
| G2. Edit, not just view | Inline edit with staged changes, undo, and save for SQLite, CSV, and JSON | FR-020 to FR-022 |
| G3. One tool for all formats | SQLite, CSV/TSV, JSON/JSONL, XLSX in one UI, joinable | FR-004 to FR-006, FR-030 |
| G4. Zero setup | No native binaries, no CLI, works out of the box | NFR-002 |
| G5. Best-in-class feel | Autocomplete, history, cancel, virtualized grid, theme-aware | FR-012, FR-013, FR-015 |

**Benchmark suite (task T-060):** a repeatable test on the same machine comparing time to first rows, peak memory, and query time on a 1 GB CSV and a 1 GB SQLite file against the DuckDB extension, DuckDB Viewer, and SQLite Viewer. We only claim "faster" or "better" where the numbers show it.

**Known trade-off:** DuckDB reads CSV and Parquet in place without importing and is very fast at big analytical queries. Our approach imports CSV into an on-disk SQLite file, so a first load of a huge CSV will be slower. We compensate with instant preview, background import with progress, and editing. A DuckDB-backed read path stays a future option (see `PLAN.md` risk R-1).

## 3. Scope

### In scope for v1
Open and browse SQLite, CSV/TSV, JSON/JSONL, XLSX. SQL editor with results. Export. Inline editing. Multi-file joins.

### Future backlog (explicitly not v1)
- Hex / BLOB viewer and editor
- SQLCipher encrypted database support (needs a different SQLite build, such as a cipher-enabled native module)
- Parquet support
- Visual table designer and index manager
- SQL dump export, charts
- Excel write-back
- Foreign-key navigation
- DuckDB-backed read path for in-place CSV/Parquet analytics
- VS Code for Web support

**BLOB handling in v1:** BLOB cells show a placeholder only, such as `[BLOB 24 KB]`.

## 4. Functional requirements

Priority: **P0** first release, **P1** next, **P2** later in v1.

### Opening and browsing

**FR-001 (P0) Open SQLite files.** Opens `.db`, `.sqlite`, `.sqlite3`, `.db3`. Detection uses the file header (`SQLite format 3`), not just the extension. The file is read from disk, never fully loaded into memory.
- Given a valid SQLite file of any size, when opened, then tables and views are listed and the first rows are visible within the NFR-004 target.
- Given a file that is not valid SQLite, then a clear error is shown and the file is not modified.
- Given a host without `node:sqlite` (fallback engine), then a banner explains the memory-limited mode. Files above 200 MB (start) are not loaded silently: the user is told why and how to fix it (update VS Code, or use a host with Node 22+), and may choose to proceed.

**FR-002 (P0) Browse a table.** Paginated grid (default 100 rows per page). NULL is visually distinct from an empty string. Total row count is computed lazily, with a "count rows" action for huge tables so opening never stalls.

**FR-003 (P0) View schema.** Column name, type, primary key, NOT NULL, default value, and the table's indexes.

**FR-004 (P1) Open CSV / TSV of any size.**
- First rows are previewed immediately by reading the start of the file, before any import.
- The full file is streamed into a temporary on-disk SQLite table in the background, with a progress bar and a cancel button.
- Delimiter is auto-detected; header row is on by default with a toggle.
- Column types are inferred from a sample, with text as the fallback and an option to keep everything as text.
- Queries run once the import finishes; browsing the preview works during import.
- Handles a UTF-8 BOM, CRLF and LF line endings, and quoted fields that contain commas or line breaks. Non-UTF-8 files let the user pick an encoding (P2).

**FR-005 (P1) Open JSON / JSONL.** JSONL is streamed. A top-level JSON array of objects is streamed with a streaming parser. Columns are the union of keys. Nested values are stored as JSON text and are queryable with `json_extract()`. Unsupported shapes get a clear explanation.

**FR-006 (P1) Open XLSX.** One table per sheet, first row as header, formulas read as cached values. Honest limit (Constitution 6): XLSX is zipped XML and must be read into memory, so a warning appears above 100 MB.

**FR-007 (P1) Temporary storage.** Imported data lives in a temp SQLite file in the extension's storage folder. Check free disk space before import. Clean up on close, and clean up orphaned temp files on next startup. Offer "Save as SQLite file".

### Querying

**FR-010 (P0) SQL editor.** Syntax highlighting. Run with a button or `Ctrl/Cmd+Enter`; if text is selected, only the selection runs.

**FR-011 (P0) Results grid.** Shows row count and execution time. SQL errors show the SQLite message and keep the previous results. Results are paged from the engine, never held whole in the webview.

**FR-012 (P1) Autocomplete** for table names, column names, and keywords from the loaded schema.

**FR-013 (P2) Query history,** last 50 per file.

**FR-014 (P1) Export results** to CSV or JSON, streamed so large results do not exhaust memory.

**FR-015 (P0) Cancel a running query.** The UI stays responsive and the user can stop any query.

**FR-016 (P0) Read-only by default.** SQLite files open read-only. Write statements and inline editing need the user to switch on write mode, which is clearly indicated.

**FR-017 (P1) Sort and filter the grid.** Click a column header to sort; add a simple per-column filter. Sorting and filtering run in the engine, not in the webview, so they work on huge tables. Sorting a large table on an unindexed column shows a warning and can be cancelled.

**FR-018 (P1) Cell details and copy.** Selecting a cell shows its full value in a side panel (long text, JSON pretty-printed). Copy a cell, row, or selection as TSV.

### Editing

**FR-020 (P1) Inline edit (SQLite).** Edits are staged, shown with VS Code's dirty indicator, and applied in a single transaction on save. Undo / revert discards staged changes. Tables are addressed by primary key, else by `rowid`. A `WITHOUT ROWID` table with no primary key is read-only with an explanation.

**FR-021 (P1) Add and delete rows,** same staging and save rules.

**FR-022 (P2) Write-back for CSV and JSON.** Written to a temp file and renamed atomically. A warning explains that type inference and formatting may change.

### Multi-file and housekeeping

**FR-030 (P2) Multi-file session.** Several files appear as tables named from the filename (sanitized, collisions get a numeric suffix). `orders.csv JOIN customers.json` works.

**FR-040 (P2) External change detection.** If the file changes on disk, offer to refresh. Never overwrite newer on-disk changes without asking.

## 4.1 Data fidelity (applies to every format)

- SQLite integers are 64-bit. Values beyond JavaScript's safe range (about 9 quadrillion) must display exactly, never rounded. The engine reads them as BigInt or text.
- REAL values display without silent rounding. Dates and times are shown as stored, with no timezone conversion.
- NULL, empty string, and the text "NULL" are visually distinct.
- Table and column names are always quoted as identifiers when building SQL; user data is never concatenated into SQL.

## 5. Non-functional requirements

Targets marked "start" are starting points to validate in the benchmark task, then tighten or relax with evidence.

| ID | Requirement | Target |
|---|---|---|
| NFR-001 | Source files are never modified unless the user saves | Verified by automated test |
| NFR-002 | Windows, macOS (Intel and Apple Silicon), Linux; no native binaries to ship or install | Primary engine is Node's built-in `node:sqlite`; the engine is feature-detected at runtime, with a sql.js fallback. Exact minimum VS Code version is set from T-002 results |
| NFR-003 | No artificial size limit on the primary engine; memory stays bounded | Peak extension memory under 500 MB while importing a 5 GB CSV (start). Fallback engine is exempt but must warn |
| NFR-004 | Fast first paint | First rows visible in under 2 s for any CSV or SQLite file, excluding cold-disk effects (start) |
| NFR-005 | UI never blocked | Main thread blocked for no more than 100 ms during any operation |
| NFR-006 | Privacy | No network calls, no telemetry in v1 |
| NFR-007 | Accessibility and theming | Keyboard-navigable grid, light and dark themes |
| NFR-008 | Small package | Under 10 MB (the sql.js fallback adds roughly 1 MB; verify) |
| NFR-009 | Security: files are untrusted input | Strict webview Content Security Policy with no remote content; read-only by default; SQLite extension loading stays disabled; identifiers quoted; evaluate `PRAGMA trusted_schema=OFF` for opened databases (verify in T-002); declare limited behavior in untrusted workspaces (write mode off) |
| NFR-010 | Diagnosable | Logs go to a VS Code Output channel; no file contents or personal data in logs |

## 5.5 Screens and states

Every screen must handle each of these, with a test or a manual checklist item:

| State | What the user sees |
|---|---|
| Empty | A database with no tables, or an empty CSV: a friendly message, not a blank panel |
| Loading / importing | Progress bar with bytes processed, plus a cancel button |
| Error | Plain-language message and what to try next; technical detail behind a "details" link |
| Fallback engine | A banner: "memory-limited mode", with how to fix it |
| Write mode | A clearly visible indicator, and a dirty marker when edits are staged |
| Huge result | "Showing first N rows" notice with a way to page or export |

## 6. Open-question decisions

| ID | Question | Decision |
|---|---|---|
| D-1 | Name | **Lite Voyager**. Chosen over "DB Voyager" because it signals a small, focused tool rather than a full database suite. Searches found no existing VS Code extension with this exact name (other unrelated "Voyager" tools exist), but search results are not proof: verify the Marketplace name and publisher ID in T-001. |
| D-2 | Beat all competitors | Converted to measurable goals G1 to G5 and a benchmark suite (section 2). |
| D-3 | Open files of any size | Accepted. Primary engine is disk-backed `node:sqlite`; a memory-limited sql.js fallback keeps the extension working on hosts that lack it (see `PLAN.md`, D-3). Real limits are disk space and, for XLSX, memory. |
| D-4 | License | **MIT.** Permissive, familiar, and maximizes adoption. Run a dependency license audit in T-050. |
| D-5 | CSV open behavior | SQLite files open in Lite Voyager by default (the text editor is useless for them). CSV, TSV, JSON, JSONL, XLSX do **not** hijack the default editor: they open through "Open With...", an Explorer right-click "Open in Lite Voyager", and a button in the editor title bar. Setting `liteVoyager.openCsvByDefault` (default off) flips this. |

## Changelog
- v0.4: Added FR-017 (sort/filter), FR-018 (cell details), data fidelity rules, security and diagnostics NFRs, and screen states.
- v0.3: Renamed to Lite Voyager. Engine risk resolved with a fallback strategy (PLAN D-3). Added fallback behavior to FR-001.
- v0.2: Split into multiple files. Added competitive analysis, any-size requirement, resolved Q1 to Q5.
- v0.1: Initial single-file draft. Hex / BLOB viewer and SQLCipher moved to backlog.
