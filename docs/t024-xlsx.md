# T-024 XLSX import

Owner delegates implementation, fixtures, repairs and visual QA on 2026-10-17;
owner retains push and three-platform CI. Only FR-006 / T-024 is in scope.

## Acceptance (FR-006)

- Given a saved local XLSX, the dedicated Import XLSX command opens a read-only
  bounded preview of its first sheet, then imports every worksheet (including
  hidden and empty sheets) into a separate temporary SQLite table. SQL, paging,
  exports and Save as SQLite reuse the existing browser and storage lifecycle.
  Production Open With/context menu integration remains T-025.
- Given a source above 100,000,000 bytes, before any workbook read (including
  preview), request explicit Proceed consent. Exactly the boundary needs no
  prompt. Cancel, Escape, dismissal, tab disposal or cancellation cannot authorize
  loading. Recheck source identity/size on import and retry; changed sources need
  fresh consent. All sizes retain a persistent explanation that compressed XLSX
  and expanded XML/cells are memory-bound, potentially much larger than disk size.
- Given sheets, retain workbook order, use physical row 1 as headers, generate
  unique names for blank/NUL/ASCII-case-colliding headers and reserved SQLite
  table names, and quote every identifier. Include columns through the last
  actual cell; do not trust undersized dimensions. Preserve interior blank rows
  and cells, but not formatting-only trailing ranges. Empty sheets have one
  documented synthetic `__xlsx_empty` column and zero rows; header-only sheets
  retain their columns and zero rows. Merged cells are not filled or duplicated.
- Given cell values, preserve text (including empty text and literal NULL), map
  missing/stub cells to SQL NULL, booleans to INTEGER 1/0, and Excel error cells
  to their error text. Read cached formula values only, never calculate or execute
  formulas, macros or external links. Missing formula caches become SQL NULL with
  an explicit notice; empty nontext caches are also missing, while an explicitly
  cached empty string (`t="str"` with an empty `v`) remains empty TEXT. Caches may
  be stale. Dates remain original Excel serial
  numbers (or ISO text when stored as dates), avoiding timezone/1900-date coercion.
- Given numeric XML tokens, preserve exact int64 integers as INTEGER through
  decimal-string binding/casts. Tokens outside int64, noncanonical or not safely
  round-trippable remain exact TEXT; finite canonical fractional REAL values may
  use REAL. Never obtain integer precision from SheetJS's rounded Number value.
  Types are per cell; no column affinity coerces mixed text/numbers. Resolve the
  main workbook from its internal package-root officeDocument relationship and
  require agreement with the decoder-selected main part: one supported workbook
  Override, or the supported XML Default with canonical xl/workbook.xml fallback.
  Reject missing, external, duplicate or conflicting declarations.
  Auxiliary parts named workbook.xml must never supply another sheet's values.
  Reject ZIP-part aliases under the pinned decoder's bytewise name decoding,
  CFB root handling, case folding and slash equivalence before decoding.
- Given XLSX limits (1,048,576 rows, 16,384 columns, 32,767 text characters/cell),
  explain them. Refuse unsupported/corrupt/truncated/encrypted input or worksheets
  wider than SQLite's supported column count clearly, publishing no partial DB.
  The pinned reader cannot safely read ZIP64 containers: explain this real codec
  limitation and offer conventional XLSX or streaming CSV conversion; never silently
  ignore ZIP64 entries. Validate ZIP directory bounds, encryption, lengths and
  CRCs before entering the decoder, including native validation of deflate streams.
  XLSX preview budgets are 100 rows, 256 columns and 1 Mi UTF-16 code units
  budget; omit complete rows/preview only with a notice, never truncate cells.
  Full import retains all supported cells beyond preview budgets.
- Given import, perform heavy parsing/insertion in supervised workers/helpers,
  report stage/row progress, keep cancellation available during synchronous ZIP
  parsing, and await helper exit before cleanup. Reuse source-identity checks,
  disk-space preflight, exclusive publication, save protection and fallback
  20,000,000 source-byte /64,000,000 SQLite-byte caps. Preview is also subject to
  the fallback source cap. Failures permit retry and independent sessions survive.
- Given completion, test first (Given/When/Then FR-006 names), verify exact values
  through both real engines, malformed/source-safety/cancel/recovery/wide cases,
  typed transport, consent boundaries and packaging/license inclusion. Run
  `npm run verify` with zero errors/warnings and real-host checks under the
  unchanged diagnostic policy; inspect light/dark/narrow/error/progress visuals.
  Preserve every failed gate and observation limit. No unchanged retry-to-green.

## Design

SheetJS CE is already named in PLAN. Recheck official install/API/advisory docs;
vendor the official tarball with locked integrity and full Apache-2.0 notice.
Use SheetJS for ZIP/workbook/text decoding, with its documented `bookFiles`
option to retain worksheet XML tokens before numeric coercion. Do not call
`sheet_to_html`, formula evaluation or any networking API. No runtime network.
Extend the shared typed import transport only for XLSX preview and sheet counts;
retain existing CSV/JSON behavior and all timing/memory/diagnostic guards.

## Evidence

T-024 remains unchecked until final acceptance and actual-candidate three-platform
CI. The owner retains pushing. No release, tag or whole-milestone closure.

### Coverage and commands

- `test/unit/xlsx-import.test.ts`: real worker/helper imports and real native/
  sql.js queries for curated three-sheet data, int64 extrema/raw exponential
  tokens, mixed text/NULL/error/boolean/formula caches, implicit/sparse addresses,
  reserved/colliding names, hidden/empty/header-only sheets, malformed later data,
  read-only sources, 1,000 columns/32,767-character cells beyond preview budgets,
  bounded preview, fallback source/database caps, source mutation, cancellation,
  existing-target protection and genuine helper-crash recovery.
- `test/unit/xlsx-consent.test.ts` and `xlsx-warning.test.ts`: exact decimal
  boundary, only-Proceed approval, explicit Escape/close Cancel affordance,
  source-bound approval reuse, changed snapshots and pending-dialog cancellation.
- `test/unit/xlsx-xml.test.ts` and `xlsx-zip.test.ts`: malformed XML/ZIP,
  comments/entities, metadata consistency, encryption, ZIP64 explanation, CRCs and
  native deflate output bound. Corruption never manufactures a new value.
- `test/unit/xlsx-parts.test.ts`: auxiliary workbook filename collision, exact
  preview/import through both engines, valid absolute/alternate main targets and
  refusal of missing/external/duplicate/conflicting package declarations,
  including earlier decoder-recognized macro workbook Overrides.
- Shared import panel/view/UI tests: XLSX help/controls, all-sheet summary,
  options isolation, typed malformed transport and a single actionable error.
- Package/license tests: actual VSIX listing, both XLSX workers, full Apache
  notice, exact vendor SHA-256/SHA-512 and complete locked license inventory.
- `src/test/xlsx-import.test.ts`: real VS Code command/DOM controls, both engines,
  exact paging/SQL across sheets, complete SQLite save after closure, source
  byte identity, visible invalid-input error, independent tabs and subsecond
  cancel/cleanup/recovery. Existing larger-format workloads retain their scope.

Commands: `npm test -- test/unit/xlsx-import.test.ts test/unit/xlsx-consent.test.ts
test/unit/xlsx-warning.test.ts test/unit/xlsx-xml.test.ts test/unit/xlsx-zip.test.ts test/unit/xlsx-parts.test.ts`,
`npm run verify`, and `npm run verify:full`. The canonical full suite includes all
XLSX host tests and the unchanged pre-existing suites; no filter is used there.

### Preserved failures and repairs

- Initial test startup is blocked by sandbox child-process `EPERM`; execution
  outside that restriction exposes the expected missing-loader/consent modules.
  The initial download/install is also blocked by restricted networking/npm cache
  permissions; official download then project-local offline installation succeed.
- First loader run: 8 pass /2 fail. The aggregate invalid-input test hits its
  existing five-second deadline; the preview returns 1,000 columns instead of the
  planned XLSX 256. Split malformed fixtures into independent cases with every
  input/assertion and the same per-case deadline; do not increase deadlines.
  The separate 64-byte truncated ZIP case still times out. Inspecting the pinned
  codec shows it continues without an EOCD; native ZIP/CRC/deflate preflight
  repairs the fault. The original aggregate timing cause is not independently
  established. Both failed runs remain failures.
- Failing-first UI tests expose the old first-table-only summary, missing XLSX
  shell/warning helper and leaking CSV controls. Strict types initially fail on
  nullable XML matches; lint finds two test callbacks lacking awaits. Repair
  types/callbacks directly, with no assertions, types or lint rules disabled.
- Regressions expose implicit-address off-by-one and an unanswered memory dialog
  preventing cancellation. Correct the row origin and race consent against abort;
  late approval cannot revive a session. Focused suite passes 53 tests /10 files
  (46.84 s), before subsequent review/visual refinements.
- First real-host invocation (`out/t024-host.log`) fails all three XLSX cases.
  Worker-only diagnostics succeed in Node 26.5.0 and the bundled Node 24.21.0.
  Two temporary runner configurations select zero diagnostic files; these are
  not acceptance passes. Correct absolute file selection reveals the actual
  source-change error. A new lower-case-drive URI regression fails first, then
  drive-letter-only normalization repairs Windows spelling while retaining all
  device/inode/size/timestamp and remaining canonical-path checks.
- Repaired focused loader/consent: 20 pass /2 files (25.19 s).
  Repaired host invocation (`out/t024-host-repaired.log`) passes all three cases
  (17 s). Its only accepted diagnostic is `VSCODE-HOST-001`, original severity
  `warning`, source `20261017T185801/window1/renderer.log:9`, exact message
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  This scoped run is not warning-free and predates final review/visual repairs.

### Independent review

Use the review-bugbot workflow with one fresh-context available reviewer agent;
a dedicated vendor Bugbot service is not exposed. The read-only review finds:
outside-int64 exponential integers classified as REAL, duplicate `v` elements
joined, malformed shared strings accepted, type-sensitive empty-cache/notice
inconsistency and unbounded corrupt deflate expansion beyond declared size.
All eight reproducing assertions fail first (19 others pass), retained in
`out/t024-review-red.log`. Repairs preserve numeric TEXT, refuse duplicate XML
values/formulas, validate every XML/rels part, distinguish empty cached strings
from missing nontext caches and bound native inflation by the entry's actual
declared length (minimum 1 for supported empty entries, no valid-file size cap).

Repaired focused suite passes 31 tests /5 files (32.93 s). Independent read-only
follow-up confirms all five original findings resolved, tests compressed empty
entries and reports no concrete new defect in those repairs. It does not claim
full gates, visual QA or other-platform execution. Review diagnostics initially
hit sandbox `EPERM`; in-memory transpilation provides disposable reproductions.
No tracked file is edited by the reviewer and no failed gate is retried unchanged.

### Main-workbook relationship repair

During the first canonical full run, a further review confirms that selecting
an XML part by basename can read an auxiliary workbook's raw numbers while
SheetJS decodes the real workbook. The direct regression fails with
9007199254740995 instead of 9007199254740993 (`out/t024-parts-red.log`).
Expanded direct declarations coverage fails six assertions before repair
(`out/t024-parts-all-red.log`); two worker cases are filtered only to preserve
that running build, not used as acceptance passes. Resolve the root internal
officeDocument relationship and require its actual ZIP key to match exactly
one decoder-recognized main Override of supported XLSX type. The pinned decoder
also recognizes XLSM/XLSB/XLAM/XLTX, all counted to prevent competing text sources.
Direct repaired coverage passes eight tests, including absolute and alternate
main locations (`out/t024-parts-direct-final.log`). Production-worker cases and final canonical gates remain pending at this point.
The earlier full run is retained as pre-locator evidence, not final fix coverage.

Follow-up review reproduces a second decoder-agreement defect: an earlier
case-colliding worksheet makes SheetJS text come from one part and exact raw
numbers from another. Four direct alias assertions fail first
(`out/t024-part-alias-valid-red.log`, 2 existing tests pass). The earlier
`out/t024-part-alias-red.log` also retains an incorrectly escaped backslash
fixture; correct that test literal before the valid red run. Refuse duplicate
parts under the pinned decoder's bytewise Latin-1 filename decoding, default
CFB root handling, case folding and slash direction. All six ZIP tests and nine
direct part tests then pass. Full focused worker/preflight coverage then passes
19 tests /2 files (6.91 s, out/t024-parts-workers-final.log), including both-engine
exact imports and both-engine preview/import refusal without publication.
Independent read-only follow-up confirms the original mixed-data reproduction
and all four aliases are rejected, with no concrete remaining targeted finding.

A subsequent standalone verify exposes two curated-workbook failures: its valid
main MIME type is declared by XML Default, without a main Override. Preserve that
run (`out/t024-verify-final.log`) and a minimal failed positive assertion
(`out/t024-default-type-red.log`). Allow the pinned decoder's canonical
xl/workbook.xml fallback only when no recognized workbook Override exists, the
single XML Default is supported XLSX main type and the root relation agrees.
A Default pointing at the auxiliary main remains rejected. Eleven direct tests
then pass (`out/t024-default-type-direct-repaired.log`); the independent reviewer also loads all three curated sheets. The next focused
run passes 46 tests but times out the curated sql.js case at the unchanged
five-second limit (47 tests /3 files, 82.80 s; out/t024-compatibility-repaired.log).
No causal stack is captured for that timeout. Keep it failed; no deadline changes.

### Full-gate failure retained

The first unfiltered `npm run verify:full` (`out/t024-full.log`) exits 1:
829 units /83 files, types/lint/build/package pass, then 67 host cases pass and
one fails after 37 minutes. All three XLSX host cases pass on that earlier build.
The failing T-021 populated 1/5-GB CSV case completes its 5-GB import but records
extension-host import timer gap 1720.1403000000864 ms, exceeding the unchanged
100-ms limit. Five-GB data SQL, repeated paging, final hashes and memory comparison
are not reached, so that case does not pass. One-GB CSV and all four populated
JSON/JSONL memory workloads pass; none overrides this failure.

Raw retained profile: out/integration-profile-6r0vXA. Its renderer warning is
`20261017T192958/window1/renderer.log:10`, original severity `warning`,
`VSCODE-HOST-001`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Renderer line 188 is an error, `1 test failed.`, matching the actual Mocha failure.
The canonical runtime-log checker is not reached after the test process failure.
The full run is not warning-free or green. Existing logs contain no causal stack,
CPU trace or GC timing for the timer stall; its cause is unknown. Preserve every
threshold and do not retry this unchanged gate for a green result. A separately
profiled, filtered CSV workload is diagnostic only and cannot replace this gate.

### Timing diagnostics (not acceptance replacements)

One filtered CSV diagnostic preserves every assertion, adding CPU/GC tracing only
to ignored compiled test output. Both workloads complete (1/5-GB combined peaks
405,561,344 /435,539,968 bytes; maximum host timer gaps 51.221 /42.5102 ms),
including exact full-data SQL, source hashes and 60 Browse /20 SQL pages. This
non-reproduction does not repair or supersede the canonical failure. The run
itself exits 1: profile export incorrectly resolves from VS Code's working
directory into .vscode-test/.../out and fails ENOENT. No CPU profile is retained.
Preserve out/t024-csv-diagnostic.log. Restore the compiled CSV test byte-for-byte
from its saved original and remove the disposable native-QA test afterward.
No tracked test or production timing limit changes.

Later read-only system samples see 615,768–858,944 KB free physical memory on a
16,083,528-KB machine. At 2026-10-17 20:22:28 Manila, available memory is 1,099 MB,
committed memory 93%, with 3,493 pages input/sec and 537 page reads/sec. These
samples occur after the failures and do not establish their cause. No unrelated
app is closed. A disposable fallback stage diagnostic later completes the same
fixture checks in 1438.8879 ms (maximum main-loop gap 32.8314 ms): preview 375.15,
import 607.18, open 380.99 ms, remaining queries/close/cleanup small. Its initial
scratch CJS build rejects top-level await, followed by a missing-output-module
error; an async wrapper fixes only that diagnostic. Raw logs remain in out/.
This diagnostic also cannot replace the timed-out Vitest case.

### Delegated visual QA

The session exposes no `node_repl` Computer Use entry point, so native Windows
app/picker automation is unavailable. Render actual production HTML/JS/CSS in
four disposable local Chromium profiles, with mocked VS Code message transport
and explicit test-only theme variables/CSP relaxation in generated HTML only.
This is component layout QA, not physical VS Code/native-dialog observation.

Initial screenshots expose duplicated long help and duplicate error text. A new
duplicate-error assertion fails first. Preserve the persistent memory explanation,
place detailed value/limit help in semantic expandable `details`, shorten preview
status and clear the redundant inner error. Shared UI regressions then pass
24 tests /3 files (3.50 s). CSV/JSON behavior remains covered.

Rebuild and inspect all four refreshed screenshots in `out/t024-render/`:
light and dark preview show exact unsafe integers, distinct missing/empty/text
NULL, readable contrast and the all-sheet Import workbook control; narrow
480-pixel error shows one wrapped actionable message and reachable retry;
fallback-progress retains the visible preview and enabled cancellation while
import/refresh are disabled. Render logs contain only screenshot byte reports.
Native picker/modal appearance, physical typing/scroll feel, macOS and Linux
visuals remain unobserved. Automated dialog/DOM/keyboard tests are separate evidence.

On 2026-10-18 the session exposes the newer node_repl Computer Use runtime.
Read the complete skill/guidance/API/confirmation policy, initialize @oai/sky,
and open a disposable isolated host on the real curated XLSX preview. Two binding
attempts, with refreshed returned app/window selection between them, both fail:
`window id 1246556 no longer belongs to Microsoft.VisualStudioCode; current owner is Microsoft.VisualStudioCode`.
Follow the skill's retry-once recovery limit, issue no native inputs, signal the
harness to close, and delete only its ignored compiled test. The harness's
one passing hold case proves setup/cleanup only, not visual QA. Its exact
approved warning is 20261017T235910/window1/renderer.log:9, severity warning,
VSCODE-HOST-001, message `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Native appearance and physical interaction remain unobserved; the four component
screenshots above retain their stated scope.

### Dependency evidence

Official SheetJS CE 0.20.3 Apache-2.0 tarball is vendored with an exact lock and
complete notice. [Provenance](../vendor/README.md), [current license inventory](../specs/dependency-licenses.json)
and [raw approved audit result](t024-dependency-audit.json) are retained.
The initial npm audit is rejected by automatic review for dependency metadata
transmission; the owner explicitly approves that payload/destination in response
to the audit question. Subsequent npm 12.2.0 /Node 26.5.0 registry.npmjs.org audit
exits 0, empty stderr, zero reported vulnerabilities. Registry auditing of a local
tarball has limits; the dated official advisory review supplements it.

### Final gates / handoff status

Historical standalone verify passes 829 units /83 files (369.95 s for units),
types/lint/build and a 34-file /978.25-KB VSIX with zero errors/warnings before the
later part-selection repairs. The first full gate then fails the CSV timer check
above. A subsequent standalone runs 848 tests: 846 pass /2 curated-XLSX failures
(303.72 s), exposing the Default-type compatibility bug. That bug is repaired,
but its next focused run has the separate sql.js five-second timeout above.
Neither failed gate is erased or relabelled green.

Current real-host XLSX verification (out/t024-host-final.log) passes all three
cases in 15 seconds on both engines after every source repair. Its only accepted
diagnostic is source 20261018T000010/window1/renderer.log:9, severity warning,
VSCODE-HOST-001, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This scoped run is not warning-free and is not an unfiltered full gate.
Current strict host/webview/tooling types and zero-warning lint pass (exit 0).
On 2026-10-18 the owner explicitly answers the question requesting exactly one
unchanged final npm run verify, delegating implementation/repairs/fixtures/QA again.
That single run passes (out/t024-verify-owner-approved.log): 848 tests /84 files,
367.92 s for units, strict types, lint, production build and 34-file /979.24-KB
VSIX; exit 0 with zero errors and warnings. No test or deadline changes follow
the earlier timing failures. Preserve every earlier failure and unknown cause;
this is the explicitly authorized one-run exception, not a claimed causal repair.
Actual-candidate three-platform CI remains
owner-triggered. T-024 stays unchecked; no phase closure, release or tag.
Local packaging uses the owner's working-tree README; its unrelated edits remain
excluded from the T-024 commit scope. Prepare only the 46 listed task files for
a local checkpoint; owner retains push and CI.

## Files created or changed for T-024

- `.vscodeignore`, `esbuild.js`, `package.json`, `package-lock.json`.
- `src/editor/csv-import.ts`, `src/editor/csv-import-ui.ts`,
  `src/editor/xlsx-warning.ts`, `src/extension.ts`, `src/protocol.ts`.
- `src/loaders/csv-import.ts`, `src/loaders/csv-import-client.ts`,
  `src/loaders/xlsx-book.ts`, `src/loaders/xlsx-consent.ts`,
  `src/loaders/xlsx-import.ts`, `src/loaders/xlsx-loader.ts`,
  `src/loaders/xlsx-preview.ts`, `src/loaders/xlsx-xml.ts`,
  `src/loaders/xlsx-zip.ts`.
- `src/worker/csv-import-process.ts`, `src/worker/xlsx-import-worker.ts`,
  `src/worker/xlsx-preview-worker.ts`, `webview/csv-import.ts`.
- `src/test/xlsx-fixture.ts`, `src/test/xlsx-import.test.ts`.
- `test/unit/xlsx-consent.test.ts`, `test/unit/xlsx-import.test.ts`,
  `test/unit/xlsx-warning.test.ts`, `test/unit/xlsx-xml.test.ts`,
  `test/unit/xlsx-zip.test.ts`, `test/unit/xlsx-parts.test.ts`,
  `test/unit/browser-package.test.ts`,
  `test/unit/csv-import-panel.test.ts`, `test/unit/csv-import-ui.test.ts`,
  `test/unit/csv-import-view.test.ts`, `test/unit/dependency-audit.test.ts`.
- `vendor/README.md`, `vendor/xlsx-0.20.3.tgz`,
  `specs/dependency-licenses.json`, `specs/DEPENDENCIES.md`.
- Scoped additions to `specs/SPEC.md`, `specs/PLAN.md`, `specs/VALIDATION.md`,
  `specs/TASKS.md`; `docs/t024-xlsx.md`, `docs/t024-dependency-audit.json`,
  and `PROGRESS.md`.

Existing owner README/T-015 edits, debug.log, gingTryWan and unrelated
untracked fixtures are excluded. Disposable diagnostics/screenshots/logs in
ignored `out/` are local QA artifacts; no committed curated fixture is modified.
