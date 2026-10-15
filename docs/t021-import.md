# T-021 CSV / TSV import

## Use it

Run `Lite Voyager: Import CSV / TSV` from the Command Palette and select a saved
local UTF-8 file. The first complete rows appear before any import. Review the
detected delimiter, first-row header setting and Keep all values as text option.
After changing options, use Apply options / preview, then Import table.

The preview remains selectable during background import. Progress reports exact
bytes and rows; Cancel import stops the helper before removing partial storage.
After success, the same tab shows the existing read-only SQLite browser and SQL
editor. The table is named `records`. Closing the tab removes its session database.
The source file is never changed by import or browsing.

The preview-only command remains available and normal CSV/TSV opening stays text.
No new dependency or lockfile change is needed. Menus/default-editor changes,
disk-space preflight, startup orphan cleanup and Save as SQLite are later tasks.

## Data conventions

Blank/duplicate headers receive unique names using SQLite's ASCII case folding.
Header-off uses column_1, column_2, etc. Ragged extra fields create columns; missing
fields become SQL NULL. Empty text and literal NULL remain text. Interior blank
records are retained; a trailing record separator does not invent a row.

Inference examines at most the first 100 data rows. Canonical signed decimal
int64 values become INTEGER without JavaScript number conversion. Canonical finite
REAL spellings that round-trip become REAL. Other spellings, dates, booleans,
out-of-range integers, mixed numeric representations and conflicts become TEXT.
The full scan checks compatibility. A later conflict widens the whole column from
the original staged strings. Keep all values as text disables inference.

UTF-8 decoding is fatal; BOM is removed only at file start. LF/CRLF, quoted
delimiters, multiline fields and doubled quotes work. Malformed quotes, bare CR,
NUL and non-UTF-8 fail visibly rather than dropping/replacing data. Convert other
encodings to UTF-8; encoding selection is P2.

Primary import has no source-file size cap and uses disk-backed staging, 64-KiB
reads and 1,000-row transaction batches. Memory depends on one record and engine
caches, not file row count. SQLite/runtime single-record and column constraints
remain real limits; failures never truncate values. The preview's limits do not
limit import. Results retain the existing 4-MiB page budget and smaller-page controls.

Fallback announces memory-limited mode and stops above 20,000,000 source bytes or
64,000,000 allocated SQLite bytes, including staging/final tables. Updating VS Code
to a supported host with node:sqlite enables the primary engine. Existing targets
are never replaced; publication exclusively creates an internal destination.

## Validation and QA

Repaired full verification passes 663 tests/63 files and all 57 real-host cases,
including strict types/lint/build/package checks. It contains one approved renderer
warning: HOST-001 signed-out CloudSandboxApi. Exact source/line/severity/message
and all earlier failed/passing runs are in specs/VALIDATION.md, T-021. It is not
warning-free. Populated 1/5-GB CSV combined sampled host/helper peaks are
375,705,600 /343,932,928 bytes; full hashes and every imported payload pass.
The owner subsequently delegates visual QA and independent review to the assistant.
Both are performed with one confirmed export-close defect repaired test-first;
method, observation limits and preserved instrumentation failures are in
`docs/t021-qa.md`. Repaired canonical gates are recorded in VALIDATION/PROGRESS.
Only owner push and actual-candidate three-platform CI remain external steps.
Repaired standalone verification passes 663 tests/63 files and all package/type/
lint/build checks with zero diagnostics. After full verification, a help-text-only
cleanup removes an internal task reference; a fresh rebuilt screenshot/import
check passes. The final standalone check after that copy cleanup also passes:
663 tests/63 files, strict types/lint/build and 28-file/670.78-KB package check,
zero errors and zero warnings. Local QA/review is complete; only push/CI remain.

First post-push run 38689094274 fails on all three platforms: the CSV test labels
import-worker startup allocation as repeated paging. The phase repair keeps every
sample in the 500-MB peak/gap checks and keeps both 50-MB growth guards. It adds
actual post-import 60 Browse/20 SQL pages and explicit baseline/final observations
of the separate database helper. Eighteen focused checks and real host calibration
pass. Actual paging then exposes an 81.8-MB failure, independently reproduced at
82.3 MB. The database worker now uses the import worker's existing small nursery
with default old/large-object limits. Both populated sizes and all 80 pages pass
the unchanged guards (31.6/44.9-MB paging growth); the 16-MiB record remains intact
after explicit oversized-page rejection. Final standalone passes 666 units/64
files with zero diagnostics; final full passes 666 units and all 57 host cases
with one explicitly reported HOST-001 warning. Final 1/5-GB peaks are
428,367,872 /368,214,016 bytes; actual paging growth 33,869,824 /36,433,920 bytes.
All exact data/hashes, 80 pages, timing, sample coverage and unchanged memory
guards pass. Prior failures stay in VALIDATION; T-021 remains unchecked only for
owner push and fresh actual-candidate three-platform CI.

Automated acceptance coverage:

- `test/unit/csv-import.test.ts`: both engines, exact int64/REAL/text, late
  conflicts, headers/ragged/blank rows, header-off/all-text, hostile rowid names,
  malformed input, source changes, exclusive destinations, cancellation/cleanup,
  large cells/columns and fallback refusal. `csv-import-bom.test.ts` adds data BOMs.
- `test/unit/csv-import-panel.test.ts`, `csv-import-ui.test.ts` and
  `csv-import-view.test.ts`: session races/lifetime, typed options/messages,
  safe CSP/escaping, refreshed preview, exact progress and cancellation state.
  `csv-import-relay.test.ts` checks bounded backpressure and final counters.
- `src/test/csv-import.test.ts`: actual native/fallback webview controls, preview
  DOM, exact values, SQL/paging, unchanged sources, cancel and independent views.
- `src/test/csv-import-memory.test.ts`: real helper sampler calibration and
  populated 1/5-GB import, exact full-data SQL, full hashes, memory, responsiveness
  and first-row DOM. Fixture/data-check/cache/metadata unit suites reject corrupt
  data, missed helpers, stale identities and observer deadline/reader failures.
- Existing preview, browser, schema, cell, export and SQLite memory suites pass
  in the complete gates. Delegated visual observations and independent review are
  documented separately; other-platform results remain unobserved until CI.

Run `npm run verify` for the standalone gate and `npm run verify:full` for real
VS Code tests, strict runtime logs and generated large-file measurements.
The populated CSV memory test requires 13 GB free and runs 1-GB/5-GB fixtures
sequentially. The existing SQLite memory gate also runs. Generated data is disposable;
failed runs stay recorded in specs/VALIDATION.md rather than retried unchanged.

In VS Code, select **Run Extension** and press F5; the existing launch configuration
runs `npm: compile`. In the Extension Development Host, open the Command Palette
and run **Lite Voyager: Import CSV / TSV**. Report checks 1-5 below as PASS/FAIL.
For the optional forced-fallback visual check, temporarily add
`"env": { "LITE_VOYAGER_FORCE_FALLBACK": "1" }` to that launch configuration,
launch again, then remove that temporary entry before committing.

Visual checklist (delegated to the assistant; results in docs/t021-qa.md):

1. Import a BOM/CRLF CSV with quoted commas/newlines. Review the preview, select a
   multiline cell, and confirm its complete value in light and dark themes.
2. Try semicolon and tab-delimited files. Change header off and all-text; apply
   the options and confirm the first record becomes data with generated names.
3. Import, observe progress, and select preview cells while it runs. On completion,
   use paging and run `SELECT count(*) FROM records`; inspect schema and cell values.
4. Cancel an import, close its tab, and reopen a valid file. Open two tabs and
   confirm cancelling/closing one leaves the other usable. Source files must match.
5. With the fallback hook, confirm the memory-limited banner and actionable large
   input refusal. With malformed/non-UTF-8 input, confirm errors and recovery.

Physical paint and new-code three-platform CI remain separate evidence. Fresh
independent review and scoped visual inspection are now recorded in docs/t021-qa.md.
The owner pushes. T-021 remains unchecked until applicable closure checks pass.

## Files in this change

Modified:

- `.vscodeignore`, `esbuild.js`, `package.json`
- `src/extension.ts`, `src/protocol.ts`
- `src/loaders/file-loader.ts`, `src/loaders/csv-loader.ts`, `src/loaders/csv-preview-reader.ts`
- `src/worker/csv-preview-worker.ts`, `src/worker/db-process.ts`
- `src/test/sqlite-memory-support.ts`
- `src/test/sqlite-memory-observer.ts`, `test/unit/sqlite-memory.test.ts`
- `test/unit/dependency-audit.test.ts`
- `specs/SPEC.md`, `specs/PLAN.md`, `specs/VALIDATION.md`, `specs/TASKS.md`, `PROGRESS.md`

Created:

- `src/editor/csv-import.ts`, `src/editor/csv-import-ui.ts`
- `src/loaders/csv-detection.ts`, `src/loaders/csv-records.ts`
- `src/loaders/csv-import.ts`, `src/loaders/csv-import-client.ts`
- `src/worker/csv-import-process.ts`, `src/worker/csv-import-worker.ts`
- `src/worker/csv-import-relay.ts`
- `webview/csv-import.ts`, `scripts/csv-memory-fixture.mts`
- `scripts/csv-memory.mts`, `src/test/csv-memory-cache.ts`, `src/test/csv-memory-metadata.ts`
- `src/test/csv-import-data-check.ts`, `test/unit/csv-import-data-check.test.ts`
- `src/test/csv-memory-support.ts`, `test/unit/csv-memory-phases.test.ts`
- `src/test/csv-import.test.ts`, `src/test/csv-import-memory.test.ts`, `src/test/csv-import-memory-observer.ts`
- `test/unit/csv-import.test.ts`, `test/unit/csv-import-panel.test.ts`, `test/unit/csv-import-ui.test.ts`
- `test/unit/csv-import-view.test.ts`, `test/unit/csv-import-fixture.test.ts`, `test/unit/csv-import-memory.test.ts`
- `test/unit/csv-import-relay.test.ts`
- `test/unit/csv-import-bom.test.ts`
- `test/unit/csv-memory-metadata.test.ts`
- `docs/t021-import.md`
- `docs/t021-qa.md`

Build outputs, isolated test profiles and the temporary focused runner under out/
are generated artifacts. Existing owner changes and unrelated fixtures are preserved.
