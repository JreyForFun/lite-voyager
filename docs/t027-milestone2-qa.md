# T-027 Milestone 2 QA and independent review

Owner authorization: 2026-10-24, Asia/Manila. The assistant owns local QA, visual
inspection, independent review, fixtures and necessary test-first repairs. The
owner pushes and supplies actual-candidate CI. Release/tag/publishing and later
features remain separate. T-027 stays unchecked until its CI evidence passes.

## Local results and remaining gate

CI follow-up (2026-10-25): run 40055575496/attempt 1 at exact 176b184 fails
Windows (JSONL startup timer plus WidgetHost error) and macOS (40 GPU mailbox
errors); Ubuntu passes. Historical local results below remain valid for 176b184.
Current diagnostic candidate and preserved failures:
[T-027 CI investigation](t027-ci-investigation.md). No CI repair/closure claim.

- Canonical `npm run verify` PASS: 1,032 units / 106 files, strict host/webview/
  tooling types, lint, production builds and VSIX packaging; zero errors/warnings.
  The runner records 2026-10-24T01:32:59.165Z through 01:43:21.092Z (621.927 s),
  exit 0, 304 identical before/after file hashes. VSIX: 34 files, 996.81 KB,
  with the strict nonempty and less-than-10,000,000-byte assertion enforced.
  Evidence: out/t027-verify-1.log, -before.json and -status.json.
- Canonical `npm run verify:full` PASS: 1,032 units / 106 files and 76 real-host
  tests, including all original large-file workloads; strict types/lint/build/VSIX.
  Started 2026-10-24T01:43:50.513Z, finished 2026-10-24T02:30:50.719Z
  (2820.206 s), exit 0, all 304 before/after hashes identical. Standard
  launcher, no debugger switches or changed workloads/deadlines/diagnostic policy.
  Evidence: out/t027-full-1.log, -before.json and -status.json.
  One explicitly approved renderer warning follows; this is not warning-free.
- `npm run trace` lists only future FR-013/020/021/022/030/040. Named coverage is
  reconciled with the real assertions below; naming alone is not proof of behavior.
- Fresh actual-candidate Windows/macOS/Ubuntu CI is PENDING with the owner.
  Earlier T-026 CI does not cover these repairs. No tag or milestone closure.

After the gates, only evidence records, the changelog and the README Output-channel
name change. Executable/configuration hashes still match the full-gate snapshot;
no executable file is added. A final `npm run package` passes after these document
updates: 34 files, 996.94 KB, strict decimal 10-MB ceiling, zero errors/warnings
(out/t027-handoff-package.log). The earlier gate artifact is 996.81 KB. Independent
final evidence review finds no factual correction. The staged 27-file task manifest
excludes all pre-existing owner hunks and unrelated fixtures.

## Canonical performance and diagnostic evidence

Observed host: VS Code 1.140.0, win32 x64, helper Node 24.21.0; native SQLite
3.53.4 and fallback SQLite 3.49.1. These are observed runtime versions, not a
change to package development requirements. Warm generated files are used.

- CSV 1,000,013,832 bytes / 244,144 rows: first populated DOM 439.2255 ms; combined host/helper peak 311537664 bytes; renderer separately 658403328; 129 samples, 82 import-helper / 45 browser-helper; largest observation gap 799.3966 ms; host timer gap 53.3519 ms; paging growth 27660288 bytes. Full source SHA-256 d9ca2d901ce394b65f350d58e6acfb7aa5de1ff6c709ef59cc165cfb0de68789.
- CSV 5,000,003,592 bytes / 1,220,704 rows: first populated DOM 530.6000 ms; combined host/helper peak 304254976 bytes; renderer separately 472690688; 486 samples, 373 import-helper / 111 browser-helper; largest observation gap 1300.7913 ms; host timer gap 42.0640 ms; paging growth 25608192 bytes. Full source SHA-256 350d6e4f39ac41dfa814bb65b80c11f24ff58469c4df6beb8d2b6888cb871e68.
- SQLite 1,285,033,984 bytes / 10,000,000 rows: first populated DOM 1002.4356 ms; combined peak 284127232 bytes; renderer separately 412897280; 67 samples / 66 helper; largest gap 529.4654 ms; paging growth 6709248 bytes. Full source SHA-256 7fe4e06f189cc8bcc833521f82a2833118a98245d3c9f26d8bbae21032e0b298.
- SQLite 5,874,388,992 bytes / 10,000,000 rows: first populated DOM 910.8946 ms; combined peak 294121472 bytes; renderer separately 400801792; 185 samples / 184 helper; largest gap 536.1722 ms; paging growth 16961536 bytes. Full source SHA-256 203e3860172622ef1a65108ae8d14acfe51c25b0f689ae267f4184e4721a535e.
- JSON 1,000,016,431 bytes / 243,313 rows: combined peak 303464448 bytes; renderer separately 428376064; 168 samples / 158 import-helper; largest observation gap 700.8934 ms; host timer gap 47.2242 ms. Full source SHA-256 41eacc598a3e38c50ac6f7b7deffb88ea3786126d1da2e954c7c3b9bf9205454.
- JSON 5,000,065,711 bytes / 1,216,561 rows: combined peak 299499520 bytes; renderer separately 405221376; 688 samples / 619 import-helper; largest observation gap 750.2653 ms; host timer gap 45.2515 ms. Full source SHA-256 3f93be795a091bd8d55247187772c3fbc1f7e8c53e1f9a1139008fd572bb8c37.
- JSONL 1,000,012,320 bytes / 243,312 rows: combined peak 291250176 bytes; renderer separately 395952128; 150 samples / 141 import-helper; largest observation gap 802.4412 ms; host timer gap 47.7139 ms. Full source SHA-256 a98cbfd61a4bad6a3004833be21b56d2f05cd45652005cf2925b5cf19df09d76.
- JSONL 5,000,061,600 bytes / 1,216,560 rows: combined peak 296472576 bytes; renderer separately 444698624; 611 samples / 531 import-helper; largest observation gap 892.3415 ms; host timer gap 47.7989 ms. Full source SHA-256 fe866f10bc4733086d26e8ef9f2545e49e05b45ae8905462a6a9aded2f5d30d9.

NFR-003: all measured combined peaks are strictly below 500,000,000 bytes.
CSV larger-file peak change is -7282688 bytes; SQLite is
9994240 bytes. Those and every measured CSV/SQLite paging-growth
value are below the unchanged 50,000,000-byte growth allowance. CSV/SQLite each
complete 60 Browse / 20 SQL pages and full source/data checks. JSON/JSONL checks
use populated 4095-character TEXT and complete imports/data/hashes; no repeated-
paging claim is made for them. Ten-million-row JSON and JSONL also pass full
aggregates and hashes (341606 ms). Renderer memory is reported separately and
is not covered by the combined extension-host/helper cap. Calibration renderer
peak is 956477440 bytes; it is not omitted or described as under 500 MB.

NFR-004: every reported populated CSV/SQLite first DOM is below 2000 ms.
NFR-005: CSV/JSON/JSONL observed host timer maxima are below 100 ms; native/
fallback executing-query helper exit is 0.9261 / 0.6338 ms, below 1000 ms,
with host gaps 37.9560 / 39.5001 ms. Observer gaps are below 3000 ms. These
sampled resident-memory and timer observations do not establish unsampled
instantaneous peaks, physical paint, cold-disk speed or every possible stall.

Severity warning, VSCODE-HOST-001, source 20261024T095412/window1/renderer.log:10:

> [CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]

No other warning or error is accepted. This full run is not warning-free.

## Independent review and test-first repairs

One fresh no-history independent reviewer inspected the actual cumulative
v0.1.0..026b836 executable diff inventory and core CSV/JSON/XLSX, storage/save,
opening/defaults, completion, paging and verification paths. The specialized
Bugbot launcher is unavailable; the standard isolated-agent fallback was used.
This is a scoped code review, not exhaustive execution of every changed path.

1. HIGH, FR-004 / NFR-001: imported-query export protected only private SQLite,
   allowing the original CSV/JSON/XLSX source or alias to be overwritten. Retain
   the original canonical path and BigInt inode snapshot through the import,
   SqliteSession and ExportService. Check source paths, renamed/hard-link identity
   and sidecars before worker writes and immediately before publication. Export
   to unrelated output still works after source movement/removal. Six service
   regressions fail on old code; seven service cases, three controller-format
   cases and ten real-worker cases now cover five formats and both engines.
2. MEDIUM, NFR-005: tabular header sniff opened POSIX FIFOs in blocking mode before
   loader validation. Use POSIX O_NONBLOCK, validate the opened handle is regular
   before reading, and always close it. Three regressions fail on the old flags;
   neighboring header dispatch tests remain intact. A live POSIX FIFO was not
   executed on this Windows host; cross-platform runtime remains CI scope.
3. LOW, FR-006: XLSX XML validated numeric references but accepted forbidden literal
   XML characters. Validate the complete raw XML before token parsing, including
   attributes, comments, CDATA and declarations. Seven invalid-character cases
   fail before the repair; valid Unicode and Excel _xNNNN_ spellings remain valid.
   The latter are decoded as Excel string escapes after XML parsing.

The gate audit also closes existing NFR-008/010 gaps: actual VSIX packaging now
enforces the strict decimal 10-MB ceiling, and production SQLite/import lifecycle
logs go to the Lite Voyager Output channel. The new production lifecycle logging
emits only fixed operation/phase labels, never paths, SQL, schema, values or raw
error text. Existing spike diagnostics retain their structured runtime/query-check
records. Repeated progress
does not duplicate phase records; listeners detach on closure and a disposed
channel cannot interrupt cleanup. New acceptance tests precede these changes.

Independent follow-up clears all three repairs, diagnostics/package wiring and
final policy tests, with no remaining concrete finding in the inspected paths.
Reviewer execution limits remain explicit: its focused Vitest launch hit spawn
EPERM; passing test claims here come from the primary agent's observed runs.

## Acceptance-to-test reconciliation

- FR-004: csv-records/detection/import/BOM tests cover BOM, CRLF, quoted delimiters/
  newlines, ragged and duplicate/blank headers, exact inference/widening, header-off,
  all-text, empty/header-only, corrupt UTF-8, late errors, 64-KiB boundaries,
  1,000 columns, >1-MB/16-MiB cells, fallback caps, cancellation/crash and sources.
  Real-host csv-preview/import and csv-import-memory tests exercise DOM controls,
  full data, 1/5-GB memory, repeated paging and supervised cleanup.
- FR-005: json-records/import/recovery/fallback-race tests cover streaming arrays/
  JSONL, exact numbers, key unions, nested text, bad shapes/encoding, huge cells,
  worker/source mutation and cleanup. Real-host json-import and memory tests cover
  json_extract, complete save, ten-million-row and populated 1/5-GB workloads.
- FR-006: xlsx-import/ZIP/XML/parts/consent/canonical tests cover all sheets,
  cached/missing formula values, raw numerics, sparse/implicit addresses, names,
  hidden/empty sheets, malformed files, actual Excel limits, memory consent,
  fallback expansion refusal, cancellation/recovery and source mutation. Real-host
  xlsx-import tests query/save every supported sheet and preserve source bytes.
- FR-007: temp-storage/helper-registration and sqlite-save/fault tests cover
  exact preflight arithmetic, low-space cancel/override, uncertain/live/dead PIDs,
  linked directories, cancellation/closure, aliases/sidecars, atomic publication,
  complete database saves and recovery. Real-host save and actual crash/restart QA
  below add UI and orphan evidence.
- FR-012: sql-completion/engine/clean-checkout tests plus real-host completion
  tests exercise keywords, schema beyond the first metadata page, aliases,
  quoted/Unicode identifiers, bounded context/results, typing/keyboard/undo,
  lifecycle/error isolation and exact SQL across all five imports/both engines.
- D-5: opening/defaults/tabular-editor tests plus real-host file-opening tests
  cover all formats, optional/default routes, menus/title action, explicit user
  associations, dirty text and independent views. UI picker/actions are below.
- Fidelity / NFR-001/002/003/004/005/009: existing both-engine worker/host suites
  assert exact int64/text/NULL/empty/BLOB behavior, unchanged source hashes,
  bounded paged data, read-only SQL, CSP, no extension loading, responsiveness,
  cancellation/recovery and the unchanged production memory/DOM targets.
- NFR-006: privacy.test.ts audits direct network imports and named request APIs
  in production host/worker/webview TypeScript. It excludes test sources and does
  not prove dependency internals or computed/aliased requests; independent review
  found no current network/telemetry entry point. No dependency change is made.
- NFR-007: browser-view's corrected appearance requirement name, existing grid/
  keyboard/host appearance assertions and separate pixel observations below.
- NFR-008/010: package-size.test.ts and the actual package gate, diagnostics.test.ts
  and observed production Output log. No file content is logged by the new path.

## Eight delegated manual checks

QA uses disposable sources and isolated VS Code 1.140.0 profiles. The owner's
original VS Code window is untouched. Windows Computer Use fails fresh target
binding twice, exactly: `window id 133278 no longer belongs to Microsoft.VisualStudioCode; current owner is Microsoft.VisualStudioCode`.
The native confirmation surface also fails fresh binding at id 526488. Fallback
uses the actual workbench/webview's loopback-only Chromium debugger endpoint.
These are running extension pixels and actual backend/DOM behavior, not a synthetic
component shell. Native physical paint, OS file pickers, scrolling smoothness and
unobserved platforms are not claimed. Debugger hosts are not canonical gates.

1. CSV fidelity: BOM/CRLF, quoted comma/newline and ragged fields show exact int64,
   literal NULL, empty text and missing values. Light/dark preview is readable;
   an actual grid click and ArrowRight reveal complete multiline cell text.
   Header-off/all-text TSV produces three data rows on fallback; its banner and
   options remain readable. Imported keyboard navigation selects Grace exactly.
2. Generated 1-GB CSV: 1,000,013,832 bytes / 244,144 rows, 4,096-byte records.
   Populated preview DOM reports 235.3878 ms (warm fixture, not physical paint).
   Progress shows exact increasing bytes/rows with disabled options and enabled
   Cancel; preview stays present. Cancel settles, owned storage is empty, and
   the complete source SHA-256 still matches its generation hash.
3. Actual interrupted import: record confirms host 3444, main 10016, helper
   26424 and one owned session during progress. Exact profile/process identities
   are checked, then that disposable host is abruptly killed. Host/helper exit,
   but its session directory remains. Restarting the same profile activates the
   real controllers and removes the orphan. crash-before.json/crash-after.json
   retain the evidence; the owner window is unaffected.
4. Low disk: a QA-only statfs override supplies zero available bytes. In a
   non-test disposable host using VS Code's custom dialog style, the actual
   preflight dialog shows 0 available / 67,109,179 estimated bytes, explains the
   estimate, and offers explicit Import anyway or Cancel. Cancel refuses safely.
   No shipping disk check or threshold is changed.
5. JSON/JSONL: native JSON array and fallback JSONL import, actual SQL
   json_extract(nested,'$.label'), exact 9007199254740993 and SQL NULL pass DOM
   assertions. Bad top-level object shows the actionable shape error. Screenshot
   captures show the real SQL/import surface; DOM reports establish returned data.
6. XLSX: two sheets become separate tables; selecting Other sheet returns
   second sheet. An independent 100,000,001-byte consent-boundary fixture shows
   the exact above-100-MB warning and Cancel refuses before parsing. That sparse
   boundary fixture is not claimed as a valid large workbook or memory benchmark.
7. Opening: Explorer context menu contains Open in Lite Voyager and Open With.
   Open With shows a single Lite Voyager entry and the default Text Editor.
   Selecting Text Editor displays original TSV; the title table action returns
   to the import preview. The setting is toggled only in the disposable profile;
   actual all-format on/off/explicit-choice behavior remains real-host test evidence.
8. Autocomplete: actual metadata offers first name in SELECT fi FROM records.
   Light/dark popups are readable; Enter inserts the quoted identifier, Run returns
   Ada, and keyboard grid selection reaches Grace. Table/alias/quote semantics
   remain separately covered by canonical real-host tests.

Screenshots and QA scripts are retained in out/t027-qa and ignored out/t027-* tools.
The bridge trace is per-host and later launches overwrite earlier traces; earlier
per-action assertions were observed in tool outputs, but their original traces
are not all retained. Key images include
csv-light-multiline, completion-light/dark, imported-keyboard-dark, large-preview/
progress/cancelled, low-disk-dialog/refused, xlsx-memory-dialog, explorer-context,
open-with-picker and title-opened-import. Later screenshots do not replace earlier
DOM assertions or establish hidden grid values as physically painted.

Final independent recipe/hash checks pass seven generated sources, including the
complete 1-GB source; the last host has exited and storage is empty. Evidence:
out/t027-qa/final-source-safety.json. Large source SHA-256:
d9ca2d901ce394b65f350d58e6acfb7aa5de1ff6c709ef59cc165cfb0de68789.

## Retained failed checks and instrumentation limits

- Initial focused tests cannot start under sandbox child-process restrictions
  (Vite spawn EPERM); authorized normal execution is used thereafter.
- Initial controller regression expected browserRows instead of the real
  browserQueryRows response. That harness failure is retained and corrected;
  the six independent export-service regressions are the genuine pre-fix source
  protection failures. Focused repair checks then pass 52 tests, plus ten actual
  format/engine worker checks. No assertion is removed or weakened.
- Diagnostics/package acceptance initially fails missing implementation modules.
  First lint catches an inferred unsafe mock return; an explicit function type
  fixes it. No any, ignore or lint suppression is introduced. Final focused policy
  checks pass 53 tests; separate strict types/lint checks pass.
- QA setup includes malformed PowerShell JSON argv, a stale quit command, partial
  JSON-file reads and reusing an already-open source. The bridge is corrected;
  these setup outcomes are not product failures or canonical passes.
- Direct TS fixture import emits MODULE_TYPELESS_PACKAGE_JSON. Visual hosts emit
  `Warning: 'remote-debugging-port' is not in the list of known options, but still passed to Electron/Chromium.`
  and the matching remote-debugging-address warning, plus DEP0169 url.parse()
  deprecation. The native attempt also emits DEP0169. Full originals remain in
  out/t027-qa/host*.log. These are not permitted canonical diagnostics.
- Test mode refuses native dialogs. A non-test QA launch initially rejects the
  integration-only signed-out fixture; that fixture is replaced by a QA-only theme
  contribution. Native modal capture remains unavailable; final custom dialogs
  are inspected. The final visual renderer logs the unapproved cloud-dictation
  authentication timeout. No host diagnostic allowance is changed, and none of
  these visual launches is described as a clean gate or used to clear full verify.
- The deliberate crash and disposal of blocked native-modal QA hosts are
  intentional test actions. They do not erase earlier diagnostics or permit a
  retry-to-green of canonical verification. No canonical run is retried unchanged.

## Files and owner handoff

The session starts at 026b836 with owner edits in README.md, specs/PLAN.md,
specs/TASKS.md and specs/VALIDATION.md, plus debug.log, gingTryWan/ and untracked
fixture files. Preserve all of those. Stage only task-owned hunks in shared files;
generated out/ QA/stress assets are ignored and do not ship.

Task files: PROGRESS.md; README.md (only the Output-channel instruction); CHANGELOG.md;
specs/SPEC.md, PLAN.md, TASKS.md and VALIDATION.md; this record;
scripts/package-check.mts and package-size.mts; src/diagnostics.ts and extension.ts;
src/editor/csv-import.ts, export-service.ts, sqlite-editor.ts, sqlite-session.ts and
tabular-editor.ts; src/loaders/xlsx-xml.ts; test/unit/browser-view.test.ts,
csv-import-panel.test.ts, diagnostics.test.ts, import-export-engine.test.ts,
import-export.test.ts, package-size.test.ts, privacy.test.ts, tabular-header.test.ts
and xlsx-xml.test.ts. No dependency, package-version, release or tag change.

Commands: npm run trace; npm run verify; npm run verify:full.
Owner pushes the task commit and sends the Actions URL, exact tested SHA and
Windows/macOS/Ubuntu conclusions. Paste failing step logs if any. Do not tick
T-027 or claim milestone closure from local evidence alone.
