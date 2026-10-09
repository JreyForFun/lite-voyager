# Lite Voyager: Spec (the "what" and "why")

Status: Draft v0.5 | Read `CONSTITUTION.md` first.
Companion files: `PLAN.md` (how), `TASKS.md` (work items).

Credit: the "query a file with SQL" idea is inspired by [nao1215/filesql](https://github.com/nao1215/filesql) (Go, MIT). Lite Voyager is an independent TypeScript implementation and shares no code with it.

---

## 1. Vision

Open any data file in VS Code, of any size, browse it, query it with SQL, and edit it, without leaving the editor.

**Target users:** developers whose project uses SQLite, and developers handed large CSV / JSON / Excel exports who want answers fast.

**Name:** Lite Voyager (see decision D-1). "Lite" is a nod to SQLite and a promise: small, fast, focused.

## 2. Competitive landscape and positioning

**Re-verified on 2026-10-09** by reading each extension's Marketplace or GitHub page. Install counts are as shown on the Marketplace that day. Capabilities come from each extension's own description; we have not run these extensions ourselves, and any performance claim waits for the benchmark task (T-060).

| Extension | Installs | Verified capabilities | Limits and notes (from its own page) |
|---|---|---|---|
| SQLite3 Editor (yy0931) | 660,426 | Spreadsheet-style editing, table schema editing, query editor with autocomplete and syntax validation, foreign-key navigation, ER diagram, auto-reload, CSV / JSON / SQL import and export, image BLOB previews, git diff. Fetches only the visible rows from disk, so large databases load quickly | SQLite only. Bundles a native helper (Rust) built per platform. GPL-3.0 |
| SQLite Viewer (qwtel) | 3,659,148 | Read-only viewer with virtualized scrolling, sort, filter. No native dependencies; also runs in VS Code for Web. Actively updated (v26.9.1) | README: files must be under 200 MB and are loaded into memory; no query runner; includes a paid upgrade and sponsored content |
| SQLite (alexcvzz) | 4,719,794 | Run queries through a bundled sqlite3 CLI, sidebar explorer, autocomplete, export to JSON / CSV / HTML | Relies on CLI binaries. Last published version is 0.14.1; the asset timestamp suggests mid-2022 (our inference) |
| Data Wrangler (Microsoft) | 2,345,864 | Opens CSV / TSV, Parquet, Excel, JSONL. View, filter, sort, column statistics, one-click transforms with generated Pandas code. Sandboxed until you export | Requires Python 3.8+ with the Jupyter and Python extensions. No SQL. Collects usage telemetry |
| DuckDB (Charlie Jonas) | 24,665 | Query CSV, Parquet, JSON, Excel by file path with DuckDB SQL (so joins across files work in SQL). Virtualized grid, sort, filter, column statistics, autocomplete, history, export. Double-click a cell to edit and **save back to the source file**. MIT; also on Open VSX | Runs DuckDB's native Node API in the extension host; memory limit about 1.5 GB with spill to disk. Opens CSV by default. Its page does not mention SQLite files (DuckDB can read them through its own extension; unverified here) |
| DuckDB Viewer (Caio Ricciuti) | 2,658 | Browse and query DuckDB, Parquet, CSV, JSON / JSONL. CodeMirror 6 editor, autocomplete, history, SUMMARIZE | Native DuckDB bindings with per-platform packages. No Excel listed. No editing listed |
| Duckweed (chaffed) | 1 (v0.1.0) | Browse, query, and edit SQLite and CSV / TSV; DuckDB read-only. Pure WebAssembly, no native binaries | Its README says SQLite databases are loaded into memory (fine to "a few hundred MB"), UTF-8 only, SQLite files with a pending WAL open read-only, no JSON or Excel. Brand new |

Seen but not checked in depth: SQLite View (jsldvr; bundles native SQLite runtimes, CSV import / export), SQL Explorer, DuckDB SQL Tools, and several small SQLite viewers.

### 2.1 What this changes

- **The market is crowded.** SQLite has a dominant editor (SQLite3 Editor, 660k installs) plus two tools with millions of installs. Tabular files are served by Microsoft's Data Wrangler (2.3M installs, needs Python) and by DuckDB-based extensions (about 25k installs for the largest).
- **Earlier drafts of this spec were wrong in places.** SQLite Viewer has about 3.7M installs, not ~2M. The DuckDB extension can edit cells and save back to the source file; we had written that editing "is not its focus". SQLite3 Editor is far more than "SQLite only", and its large-database handling matches what we planned. The "500K to 1M installs" ceiling mentioned earlier in conversation was a guess with no evidence behind it.
- **"Any size" is table stakes, not a differentiator.** SQLite3 Editor reads only visible rows; the DuckDB extension spills to disk. It only sets us apart from the in-memory tools (SQLite Viewer under 200 MB, Duckweed a few hundred MB).
- **Cross-file joins are not unique.** DuckDB SQL can read several files by path.
- **Do not compete on SQLite schema tooling** (schema editor, ER diagram, foreign-key navigation). SQLite3 Editor already does this well.

### 2.2 Where a gap still appears to exist

1. **Disk-backed and no native binaries, together.** Every verified disk-backed tool ships native code (a Rust helper, native DuckDB bindings, or a bundled sqlite3 CLI). The tools without native code are memory-bound. Node's built-in `node:sqlite` could give both, **if spike T-002 confirms it works** inside VS Code.
2. **One lightweight tool for SQLite + CSV/TSV + JSON/JSONL + XLSX, with editing, and no Python or DuckDB.** Data Wrangler needs Python; the DuckDB extension is DuckDB-centric; Duckweed lacks JSON and Excel and is memory-bound.
3. **"Lite".** Smaller and simpler than the feature-heavy options. This is subjective and must be tested with real users.

### 2.3 Goals (revised honestly)

"Beat them all" is not testable. These goals are, and each is labeled by how much it really separates us:

| Goal | Separates us? | Measurable target | Requirements |
|---|---|---|---|
| G1. Any size, bounded memory, no native binary | Yes, as a combination (see 2.2 item 1) | Opens a multi-GB SQLite or CSV with memory flat and first rows visible in about 2 s, with no native code shipped | FR-001, FR-004, NFR-002, NFR-003, NFR-004 |
| G2. Edit, not just view | Parity, not unique | Inline edit with staged changes, undo, and save for SQLite, CSV, and JSON | FR-020 to FR-022 |
| G3. One tool for SQLite, CSV/TSV, JSON/JSONL, XLSX | Only as a bundle | All four formats open in one UI and are queryable | FR-004 to FR-006, FR-030 |
| G4. Zero setup (no native binaries, no Python, no CLI) | Yes (Data Wrangler needs Python; others ship native code) | Works after install on a locked-down machine | NFR-002 |
| G5. Good feel | Table stakes (the DuckDB extension already has autocomplete, history, statistics) | Autocomplete, history, cancel, virtualized grid, theme-aware | FR-012, FR-013, FR-015 |

**Benchmark suite (task T-060):** a repeatable test on the same machine measuring time to first rows, peak memory, and query time on a 1 GB CSV and a 1 GB SQLite file, against SQLite3 Editor (SQLite), the DuckDB extension (CSV), and DuckDB Viewer. SQLite Viewer and Duckweed can only be compared on files within their own memory limits. We claim "faster" or "better" only where the numbers show it.

**Known trade-off:** DuckDB reads CSV and Parquet in place without importing and is very fast at big analytical queries. Our approach imports CSV into an on-disk SQLite file, so a first load of a huge CSV will be slower. We compensate with instant preview, background import with progress, and editing. A DuckDB-backed read path stays a future option (see `PLAN.md` risk R-1).

**Positioning status: proposed, awaiting the owner's decision (D-2).** Lite Voyager is the lightweight, zero-native-binary, disk-backed tool for SQLite and tabular files. Its success depends on the T-002 and T-004 spikes.

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

- T-002 cancellation acceptance (owner-authorized design revision, 2026-10-09):
  on the deterministic long-query fixture, cancellation stops the database helper
  and confirms its exit within 1,000 ms, even after SQL execution has begun.
  Reopening starts a fresh helper and a new query succeeds. Rejecting the host
  promise while native SQL continues running does not count as cancellation.

**FR-016 (P0) Read-only by default.** SQLite files open read-only. Write statements and inline editing need the user to switch on write mode, which is clearly indicated.

- T-002 fallback snapshot safety: refuse WAL-mode database headers (including
  checkpointed WAL files), WAL/rollback-journal sidecars, or a file observed to
  change while being copied. Explain that a host with node:sqlite is required;
  never checkpoint or alter a source to make fallback opening succeed.
- T-002 result cleanup: free every sql.js statement on success, paging stop,
  or failure, including binding, column metadata, and pre-iteration limits.
- T-002 result pages fit 256 KiB as complete UTF-8 JSON values, including column
  metadata, row separators, and hasMore. Oversized pages fail explicitly.

**FR-017 (P1) Sort and filter the grid.** Click a column header to sort; add a simple per-column filter. Sorting and filtering run in the engine, not in the webview, so they work on huge tables. Sorting a large table on an unindexed column shows a warning and can be cancelled.

**FR-018 (P1) Cell details and copy.** Selecting a cell shows its full value in a side panel (long text, JSON pretty-printed). Copy a cell, row, or selection as TSV.

### Editing

**FR-020 (P1) Inline edit (SQLite).** Edits are staged, shown with VS Code's dirty indicator, and applied in a single transaction on save. Undo / revert discards staged changes. Tables are addressed by primary key, else by `rowid`. SQLite requires a primary key on every valid `WITHOUT ROWID` table; address these tables by that key, including every component of a composite key.

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
| NFR-002 | Windows, macOS (Intel and Apple Silicon), Linux; no native binaries to ship or install | Primary engine is Node's built-in `node:sqlite`, feature-detected in a worker with a sql.js fallback. Supported minimum is VS Code 1.140.0, the lowest T-002 tested host; 1.141.0 also passes locally. Other-platform evidence remains pending. A killable helper reuses the bundled runtime, without an external CLI or shipped binary. |
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
| D-1 | Name | **Lite Voyager**. Chosen over "DB Voyager" because it signals a small, focused tool rather than a full database suite. T-001 human evidence recorded on 2026-10-09: the owner reports the exact Marketplace name is free, supplied publisher ID `jreyinnovarev`, and updated the competitor review in section 2. Account ownership and individual Marketplace figures were not independently verified by the AI. |
| D-2 | Beat all competitors | **Open.** Re-verification (section 2) shows a crowded market. Proposed positioning: the lightweight, zero-native-binary, disk-backed tool for SQLite and tabular files; do not compete on SQLite schema tooling. Owner to confirm after the T-002 and T-004 spikes. |
| D-3 | Open files of any size | Accepted. Primary engine is disk-backed `node:sqlite`; a memory-limited sql.js fallback keeps the extension working on hosts that lack it (see `PLAN.md`, D-3). Real limits are disk space and, for XLSX, memory. |
| D-4 | License | **MIT.** Permissive, familiar, and maximizes adoption. Run a dependency license audit in T-050. |
| D-5 | CSV open behavior | SQLite files open in Lite Voyager by default (the text editor is useless for them). CSV, TSV, JSON, JSONL, XLSX do **not** hijack the default editor: they open through "Open With...", an Explorer right-click "Open in Lite Voyager", and a button in the editor title bar. Setting `liteVoyager.openCsvByDefault` (default off) flips this. |

## Changelog
- v0.5 T-002 review fixes (2026-10-09): Owner authorized conservative fallback rejection of WAL/journal snapshots and observed concurrent changes, complete statement cleanup, and exact complete-page budget accounting. No source checkpointing or mutation is allowed.
- v0.5 T-002 cancellation clarification (2026-10-09): Owner authorized revising the cancellation design after slow native worker termination. Added a 1,000 ms deterministic-spike target, confirmed helper exit, and successful reopening. NFR-002 documents the lowest tested supported host, VS Code 1.140.0; cross-platform closure remains pending.
- v0.5 T-001 evidence / spec consistency (2026-10-09): Recorded the owner's Marketplace reports; preserved the supplied competitor review and open D-2 positioning. Restored the previously approved FR-020 correction and its T-005 changelog entry after they were reverted in the review update.
- v0.5: Competitor table re-verified on 2026-10-09 against Marketplace and GitHub pages. Corrected install counts and capabilities, added Data Wrangler and SQLite (alexcvzz), revised goals G1 to G5, marked positioning (D-2) as open.
- v0.4 T-005 clarification (2026-10-09): Corrected the impossible WITHOUT ROWID/no-primary-key case in FR-020 after user approval; fixtures cover a valid composite primary key.
- v0.4: Added FR-017 (sort/filter), FR-018 (cell details), data fidelity rules, security and diagnostics NFRs, and screen states.
- v0.3: Renamed to Lite Voyager. Engine risk resolved with a fallback strategy (PLAN D-3). Added fallback behavior to FR-001.
- v0.2: Split into multiple files. Added competitive analysis, any-size requirement, resolved Q1 to Q5.
- v0.1: Initial single-file draft. Hex / BLOB viewer and SQLCipher moved to backlog.
