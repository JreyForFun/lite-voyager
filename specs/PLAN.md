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
| XLSX | SheetJS Community Edition, for the future XLSX task | Memory-bound by format. T-050 checked official CDN 0.20.3, Apache-2.0 and advisories; prefer an integrity-checked vendor tarball and recheck when implementing. Do not use outdated npm `xlsx` 0.18.5. No XLSX dependency is installed yet. |
| SQL editor | CodeMirror 6 | Confirmed by owner T-008 manual QA (2026-10-09) |
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
Every failing command or console warning fails the verification pipeline.
Structured runtime logs permit only the two owner-approved, individually reported
host diagnostic families in VALIDATION section 1; all other warnings/errors fail.
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

T-007 CI repair (owner-authorized): initialize the installed-extension manifest
with an empty JSON array before launching the host, avoiding competing first-run
creation by the renderer and shared process. Keep both extension directories
free of installed extensions. Load a separate, generated development fixture
alongside Lite Voyager that contributes only a signed-out `github` authentication
provider. VS Code 1.140.0 requests GitHub sessions from its dictation service even
with `chat.disableAIFeatures` enabled; the fixture returns no sessions and rejects
creation/removal without credentials, UI or network calls. It uses the public
AuthenticationProvider API in the installed VS Code typings; it is test infrastructure,
not GitHub authentication coverage or extension functionality. The fixture is
excluded from the VSIX. The first real-host run passed all eight integration
tests and removed the original two warnings, but exposed a signed-out cloud
sandbox lookup warning and a vendor workbench-initialization timing warning.
The owner explicitly approved only the two source-restricted message families
in VALIDATION section 1; the scanner must return structured records and the
runner must report them. Every other warning and every error remains fatal.
Regression tests cover profile initialization, fixture wiring/behavior, real-host
signed-out lookup, and rejection of the exact reported warnings. The Windows
responsiveness fixture retains 100,000 rows and its timer assertion but batches
10,000 rows per transaction to avoid measuring 100 disk commits under CI load;
production/default import batching is unchanged. Full local verification and a
fresh three-platform CI run are required before closing the repair.

Local T-007 repair evidence (2026-10-10, Windows x64): final `verify:full`
passes strict types/lint, 197 unit tests, builds, the 15-file VSIX, and eight
integration tests in VS Code 1.140.0. The original manifest/dictation warnings
are absent. One `VSCODE-HOST-001` signed-out renderer record is reported with
its original warning severity; no unexpected warning or error is accepted.
Native/fallback cancellation and reopening pass (39 ms / 34 ms cancellation).
The generated authentication fixture is absent from the VSIX. New profile
regressions and exception-policy tests were observed failing before their fixes;
near matches, errors, wrong log sources and the original warnings still fail.
The earlier standalone `verify` also passed before the exception-policy change;
the final full command repeats all of its stages with the final code.
Fresh [CI run 37956761308](https://github.com/JreyForFun/lite-voyager/actions/runs/37956761308),
attempt 1 at `f3d82bb365f3886a18b950bbf61141a16b321faa`, passes all three
Full verification jobs on 2026-10-10. GitHub API metadata confirms successful
locked installation and each applicable full-verification step on Ubuntu,
Windows and macOS. T-007 repair is complete; milestone review remains pending.
No new compatibility minimum,
production benchmark, foundation completion or release tag is claimed.

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
`test/fixtures/README.md`. Owner verification and benchmark evidence have now
been received; T-004 is complete. R-1 and the foundation milestone remain open; no comparison with
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
changing the database backend in this spike. Owner-run evidence below completes
the spike without establishing either production target.

Owner-run completion evidence (2026-10-09), implementation commit
`7d9cf25020554ef32d8f422a937d0d4c41fa1fc7`:
the owner pasted `All verification checks passed.` and the full benchmark JSON.
The on-disk `report.json` in the ignored directory
`test/fixtures/generated/t004-10b2cd4c-cb00-4074-82ec-649573868332/`
independently matches the pasted numeric/hash fields. The same 1,258,888,906-byte
CSV imported 10,000,000 rows in 10,000 transactions into a 1,406,361,600-byte
SQLite file. Import: 145,436.5997 ms; separate verification: 60,147.8904 ms;
total: 205,873.3571 ms. Peak standalone process RSS: 222,994,432 bytes
(223.0 MB decimal); sampled peak: 222,035,968 bytes. The first 100 parsed rows
took 27.1822 ms. Windows x64, Node 26.5.0, SQLite 3.53.3, 64 KiB reads and
1,000-row transactions match the final local setup. All rows verified, and both
source hashes and parsed/stored value digests match the final local hashes above.
T-004's streaming, fidelity, safety, measurement and owner-evidence criteria are
met. Retain the provisional NFR-003/NFR-004 targets and R-1 mitigation; the
5 GB extension-memory and visible-first-paint measurements still remain open.

### T-008 editor and grid spike (2026-10-09)

Owner authorized implementation, necessary fixes and synthetic-fixture choices;
the owner will review/push and perform F5 manual QA. Detailed acceptance is in
SPEC.md, Querying / T-008 foundation spike.

- `Lite Voyager: T-008 Editor and Grid Spike` opens a local webview. The editor
  supports SQL syntax highlighting, selection and undo/redo. Query execution
  remains T-013. Owner manual QA confirms CodeMirror 6 (2026-10-09).
- Pinned development dependencies: MIT `@codemirror/state` 6.7.6,
  `@codemirror/view` 6.43.14, `@codemirror/commands` 6.11.1,
  `@codemirror/lang-sql` 6.10.0, `@codemirror/language` 6.13.1, and
  `@lezer/highlight` 1.2.5 (also a CodeMirror transitive dependency).
  Package metadata and shipped declarations verified the APIs/licenses;
  the bundle includes all fourteen editor dependency license notices. No grid
  library was added. The extension loads no remote assets and makes no requests.
- A deterministic six-column source synthesizes only requested 128-row pages
  on the host. Exact unsafe integers use BigInt-to-string conversion; unicode,
  script-looking literal text and BLOB placeholders exercise display mechanics.
  No files are opened or modified; no fixture inventory changes are needed.
- Typed protocol guards bound offsets, request IDs, page dimensions and text
  lengths. The client keeps at most four pages / 512 rows, with one request in
  flight, and renders only visible rows plus six overscan rows per side.
  A confirmed red-first regression rejects sparse row/cell arrays rather than
  accepting missing data through Array.every's empty-slot behavior.
  Scroll updates are coalesced through requestAnimationFrame. A reply for a
  superseded viewport cannot substitute the old rows for the new viewport.
- A capped 8,000,000-pixel physical track maps to all ten million logical rows,
  avoiding browser scroll-height limits. Wheel and keyboard movement use
  logical row height (28 pixels); scrollbar dragging maps the full range.
  First/middle/last and row-input jumps provide direct access. The maximum
  viewport height is 560 pixels, keeping the render window small.
- CSS uses VS Code theme variables; SQL token colors have light/dark variants.
  Local scripts and CodeMirror-injected styles use a cryptographic CSP nonce.
  Cell content is assigned through textContent. Loading/deadline failures are
  visible; closing releases timers, observers, listeners and the editor.
- Eleven new unit cases cover mapping/edges, paging/cache, message validation,
  CSP, exact/safe text, rendering, navigation/resize, stale replies, timeouts
  and disposal. Seven initial cases failed on absent implementation modules
  before implementation; four later cases strengthen behavioral validation.
  A real VS Code integration case opens and closes the webview twice and checks
  successful CodeMirror startup and bounded rendered/cached row counts.

Two full runs passed all seven integration tests in Windows x64 / VS Code
1.140.0, including real webview startup/reopening. Their strict runtime-log gates
failed on the pre-existing intermittent cloud-dictation authentication warning;
the diagnostics were not filtered or weakened. After owner QA and the final
protocol guard fix, fresh verification passes all 150 unit tests with zero
errors/warnings. The VS Code 1.141.0 integration probe passes all seven tests;
its strict log check again fails on the same warning. Final validation results follow
in PROGRESS.md. New three-platform CI, real database paging and production NFR-003/NFR-004/
NFR-005/NFR-007 performance/accessibility claims remain unproven by this spike.
README.md contains exact F5 steps and the report format. T-008 is complete at
commit 8fed6f0ef7dff1950f9b2dfca34004d77c71456a; the owner reports pushing and
local main matches origin/main. No new CI, milestone gate or tag is claimed.

Owner manual QA (2026-10-09), VS Code 1.141.0 (OS not restated in the report):
typing/selection/undo/redo, wheel/trackpad and scrollbar smoothness, first/middle/
last/jumps, keyboard/horizontal scrolling/resize, light/dark themes and close/
reopen all PASS. The owner clarified that the observed maximum cache was 512
rows, with about 20–23 rows rendered. Editor decision: **Keep CodeMirror 6**.
These are owner-observed usability results, not quantitative production NFR
measurements. The synthetic spike acceptance is met with passing verification;
the owner committed the implementation and QA documentation at 8fed6f0 and
reports pushing it. The task checkbox is now checked.

## 2. Decision log
### T-052 foundation feasibility decision (2026-10-10)

The owner delegated Milestone 0 closure decisions and necessary repairs while
retaining responsibility for pushing. Accept SPEC D-2's focused positioning:
lightweight, disk-backed SQLite/tabular browsing with no shipped native binary.
The completed T-002 helper/fallback spike and T-004 streaming/fidelity experiment
support building the read-only SQLite milestone. They do not justify a claim
to beat competitors or an engine/dependency change.

Retain R-1 as an accepted, monitored import-speed risk: the owner-run 1.26 GB
CSV takes 145.4 s to import, with 223.0 MB standalone peak RSS and 27.2 ms to
parsed preview. Keep instant preview, background progress and cancellation for
Milestone 2; revisit R-1 before that milestone with production measurements.
The original 5 GB / 500 MB extension-memory and under-two-second visible-row
targets remain open. Neither the standalone benchmark nor T-008's synthetic
grid proves them. Both macOS architectures and built-in-extension coexistence
remain separate compatibility checks, not claims made by the existing matrix.

Milestone 0 manual evidence is already recorded: T-002 owner cancellation,
recovery and responsive typing on both engines; T-004 owner benchmark and
all-row/hash verification; T-008 owner editor/scrolling/navigation/themes/
resize/reopen checks and CodeMirror 6 decision. No additional subjective QA is
claimed from automated tests. T-009's production Engine and fallback UX follow
only after the foundation gate passes and the phase-transition handoff.

Independent foundation review of `04c7bd7..e02f38f` found MEDIUM CSV whitespace
loss after closing quotes and a LOW immediate-reopen race after a worker crash.
Red-first regressions reproduced both; the CSV streaming validator now rejects
non-delimiter text after closing quotes, and reopening waits for failed helper
exit. Fresh-context post-fix review finds no remaining concrete HIGH/MEDIUM defect.
Full local verification passes with 207 unit/eight integration tests in VS Code
1.140.0, one explicitly reported approved VSCODE-HOST-001 warning, 30 ms / 28 ms
native/fallback cancellation and a 468.83 KB / 15-file VSIX. VALIDATION records
the coverage/manual/review evidence. Candidate CI and the fixture follow-up are
recorded below; foundation closure uses the final adjusted-fixture evidence.

The owner supplied passing [run 37961300752](https://github.com/JreyForFun/lite-voyager/actions/runs/37961300752),
attempt 1 at d18e5e6c4f9045524bd2ec05bb7dcebea2dbb155. Public API metadata
confirms successful locked installation and applicable full checks on all three
platforms. Final closure verification nevertheless exposed a local 5,045 ms
timeout in the existing 70 KB quoted-header fixture (5,000 ms bound). Change
only its read chunk from 7 to 4,096 bytes, preserving the full large header,
embedded LF, CRLF, exact value assertions and timeout, with an added assertion
that the header input spans reads. Other byte-boundary cases remain unchanged.
Focused validation passes. New full local and remote fixture-candidate evidence
is required before closing/tagging; the parser/helper repairs remain verified
by the supplied green run. This is a fixture efficiency repair, not a new
production performance claim.
Final adjusted-fixture full verification passes locally with 207 unit/eight
integration tests, one reported approved VSCODE-HOST-001 warning, 28 ms / 37 ms
native/fallback cancellation and a 15-file / 468.91 KB VSIX. Independent read-only
follow-up review confirms the fixture preserves its acceptance/time bound.
The owner supplied [run 37962951570](https://github.com/JreyForFun/lite-voyager/actions/runs/37962951570),
attempt 1 at exact commit `6b2d665f39aa5c544a74c1467b838acf6b45ac8a`. Public API
metadata verifies successful locked installs and applicable full-verification
steps on Ubuntu, Windows and macOS (2026-10-10 local). This completes the final
foundation CI requirement. Together with local full verification, scoped
coverage, owner QA and independent review, T-052 and Milestone 0 are complete.
The documentation-only closure commit is tagged locally `v0.0.1`; owner pushes
it and the tag. T-009 starts in a fresh chat. Production targets and compatibility
limitations remain open as described above.


**D-4 Dependency and license review (T-050).** Owner authorized the full locked dependency review and routine fixes on 2026-10-09. Include direct, transitive, development, peer and optional packages, even when another platform installs them. Package-manager license metadata is evidence, not a substitute for special license text.
- Given the current lockfile, the inventory must contain every non-root package path, exact version, declared license and scope flags. A canonical JSON SHA-256 ties the evidence to this dependency tree. Inventory tests must fail on omissions or stale versions/licenses.
- Given missing license metadata or `SEE LICENSE` declarations, record the resolved license, source and license-file hash. Do not guess or silently classify them as MIT.
- Given the shipped extension bundles, all embedded third-party packages and copied sql.js assets must retain their complete license notices. Development tooling is excluded from the VSIX.
- Run `npm audit --json`, record the date, runtime, registry, exit status and complete result, and investigate any reported vulnerability. A clean audit only means no known findings in that registry response.
- Check SheetJS's official current install guidance, CE license and advisories. Record the future installation choice without introducing the Milestone 2 XLSX feature.
- Owner delegated review decisions to the assistant for this task. Record the decision and any remaining issue; run `npm run verify` with zero errors/warnings before closure. Owner pushes.

**T-050 result (2026-10-09):** [dependency review](DEPENDENCIES.md), [full license inventory](dependency-licenses.json) and [raw audit evidence](dependency-audit.json) cover all 576 locked package paths. Two registry audit runs return exit 0 and zero known vulnerabilities. Resolve memorystream's missing metadata as MIT from its shipped license. All ten VSCE signing tarballs pass lockfile integrity checks and carry identical Microsoft-specific terms; retain them only as VS Code development tooling, excluded from the extension. Select JSZip's MIT option and retain development-only MPL tooling outside the VSIX. Retain current dependencies and overrides; no dependency/fixture fix is needed. Fourteen bundled editor packages and copied sql.js assets have complete MIT notices. Three red-first task tests and `npm run verify` pass (179 unit tests, strict types/lint, builds and VSIX packaging, zero errors/warnings). The owner authorized delegated review/decisions and handles pushing; no new full-gate/CI result or milestone closure is claimed.

**D-3 Engine: two implementations behind one interface, chosen at runtime.** Decided by judgement rather than waiting for a spike, because the downside of being wrong is small and the upside is an extension that never simply crashes.
- **Primary: `node:sqlite` in a worker thread inside a helper process.** Reads from disk and ships no native binary. The helper reuses `process.execPath`; Electron hosts use the documented `ELECTRON_RUN_AS_NODE=1` mode. Native execution does not reliably stop on worker termination alone, so cancel kills the helper with SIGKILL and confirms its exit before reopening. This keeps database work off the extension host and stops all the helper's threads.
- **Fallback: `sql.js`.** Used automatically when `node:sqlite` is missing in a supported Node extension host. The spike uses the same helper/worker lifecycle for both engines. It loads the file into memory, so production T-009 adds a "memory-limited mode" banner and a large-file prompt. The spike announces its 8 MiB input cap and rejects larger files before loading. This is the only place the "any size" promise is relaxed (Constitution 2 and 6). VS Code for Web is not established by this Node-host spike or the current manifest.
- **How it works:** T-009 exposes one asynchronous `Engine` interface (open, schema, page, query, cancel, close) through `EngineClient`, which supervises both worker-only `ReadBackend` implementations (`NodeSqliteEngine` and `SqlJsEngine`). This places interrupt-and-reopen cancellation at the helper supervisor, where it can interrupt synchronous SQL, rather than on an unresponsive worker. The worker chooses sql.js only when the built-in module is absent or `LITE_VOYAGER_FORCE_FALLBACK=1`; corrupt files or query failures do not change engines. Everything above the public interface stays engine-agnostic.
- **T-009 fallback UX:** the script-free Engine Check panel displays the mode before loading; files strictly above 200,000,000 bytes require consent. The worker checks the same file snapshot after consent and during loading. No production 8 MiB spike cap applies. Real host allocation failures are reported; WAL/journal snapshots are rejected explicitly. Later custom-editor tasks reuse the interface and UX. Pages contain at most 1,000 rows and 4 MiB; oversized pages fail visibly without truncation. Offset paging re-executes the read and skips earlier rows with bounded memory; deep-offset latency and changed-result stability remain considerations for production browsing/query tasks. Cancel confirms helper exit and reopens; previously approved memory cost may be reused only if the file has not grown.
- **Why not a native module (`better-sqlite3`):** it must match VS Code's Electron ABI and be built per platform, which is the maintenance burden we set out to avoid. It stays as a last resort if both engines prove inadequate.
- **Role of spike T-002:** no longer a go/no-go gate. It measures reality (which VS Code versions have `node:sqlite`, whether workers behave) so we can set the documented minimum version and verify the fallback triggers correctly.
- **Cost:** two engine implementations to test, and the CSV import pipeline needs a fallback path (the sql.js route imports into memory, so it is capped).

### T-011 worker metadata contract (2026-10-10)

The existing `Engine.schema(page)` remains the paged table/view catalog.
`columns(table, page)`, `indexes(table, page)` and
`indexColumns(table, index, page)` return the same bounded `EnginePage` shape,
with strings/NULL preserving metadata exactly. Column layouts are documented
on the Engine interface. No new dependency or webview feature is introduced.

Typed metadata requests share the existing helper/worker transport and pending
operation lifecycle. A worker-only schema helper validates main-schema object
existence, binds canonical object/index names and uses side-effect-free
`pragma_table_xinfo`, `pragma_index_list` and `pragma_index_xinfo` SELECTs.
Function resolution uses the empty temp schema to avoid source tables with
those names hiding the functions; their schema argument remains `main`.
See the [SQLite PRAGMA documentation](https://www.sqlite.org/pragma.html).
Index membership is checked through index_list, including WITHOUT ROWID
primary-key indexes that have no sqlite_schema row. Expression terms retain
their SQLite markers; index SQL supplies the original expression/partial clause.
Unknown objects/indexes, unavailable schemas and byte-budget failures return
actionable messages. Metadata has no row-count or user-table scan operation.
UI wiring is T-012; production first-row/memory targets remain unproven.

### T-012 production table browser (2026-10-10)

Owner delegates implementation, scoped fixes and disposable fixtures; owner
pushes. T-012 implements the FR-002/section 4.1 browser criteria in SPEC.md.
The schema panel remains a separate milestone follow-up; SQL editor, sort/filter
and cell details retain their later-task scope. No dependency is added.

- `SqliteSession` owns a `SqliteBrowser` on the existing supervised Engine.
  Typed browser messages in `src/protocol.ts` validate IDs, dimensions, dense
  arrays, NULL/string cells and exact decimal counts. The host serializes work,
  retains at most one superseding request and drops stale replies on disposal.
- The table/view catalog selects only kind/name from `main.sqlite_schema` in
  100-object pages. It deliberately excludes CREATE SQL so a large default or
  view definition cannot prevent listing otherwise small names. The T-011 full
  schema metadata API is unchanged. Rows use `Engine.page`; explicit counts use
  quoted identifiers and a one-row COUNT query. Both execute in the worker.
- The production bundle is separate from the T-008 spike. The webview keeps one
  page of 100 rows by default (choices 100/10/1), virtualizes visible rows and
  columns, uses textContent/VS Code theme variables and nonce-protected local
  assets. NULL/empty markers are styled/labeled separately; strings including
  exact int64/REAL/date values and size-only BLOB placeholders stay unchanged.
- Counting has visible loading and Cancel; cancellation reuses Engine recovery.
  Closing releases queued work, listeners, animation frames and current rows.
  VS Code getState/setState retain only IDs, selection, offsets and page size,
  verified against the installed 1.140.0 webview implementation. Hidden contexts
  may be destroyed; recreating one refetches the saved page with continuing IDs,
  including a second hide while restoring. No rows or counts are persisted.
- `scripts/browser-fixture.mts <new-directory> [--large]` generates disposable
  fidelity/paging/empty/view/1-MiB/wide/slow-count fixtures and 102 extra objects.
  Exclusive file creation refuses overwriting an existing database. `--large`
  adds a ten-million-row table. Integration generation is a separate process;
  generated files are not packaged or committed.
- Actual VSIX-file selection is tested with the production whitelist and built
  browser assets in a small staging directory. The full gate packages the real
  project. Both `sqlite-browser.js` and `sqlite-browser.css` are shipped.
- Unit file concurrency is bounded to two workers: suites launch additional
  Engine and nested Vitest processes. This addresses a reproduced nested-runner
  startup deadline failure under the enlarged task suite without changing any
  test, workload, deadline or diagnostic rule. Packaging selection tests use a
  small staging directory to avoid scanning cached VS Code installs/profiles.

Measurement/validation evidence and precise remaining limitations are recorded
in VALIDATION.md. A warm generated 135,122,944-byte/ten-million-row primary table
has been exercised in the real custom editor; this does not establish cold-disk,
multi-GB memory, physical first-paint or full milestone readiness.

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

- One SQLite `customEditors` entry with `selector: [{ "filenamePattern": "**/*" }]`
  and `priority: "option"`, so Reopen Editor With offers it for any saved local
  filename. Contribute `workbench.editorAssociations` defaults for `*.db`,
  `*.sqlite`, `*.sqlite3` and `*.db3`; explicit user associations take precedence.
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
- v0.4 T-012 browser (2026-10-10): Document owner-authorized production browsing, lazy exact counts, bounded two-dimensional rendering, narrow catalog projection, tab-state recovery and disposable fixtures. Preserve existing Engine contracts, no-new-dependency policy and later milestone QA/performance scope.
- v0.4 T-011 metadata (2026-10-10): Owner authorizes paged worker-side column/index operations on the existing Engine and protocol; document exact declared metadata, parameter binding, implicit/expression indexes and actionable bounded-page failures. UI remains T-012.
- v0.4 T-010 picker repair (2026-10-10): Replace extension-limited default registration with one optional all-filename selector and four contributed editor defaults. This preserves default SQLite opening while making Reopen Editor With available for other filenames; user associations retain precedence.
- v0.4 T-009 read safety (2026-10-10): Red-first regression rejects EXPLAIN PRAGMA before preparing it; SQLite preparation-time PRAGMAs can otherwise change read-only/trusted-schema flags. Query plans remain available for SELECT/WITH.
- v0.4 T-009 architecture (2026-10-10): Owner-authorized public Engine/helper supervision and native/sql.js backends; documented pre-editor consent UI, threshold, snapshot safety, bounded pages and offset tradeoff. No new dependency or production performance claim.
- v0.4 T-052 completion (2026-10-10): Verified final fixture-candidate run 37962951570/attempt 1/6b2d665 on all three platforms; completed foundation scope and the local v0.0.1 checkpoint with all later production targets retained.
- v0.4 T-052 fixture follow-up (2026-10-10): Recorded verified green run 37961300752/d18e5e6 and the subsequent local large-header test timeout; preserve its acceptance with fewer tiny reads and require fresh fixture-candidate gate evidence.
- v0.4 T-052 review/local gate (2026-10-10): Recorded repaired quote-fidelity and crash-recovery findings, post-fix independent review and passing full local evidence; new three-platform candidate evidence remains required.
- v0.4 T-052 feasibility decision (2026-10-10): Recorded delegated D-2 positioning and accepted R-1 mitigation, reconciled existing foundation manual/measurement evidence and retained all unproven production targets.
- v0.4 T-007 repair completion (2026-10-10): Recorded independently checked run 37956761308/attempt 1/f3d82bb and successful full-verification steps on all three platforms; the repair is complete, while the foundation milestone remains open.
- v0.4 T-007 local validation (2026-10-10): Final full verification passes with 197 unit/eight integration tests and one explicitly reported approved host diagnostic; fixture is excluded from the VSIX. Fresh three-platform CI remains pending.
- v0.4 T-007 host diagnostic policy: Owner approved exact renderer-only signed-out cloud lookup and chat language-model schema timing diagnostics, reported individually; original CI warning causes and all other errors/warnings still fail.
- v0.4 T-007 CI repair: Owner authorized a signed-out authentication fixture and preinitialized empty manifest for isolated integration hosts, plus less disk-intensive responsiveness-test batching. Runtime warning rejection remains strict; validation evidence is pending.
- v0.4 T-050 completion (2026-10-09): Restored D-4 with approved scope and acceptance criteria; documented all locked licenses, resolved missing/custom declarations, captured a clean audit and official SheetJS guidance. Three red-first checks verify inventory and production notice coverage; verify passes with 179 tests and zero errors/warnings. No dependency or fixture change; owner pushes.
- v0.4 T-008 completion (2026-10-09): Recorded task commit 8fed6f0 and owner push report; all spike acceptance criteria pass. T-008 is checked; no foundation gate or production performance claim.
- v0.4 T-008 owner QA (2026-10-09): Recorded all manual checks passing in VS Code 1.141.0, 512 cached / about 20–23 rendered rows, and the decision to keep CodeMirror 6. Task checkbox awaits the owner commit; the foundation gate remains open.
- v0.4 T-008 implementation (2026-10-09): Recorded approved CodeMirror dependencies, synthetic bounded paging/rendering, scroll-height mapping, CSP/lifecycle tests and manual handoff. CodeMirror is provisional; owner smoothness/editor evidence remains pending.
- v0.4 T-004 completion (2026-10-09): Recorded passing owner verification and the 10-million-row benchmark at 7d9cf25 (145.4 s import, 223.0 MB standalone RSS, 27.2 ms parsed preview). T-004 is complete; production NFR-003/NFR-004 targets and the foundation milestone remain open.
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
