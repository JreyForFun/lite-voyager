# T-023: JSON / JSONL import

Owner authorizes full implementation, necessary fixes, fixture changes and assistant
visual QA on 2026-10-16; owner retains push and actual-candidate CI.

Current handoff (2026-10-17): [Windows CI repair](t023-windows-ci.md) records
run 38857662893 at dfab68e: Ubuntu/macOS jobs pass, Windows fails the 5-GB CSV
preview at 2005.2729 ms. Repaired standalone passes 790 units; the exact 5-GB
preview diagnostic passes at 995.4049 ms. A separate local full build-hook
timeout and host 127.3266-ms responsiveness failure remain failed. All original
guards remain intact; no unchanged gate is retried. Original slow-stage causes
remain unproven. T-023 stays unchecked pending clean repaired actual-candidate CI.
Historical implementation/777-unit/65-host evidence is retained below.

Use Command Palette → **Lite Voyager: Import JSON / JSONL**, select a saved
local UTF-8 file, review its preview, then choose **Import table**. SQL becomes
available after the complete import succeeds. **Retry preview** rereads a corrected
source. **Cancel import** stops the worker. Imported storage is temporary until
**Save as SQLite**; closing the tab removes it. Default text associations are unchanged.

## Acceptance (FR-005)

- A separate Import JSON / JSONL command opens a bounded, read-only preview, then
  imports in a supervised worker into the existing private SQLite storage. JSON
  requires one top-level array of objects; JSONL requires one object per nonblank
  LF/CRLF line. A leading UTF-8 BOM is accepted. Blank JSONL lines are ignored.
- Stream 64-KiB UTF-8 reads with fatal decoding. Hold only the current record,
  schema and bounded batches; never load an entire array/file. Preview stops at
  100 complete records, 1,000 columns, 2 Mi UTF-16 units or a 4-Mi-unit record,
  explaining a boundary without truncating cells. Full native imports have no
  preview/file cap; a record must fit the runtime and SQLite's actual limits.
- Columns are the union of keys in first-seen order, including late keys.
  Missing keys and JSON null become SQL NULL; empty text and literal NULL remain
  text. Empty arrays / empty JSONL produce an empty database. Keyless objects
  remain rows; an entirely keyless input uses a generated __json_object column
  containing {}. Blank/NUL keys and SQLite case collisions receive deterministic
  unique display names with an explanation. Duplicate keys within an object at
  any depth are rejected rather than silently selecting a value.
- Preserve scalar types per cell using columns with no coercing affinity.
  Booleans become INTEGER 1/0. Canonical signed-int64 literals become INTEGER
  using SQL casts from parameter strings. Other number spellings remain exact
  TEXT unless a finite REAL round-trips to the same spelling; out-of-range,
  underflowing, overflowing and noncanonical numbers remain TEXT. Never route
  int64 values through a JavaScript number. Strings decode JSON escapes.
- Nested arrays/objects are original validated JSON text, preserving numeric
  lexemes and whitespace, queryable with json_extract(). SQLite JSON numeric
  arithmetic has its own limits; stored text is authoritative. No flattening.
- Invalid UTF-8, unpaired Unicode surrogates (not representable as exact SQLite
  UTF-8 text), malformed/truncated JSON, unsupported shapes and real storage
  limits fail visibly without publishing a partial table. Retrying a valid file
  succeeds. Diagnostics contain location/guidance, not source record contents.
- Progress reports bytes/rows; cancel/close kills and awaits the helper before
  removing owned partial files. Source identity/change checks and fallback
  20,000,000-source /64,000,000-SQLite-byte caps match CSV. Preview explains those
  caps before import. Reuse disk preflight, orphan cleanup and Save as SQLite.
- Unit and real-host tests cover both engines, exact values, late/hostile keys,
  nested SQL, empty/invalid input, >1-MB values, 1,000 columns, source safety,
  cancellation/recovery, bounded preview, UI controls and packaging. A populated
  streaming stress workload checks primary memory and host responsiveness;
  report measured workload/limits separately from cross-platform evidence.
- Run npm run verify with zero errors/warnings and verify:full under the existing
  exact diagnostic policy; preserve every failure. Inspect light/dark/narrow
  actual UI and keyboard controls. Owner runs new-code three-platform CI.

## Design

No dependency or lockfile changes. A built-in-only incremental framing reader
extracts one JSON object at a time. An iterative lossless tokenizer validates
grammar/duplicate keys and extracts top-level value spans; JSON.parse is used
only for string tokens. Numeric tokens never pass through JSON.parse.

Reuse the existing killable import client/helper/relay by adding an explicit
internal format discriminator, and share the import database adapter. JSON uses
a dedicated import/preview worker and the existing session/UI with JSON-specific
controls/help. CSV behavior and default file associations remain unchanged.

## Evidence

CI budget decision (2026-10-16): the full expanded local run exceeds the old
20-minute outer CI job timeout. Give the job 60 minutes for the added sequential
ten-million-row and four populated JSON/JSONL size workloads. This changes only
the aggregate job budget, not any individual test timeout, 500-MB cap, 50-MB
growth guard, 100-ms responsiveness bound, fixture count, diagnostic policy or
source-safety assertion. Keep full verification on every platform and fail on
every unapproved warning/error. Add a failing CI contract test before the change.

Tests-first records:

- Initial sandbox reader invocation fails before tests with spawn EPERM. Normal
  process access reaches the expected missing json-records module failure.
- Reader implementation passes all 28 initial cases. Import acceptance starts
  with the missing json-loader module. The first reader/import run passes 39/40;
  the new 1,000-column test incorrectly assumes schema metadata is unpaged.
  Query SQLite's exact column count instead; all 40 then pass.
- Two new JSON UI/session tests fail before wiring: CSV-only preview validation
  rejects JSON and Retry sends no empty JSON options. Wiring repairs both.
  Focused parser/import/session/view coverage passes 55 tests across four files.
- Fixture tests fail twice with the missing generator, then pass for populated
  JSON and JSONL. Actual-whitelist package tests pass with both JSON workers.
- Strict checks initially expose closure narrowing, a CSV-specific integration
  access after introducing a preview union, an excess property in a typed mock,
  and a TS7022 inference issue in the new stress test. Correct the types rather
  than suppressing diagnostics. Initial lint catches an implicitly any empty Map;
  specify Map<string, JsonCell>. No any or lint suppression is introduced.
- First focused real-host run (integration-profile-ElgmZp): cancellation/recovery
  passes; both engine cases fail because new paging assertions inspect the DOM
  before rows render. Require rendered rows and the expected exact value.
  Renderer log error `20261016T114657/window1/renderer.log:39`: `2 tests failed.`
  Approved warnings: line 1, VSCODE-HOST-005, `Creation of workbench contribution
  'workbench.contrib.remoteStatusIndicator' took 92ms.`; line 11,
  VSCODE-HOST-001, `[CloudSandboxApi] No 'github' session with scopes [read:user,
  user:email, repo, workflow]`. All severities are warning except the test error.
- Second focused host (integration-profile-PkC0jh): cancellation/recovery passes;
  both engines reach exact nested SQL results but fail a new assertion expecting
  empty text instead of the grid's deliberate `(empty)` display. Preserve this
  failure and check the accessibility label too. Renderer error at
  `20261016T114920/window1/renderer.log:70`: `2 tests failed.` Approved warning
  at line 10, VSCODE-HOST-001, exact signed-out message above. Neither run passes.

Visual method/limits: the native Computer Use pipe fails twice with os error 2;
the browser inventory is empty and Chrome/IAB bindings are unavailable. Inspect
rendered production HTML and JS with synthetic data using disposable headless
Chromium profiles, without the user's browser/profile. This is component layout
QA, not physical/native VS Code/picker observation. Four initial screenshots
show exact values, safe literal markup, light/dark and progress rendering. The
narrow error image exposes stale inner-preview loading text and Cancel preview;
repair it test-first. Repeated long help also needs a scoped readability cleanup.

Further red-first repairs and review:

- The first full standalone gate passes 752 tests /74 files (306.46 s), strict
  types/lint/build and 31-file /693.61-KB packaging, zero errors/warnings.
  Subsequent tests and repairs mean this is intermediate-candidate evidence.
- Four new failures reproduce stale preview loading/error state, an invalid
  zero-column keyless preview, missing fallback source-cap recheck after source
  growth during WASM initialization, and sql.js NUL-truncated insertion. Both
  engines also fail the added NUL preview check because the CSV-specific transport
  guard forbids NUL cells. Preserve these failures. Fix JSON-specific validation
  without changing CSV validation; bind embedded-NUL UTF-8 bytes using sql.js'
  public BLOB binding and CAST the parameter to TEXT. The installed sql-wasm-debug
  source confirms bindString uses -1 (NUL-terminated) and bindBlob uses array.length.
  Native parameter handling already preserves complete strings.
- A keyless preview followed by an oversized record reproduces a lost budget
  explanation. Preserve the boundary before appending keyless-object guidance.
  New JSON record / physical JSONL line diagnostics also start red, then pass.
- Fresh-context read-only review follows the review-bugbot workflow using the
  available reviewer agent; a dedicated vendor Bugbot service is not exposed.
  It finds a P1 HTML replacement-order defect introduced during visual cleanup:
  hiding preview Cancel first prevents the import-controls insertion anchor
  matching. The third focused host (integration-profile-0t2WB5) fails all three
  cases on DOM deadlines; a new static-shell test also fails with import-delimiter
  absent. Insert import controls before hiding the redundant preview Cancel.
  Exact renderer error `20261016T115923/window1/renderer.log:39`: `3 tests failed.`
  Approved warning at line 10, VSCODE-HOST-001, same exact message above.
- Reviewed-repair focused suite passes 53 tests /five files. The independent
  follow-up finds no remaining concrete source defect, and generates repaired
  HTML in memory to confirm all controls. Reviewer changes no files. Its esbuild
  diagnostic hits sandbox spawn EPERM; its TypeScript diagnostic passes. It does
  not claim broad tests, stress runs or cross-platform evidence.
- Deterministic grammar audit compares 10,000 generated valid/mutated cases with
  native JSON parsing. Its first mismatch is an intentionally invalid unpaired
  surrogate accepted by native JSON; explicitly account for the already-specified
  stricter Unicode/duplicate-key policies, then all comparisons pass. This is
  supporting evidence, not a substitute for requirement tests.

Final focused host (integration-profile-NxtcdF) passes all three tests: both
formats on both engines, 250 exact rows, DOM controls/paging, nested SQL, visible
empty-string label, source safety, complete SQLite save, cancellation/recovery.
First-DOM measurements (native JSON/JSONL, fallback JSON/JSONL): 626.1653,
185.2278, 213.5544, 221.1813 ms. These are warm DOM observations, not physical
paint. Its only diagnostic is severity warning, VSCODE-HOST-001, source
`20261016T120227/window1/renderer.log:10`, exact signed-out message above.
The focused host run is not warning-free.

The first canonical full run is retained in `out/t023-full.log`, profile
`integration-profile-HP4Am8`. It passes 760 units /75 files (298.42 s), strict
types/lint/build and 31-file /693.77-KB packaging. The running host suite reports
new volume/stress failures; detailed Mocha assertions are deferred until its
end. No passing full result is claimed. Investigate the new harness's initial
editor-ready predicate, which can precede a rendered table page, against the
actual failure details. Remaining host checks continue; no retries or threshold
changes have occurred. The outer PowerShell log capture formats npm's normal
notice stream as NativeCommandError records; internal verification still runs
its unchanged fatal diagnostic checks. Preserve the original transcript.

Full-run final result: 63 hosts pass, two fail; the run takes 25 minutes in the
host phase. Both new stress cases time out at SQL, not during parser/import
assertions: `T-023 ten-million-row SQL deadline.` and `JSON full-data SQL deadline;
phase=opened; busy=false`. This is consistent with the early editor-ready report
preceding initial table loading, when a DOM Run click can still be disabled.
The prior missing-click cause is an inference, not a captured input trace.
Require an idle, rendered 100-row Browse page before SQL and again before Run;
keep all full-data assertions and the original 120-second SQL deadlines. The new
readiness-unit suite starts red with the helper absent, then passes. Richer timeout
summaries contain only state/metrics, not fixture record contents.

The failed full host has one approved warning: VSCODE-HOST-001, severity warning,
`20261016T121109/window1/renderer.log:10`, exact signed-out message above. Its
renderer error at line 179 is `2 tests failed.` and correctly fails strict scanning.
Existing 1/5-GB SQLite peaks are 241,819,648 /231,813,120 bytes; CSV peaks are
330,711,040 /331,956,224 bytes, paging growth 31,776,768 /34,410,496 bytes and
host timer gaps 45.1154 /60.0439 ms. All original data/hash/paging guards pass.
This does not turn the failed full run into a pass or establish JSON stress data.

The new CI-budget contract starts red at the old 20-minute aggregate job budget.
Changing only that job budget to 60 makes it pass. Reviewed-repair coverage then
passes 39 focused units across four files, including readiness, forced helper death
and retry on both formats/engines, curated fixtures, late keys after a commit,
int64 json_extract and fallback wide rows. Independent read-only follow-up finds
no concrete defect or weakened gate; it runs no workloads. Fresh canonical
standalone/full evidence for the repaired harness is pending. No application
production code changes accompany this harness/CI repair.

Final light and narrow-error production-component captures are inspected; controls
remain present and the stale inner loading/Cancel state is gone. Error guidance
wraps and Retry stays available. This remains isolated component rendering with
synthetic states, not native picker or physical VS Code screenshots. Final dark
and progress captures also pass layout inspection. Full/stress gates are pending.
T-023 remains unchecked. No old failure, diagnostic
or policy is discarded.

## Acceptance-to-test coverage and commands

The repaired candidate's standalone `npm run verify` passes all 777 units across
77 files (343.96 seconds), strict type checks, lint, production builds and the
31-file /693.9-KB VSIX check, with zero errors and zero warnings. Evidence is
retained in `out/t023-final-verify.log`. The fresh canonical full run is retained
separately in `out/t023-repaired-full.log`: 776/777 units pass, but the unchanged
T-015 native export cancellation/crash/close cleanup test at
`test/unit/export-engine.test.ts:57` hits its 30,000-ms timeout. This is a failed
full gate (799.96-second unit phase), with no new host phase. During that run,
one requested 30-second agent wait returns after 517.3595 seconds. That timing
interruption does not establish the timeout's cause; the cause remains unproven.
The same test passes in the complete standalone run. Do not weaken its timeout
or retry the unchanged full gate to replace this failure. Continue the remaining
repaired host acceptance separately and report it only as host evidence.

Separate repaired host run (`out/t023-repaired-host.log`): all three
JSON functional cases pass on both engines/formats. First populated DOM reports
are 432.5049 /291.6418 ms for native JSON/JSONL and 219.8870 /225.1134 ms for
fallback. Exact 250-row paging, nested SQL, save, malformed-input retry, cancel
and source safety pass. Both ten-million-row aggregates complete (357,432 ms
combined); source SHA-256 values remain
`29761137c9ed03c663959400dd9d4ae2a3854413c77698fa291db8d45b89137f` (JSON)
and `aad0267f3db7eff48b93dc21f43ea2a3f36cca73f632383b31bddf4401c097d2`
(JSONL). The four populated memory workloads also pass (926,274 ms combined):

- JSON: 1,000,016,431 bytes /243,313 rows; peak 296,763,392 bytes; host timer
  maximum 37.8159 ms; 105 observations /94 helper observations; maximum sampling
  gap 987.7760 ms; renderer peak 434,003,968 bytes. Source SHA-256
  `41eacc598a3e38c50ac6f7b7deffb88ea3786126d1da2e954c7c3b9bf9205454`.
- JSON: 5,000,065,711 bytes /1,216,561 rows; peak 293,638,144 bytes; host timer
  maximum 43.4189 ms; 502 observations /450 helper observations; maximum sampling
  gap 1,050.1897 ms; renderer peak 421,810,176 bytes. Source SHA-256
  `3f93be795a091bd8d55247187772c3fbc1f7e8c53e1f9a1139008fd572bb8c37`.
- JSONL: 1,000,012,320 bytes /243,312 rows; peak 296,009,728 bytes; host timer
  maximum 47.0581 ms; 99 observations /88 helper observations; maximum sampling
  gap 973.6947 ms; renderer peak 414,928,896 bytes. Source SHA-256
  `a98cbfd61a4bad6a3004833be21b56d2f05cd45652005cf2925b5cf19df09d76`.
- JSONL: 5,000,061,600 bytes /1,216,560 rows; peak 295,882,752 bytes; host timer
  maximum 46.2397 ms; 468 observations /417 helper observations; maximum sampling
  gap 997.6112 ms; renderer peak 422,096,896 bytes. Source SHA-256
  `fe866f10bc4733086d26e8ef9f2545e49e05b45ae8905462a6a9aded2f5d30d9`.

All four preserve the source hash and check every populated value through SQL.
Peaks include the sampled host and all helpers; renderer is separate. Both
file-size peak differences are below zero and pass the unchanged 50-MB growth
guard. All peaks are below 500 MB, host timers below 100 ms and sampling gaps
below 3,000 ms. Scope is populated 4,095-character TEXT records, native import
and full-data checks, without a physical-paint or repeated-JSON-paging claim.
These passing workloads support the readiness repair. The separate complete
host suite passes all 65 tests in 38 minutes, exit 0, using
`node scripts/integration-check.mts` after successful integration compilation.
Its strict log audit passes with exactly two approved warnings in
`out/integration-profile-eQBiDL/logs/20261016T130538/window1/renderer.log`:

- Line 2, severity warning, VSCODE-HOST-004:
  `Creation of workbench contribution 'workbench.contrib.chatPetContext' took 28ms.`
- Line 11, severity warning, VSCODE-HOST-001:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`

The host run is not warning-free. No other warning/error is accepted. Existing
SQLite 1.28/5.87-GB peaks are 274,513,920 /284,520,448 bytes; paging growth is
8,744,960 /16,592,896 bytes. Existing populated CSV 1/5-GB peaks are
389,124,096 /398,458,880 bytes, paging growth 25,346,048 /35,864,576 bytes,
host timer gaps 43.8913 /45.3913 ms. Both sizes retain all 60 Browse /20 SQL
pages, exact data and source hashes. All original guards pass. These separate
host results do not change either failed canonical full run into a pass.

- `json-records.test.ts`: lossless numbers/strings/nesting, duplicate keys,
  malformed syntax/shapes, 15,000 nesting levels, UTF-8/chunk boundaries, BOM,
  JSONL blank lines, complete-record bounds and record/line error locations.
- `json-import.test.ts` (unit): real native/fallback databases, mixed scalar
  types, int64 extrema, out-of-range number text, nested json_extract, NULL/empty,
  late/hostile keys, source order, empty/keyless data, read-only sources,
  failed late parsing, cancellation/retry, callback failure, existing source/target
  protection, changed source, fallback refusal, 1,000 columns, >1-MB values,
  escaped NUL/BOM/quotes, 16-MiB value/page-refusal/recovery and preview budgets.
- `json-fallback-race.test.ts`: source grows after initial fallback preflight;
  the second cap check must run before any data read.
- `json-recovery.test.ts`: curated valid/invalid JSON fixtures on both engines;
  unexpected helper death, source/partial-file safety and subsequent successful
  import for both formats/engines. Added for final standalone verification after
  the ongoing full run; its unit phase had already completed. No production code
  changes accompany these additional tests or the extra fallback wide-row case.
- `json-import-readiness.test.ts`: initial editor attachment, pending/empty and
  unrendered/query statuses cannot trigger stress SQL before the real Browse page.
- `json-fixture.test.ts`: real populated JSON/JSONL bytes, records, hashes and
  exclusive destination protection. Package/dependency audit tests cover the
  actual two worker bundles and complete shipped notices.
- Shared import panel/view/UI tests: JSON option isolation, controls present,
  typed bounded transport, error/retry status recovery, SQL/save/cleanup lifecycle.
- `src/test/json-import.test.ts`: actual command/webview controls on both engines,
  both formats, exact 250-row paging, nested SQL, empty-string accessibility,
  complete SQLite save, unchanged sources, cancellation and independent recovery.
- `src/test/json-import-memory.test.ts`: ten million rows in each format with
  complete aggregates/source hashes; populated 1/5-GB files per format, full-value
  SQL/hash checks, OS-sampled host/all-helper residency, renderer separately and
  host timers. All five T-023 host cases pass as part of the separately passing
  complete 65-host suite and strict log audit. Canonical full remains failed.

Reproduce units with `npx vitest run test/unit/json-records.test.ts
test/unit/json-import.test.ts test/unit/json-fallback-race.test.ts
test/unit/json-fixture.test.ts`. Canonical commands: `npm run verify` and
`npm run verify:full`. The full command includes all existing CSV/SQLite workloads;
no test, workload, timeout or warning policy is weakened. Owner push and current-
code Windows/macOS/Ubuntu CI remain external to local evidence.

## Complete task file list

Modified:

- `.vscodeignore`, `esbuild.js`, `package.json`, `PROGRESS.md`, `CHANGELOG.md`,
  `.github/workflows/ci.yml`
- `specs/SPEC.md`, `specs/PLAN.md`, `specs/VALIDATION.md`, `specs/TASKS.md`
- `src/editor/csv-import.ts`, `src/editor/csv-import-ui.ts`, `src/extension.ts`
- `src/loaders/csv-import.ts`, `src/loaders/csv-import-client.ts`, `src/protocol.ts`
- `src/worker/csv-import-process.ts`, `src/test/csv-import.test.ts`
- `webview/csv-import.ts`, `webview/csv-preview.ts`
- `test/unit/browser-package.test.ts`, `test/unit/dependency-audit.test.ts`
- `test/unit/ci-workflow.test.ts`
- `test/unit/csv-import-panel.test.ts`, `test/unit/csv-import-ui.test.ts`,
  `test/unit/csv-import-view.test.ts`

Created:

- `docs/t023-json.md`, `scripts/json-memory-fixture.mts`
- `src/loaders/json-columns.ts`, `src/loaders/json-values.ts`,
  `src/loaders/json-records.ts`, `src/loaders/json-preview.ts`,
  `src/loaders/json-import.ts`, `src/loaders/json-loader.ts`
- `src/worker/json-preview-worker.ts`, `src/worker/json-import-worker.ts`
- `src/test/json-import.test.ts`, `src/test/json-import-memory.test.ts`
- `src/test/json-import-readiness.ts`
- `test/unit/json-records.test.ts`, `test/unit/json-import.test.ts`,
  `test/unit/json-fixture.test.ts`, `test/unit/json-fallback-race.test.ts`,
  `test/unit/json-recovery.test.ts`, `test/unit/json-import-readiness.test.ts`

Ignored/generated tools and artifacts under `out/`: `t023-focused.mts`,
`t023-log-audit.mts`, `t023-parser-audit.mts`/`.cjs`, `t023-render.mts`,
`t023-render/` HTML/fixture/screenshots/disposable profiles, `t023-full.log`,
`t023-final-verify.log`, `t023-repaired-full.log`, `t023-repaired-host.log`,
`t023-stage.mts`/docs patch, fresh
integration profiles and disposable stress data. Build/integration outputs are
generated. Existing owner README, T-015 spec changes and untracked fixtures,
debug.log and gingTryWan are preserved and excluded from task staging.
