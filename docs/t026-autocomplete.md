# T-026: schema autocomplete (2026-10-20)

Owner delegates implementation, uncertainty resolution, scoped fixes/fixtures and
visual QA; owner retains push and actual-candidate CI. SPEC FR-012 acceptance
precedes tests/code. No whole-milestone closure, release or tag is implied.

## Design and limits

The existing SQLite language supplies keywords. Declare already-installed/locked
MIT @codemirror/autocomplete 6.20.3 directly; shipped declarations/source verify
its APIs and default 75-ms interaction guard. Existing notices already include
its license. No new transitive package, network asset, Engine interface or
database-worker transport operation is needed.

A bounded lexical pass recognizes current-statement FROM/JOIN references, main
qualification, ordinary aliases and quoted identifiers. At statement start only
keywords are offered. Unqualified columns use referenced tables or the selected
browse table. CTE/subquery scopes, SQL documents above 64 Ki UTF-16 units, and over
16 referenced tables receive explanations instead of guessed scope resolution.

Typed browserComplete requests reuse the supervised queue and parameterized
worker-only metadata SELECTs. Columns use temp.pragma_table_xinfo with bound
object names; no user-table data is scanned. Prefix filtering finds names beyond
the first schema page without a whole-schema cache. Replies contain at most 100
matches/65,536 name/table characters; hasMore produces a visible narrowing notice.
Names insert double-quoted with doubled embedded quotes, without rewriting SQL.

Metadata preserves successful query/export/grid context. Keywords stay available
during other work; completion does not supersede that work. Run can supersede
metadata. Superseded/disposed promises settle empty; request IDs and CodeMirror
abort events suppress stale replies. Cancellation/recovery use existing workers.
The notice sits above the editor so the popup cannot obscure its limits.

## Retained tests-first history

1. Sandbox Vitest fails at spawn EPERM. With normal process access, the first
   suite fails on absent completion modules. Two browser lifecycle tests fail
   with view.complete absent before implementation.
2. First worker tests fail on both engines with ambiguous column name: name.
   An outer SELECT sorts the projected metadata union without ambiguity.
3. Initial real-host tests fail both cases: native accepts schema table select
   before keyword SELECT; fallback Enter arrives within CodeMirror's default
   interaction guard. A failing unit reproduces statement-start schema suggestions.
   Correct the context and model a user's reading interval in host tests, keeping
   production guards/deadlines unchanged.
4. Second host run fails because both record_labels and records match rec and
   the test assumes its desired item is selected. Bounded selected-label status
   plus real arrow-key selection fixes that test without weakening assertions.
5. Focused host 3 passes two cases in five seconds. Sole approved diagnostic:
   HOST-001, severity warning, 20261020T190027/window1/renderer.log:9, exact message:
   `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
   This run is not warning-free. Host 1 also has this exact warning at
   20261020T185512/window1/renderer.log:9; host 2 has no approved warning. Both
   failed runs reject renderer `2 tests failed.` errors.
6. Focused units pass 55 tests/five files, including both real engines, 125 tables,
   1,003 columns, distant names, quoted/Unicode/prototype-like names, shadowed
   PRAGMA-function names, broken-view errors/recovery, export preservation,
   sparse messages, aborts and exact source hashes.
7. First lint rejects three unsafe stringContaining matcher assignments in new
   tests. Explicit notice assertions repair them without disables. Offline npm
   lock update fails ENOTCACHED; edit only manifest/root lock entry for the already
   installed version, preserving package records/integrities. No registry fetch.

Logs: out/t026-focused-1.log, -2.log and -3.log. The third harness reports passed
true and runner exit zero; PowerShell stderr redirection gives an outer nonzero
status. Retain this shell artifact separately, not as a clean shell pass.
Expanded host run (profile integration-profile-t026-5H66pw) passes all four cases
in 17 seconds: both engines, all five imported formats, exact quoted-column SQL,
source byte equality and actual CodeMirror keys. Its sole approved diagnostic is
HOST-001 at 20261020T190912/window1/renderer.log:9, severity warning, exact same
message above. It is not warning-free. Harness and shell exit zero.

Final inspection adds three isolation cases. Two fail first: metadata requests
clear a pending slow-sort confirmation, and an unsolicited completion reply can
settle a running SQL request. A warning-state guard and response-kind guard fix
them. The 50 context/browser tests pass afterward, including explicit selected-
table fallback versus FROM context. These guards do not change visual layout.

Repaired verify 2 passes strict types/lint and 935/936 units, failing only the
stale dependency inventory fingerprint after direct autocomplete declaration.
Preserve out/t026-verify-2.log and -status.json (all 272 frozen hashes unchanged).
Update only the inventory fingerprint/direct flag and append its dated dependency
record; all 577 package paths/versions/license evidence stay unchanged. No new
vulnerability audit is claimed. Two further regressions fail first: the test-only
Undo/Redo action lacks Command-key fallback, and a legal alias main is mistaken
for the schema name. Match the existing key-helper fallback and prefer known
aliases. All 17 completion/editor/inventory tests then pass. No weakened types,
test assertions, deadlines or platform guards.

## Visual QA

Native screenshot selection fails twice with the helper's exact message:
`window id 3080210 no longer belongs to Microsoft.VisualStudioCode; current owner is Microsoft.VisualStudioCode`.
The isolated visual host is stopped only after checking its exact profile command
line. The user's editor is untouched. Native physical paint is unobserved.

Chrome component renders use the shipped shell/CSS/JS, original nonce CSP and
synthetic typed metadata. Initial six screenshots in out/t026-render reveal a
covered narrowing notice. A geometry check fails before repair in
out/t026-render-before-fix/narrow-limit-light.dom.html. After placing the notice
above CodeMirror, all six final renders in out/t026-render-final pass the geometry,
CSP and script-error checks and are inspected: light/dark tables/views with
spaces/quotes/emoji, quoted columns/long labels and 640-pixel-wide 100-match lists.
Notice text is readable above the list and selection contrast is visible.
These are component observations; real-host keyboard behavior is separate.

## Gates and handoff

- Expanded four-case host run: PASS with the exact approved warning above.
- First literal npm run verify fails webview strict types: an optional selected-
  table flag is explicitly passed as undefined under exactOptionalPropertyTypes.
  Normalize it to a boolean; no type weakening. Units/build/package are not reached.
  Evidence: out/t026-verify-1.log and -status.json; verify 2 failure is recorded above.
- Repaired literal npm run verify: PASS, 938 units/95 files, strict host/webview/
  tooling types, lint, production bundles and VSIX packaging (34 files/996.33 KB).
  Zero errors and zero warnings; 435.353 seconds. All 272 captured source/spec/
  record hashes are unchanged. Evidence: out/t026-verify-3.log and -status.json.
- First literal npm run verify:full: FAIL, 938 units PASS /75 hosts PASS /one host
  failure, 2298.985 seconds. All 272 captured hashes match. The existing populated
  CSV case fails during its 1-GB workload with `CSV memory observer failed: OS
  observer snapshot exceeded 3000 ms; stage=waiting for next snapshot; snapshots=52.`
  No completed 1/5-GB CSV memory comparison is claimed for that run. All four T-026
  cases pass, alongside populated SQLite and JSON/JSONL workloads. Evidence:
  out/t026-full-1.log and -status.json. No unchanged full retry is started.
- A separate unchanged CSV-only diagnostic PASSes, exit zero, 299.157 seconds,
  with all original workloads/deadlines/assertions. Both sizes pass all 60 Browse/
  20 SQL pages and complete-data/source hashes. Sampled host-plus-helpers peaks:
  313,749,504 /322,875,392 bytes; actual paging growth: 29,921,280 /22,020,096 bytes;
  maximum observation gaps: 1091.0551 /882.0487 ms. Renderer residency is reported
  separately. It does not reproduce, explain or clear the failed full run.
  Evidence: out/t026-csv-diagnostic.log, -status.json and -result.json. Sole approved
  warning: HOST-001 at 20261020T201631/window1/renderer.log:9, severity warning,
  exact same CloudSandboxApi message above. Diagnostic is not warning-free.
- The full runner stops on test failure before its automatic runtime scan, so a
  separate strict scan preserves the rejected renderer error at
  20261020T194207/window1/renderer.log:827, severity error, `1 test failed.` Its only
  approved record is HOST-001 at that renderer.log:10, severity warning, exact
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  The run is failed and not warning-free. Evidence: out/t026-full-1-diagnostics.log.
- Request owner authorization for exactly one unchanged full rerun under the
  section-1 no-retry-to-green policy; do not infer authorization from elapsed time.
  Retain every failure and all guards; the historical snapshot stall's cause is
  unknown. No unrelated observer rewrite or deadline increase is made.
- Owner explicitly answers `Authorize one full rerun; retain the failure` after
  the CSV diagnostic passes (2026-10-20). This permits exactly one unchanged
  canonical full attempt with all prior failures/unknown cause retained and all
  existing checks intact. No second unchanged attempt is authorized. Commit the
  scoped candidate first; record the new full result separately.

Current acceptance: schema/keyword/quoted insertion, aliases, bounds/notices,
stale/disposed/busy/error paths, both engines, all imported formats, source safety
and scoped component visuals have passing evidence. The canonical full gate
remains failed; native physical-paint QA and actual-candidate three-platform CI
are unobserved. T-026 cannot be checked on this evidence.
- Owner-pushed actual-candidate three-platform CI: pending.
- T-026 remains unchecked. Whole Milestone 2 QA/review and release/tag stay open.

New production modules: src/editor/sql-completion.ts, webview/sql-completion.ts.
Changed production: src/editor/sqlite-browser.ts, src/protocol.ts,
webview/sql-editor.ts, webview/sqlite-browser.ts, package.json, package-lock.json.
New tests: test/unit/sql-completion.test.ts, test/unit/sql-completion-engine.test.ts,
src/test/sql-completion.test.ts. Changed tests: test/unit/browser-view.test.ts,
test/unit/sql-editor.test.ts.
Records: this file, specs/SPEC.md, specs/PLAN.md, specs/VALIDATION.md,
specs/TASKS.md, specs/DEPENDENCIES.md, specs/dependency-licenses.json, PROGRESS.md.
Preserve existing owner edits; README, unrelated
fixtures/debug files and ignored out/t026-* evidence are excluded from the task.

```
npm test -- test/unit/sql-completion.test.ts test/unit/sql-completion-engine.test.ts test/unit/browser-view.test.ts test/unit/browser-startup.test.ts test/unit/sql-editor.test.ts
npm run verify
npm run verify:full
```
