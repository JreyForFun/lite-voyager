# T-020: CSV / TSV preview

This task adds a loader contract and a read-only preview, with no import or SQL
for CSV/TSV yet. Only T-020 is in scope. The owner retains pushing.

## Commands

From the project root:

```powershell
npm run verify
npm run verify:full
```

The full command runs the existing SQLite suite as well as three new real VS
Code preview cases. Approved renderer diagnostics must be reported individually;
that run is not warning-free if any are present. Do not retry a host failure to
get green; investigate it and retain the first failure.

To build a preview VSIX after verification:

```powershell
npm run build
node node_modules/@vscode/vsce/vsce package --no-dependencies --out out/t020-preview/lite-voyager-t020.vsix
```

The assistant prepares this artifact locally. In your VS Code, use **Extensions:
Install from VSIX...**, select it, and reload when asked. The version stays
0.0.1; this is a local preview, not a Marketplace release. Alternatively, press
F5 in this project to run the current source in an Extension Development Host.

## Owner-visible checks

1. Run **Lite Voyager: Preview CSV / TSV** and select
   `test/fixtures/bom-crlf.csv`. Confirm the grid is readable and the selected
   cell pane preserves quoted multiline text. Open the same CSV normally and
   confirm it still opens as text.
2. Preview `test/fixtures/duplicate-blank-headers.csv` and `ragged.csv`.
   Confirm all fields are visible, generated headers are explained, and a
   missing field is distinct from empty text and literal `NULL`.
3. Use arrow keys, Home/End and Ctrl/Cmd+End to select cells. Change between
   light/dark themes, resize the editor and scroll both directions; confirm the
   selected value stays readable and focus remains visible.
4. Preview `test/fixtures/unterminated.csv`, `binary.csv` and `non-utf8.csv`.
   Confirm readable errors, then open `sample.csv` successfully. Start another
   preview and immediately cancel/close it; reopen successfully.
5. Confirm the tab explains its preview limits and unavailable full import/SQL.
   No input file should change; there is no source-save action in this task.

Paste `T-020 visual checks 1–5: PASS` or the failing check number and what you saw.
These physical observations, cold-disk paint, other operating systems and full
CSV import memory/performance are not inferred from automated DOM tests.

T-020 scoped independent review is complete, with the owner's authorized fresh
review agent and cleared red-first findings. Final actual-candidate CI passes
on all three platforms (run 38592857439, commit 6f19368). Whole Milestone 2 QA
and review remain separate gates for later tasks; no milestone closure is claimed.

## File inventory

Created:
- `docs/t020-preview.md`
- `src/editor/csv-preview-ui.ts`
- `src/editor/csv-preview.ts`
- `src/loaders/file-loader.ts`
- `src/loaders/csv-loader.ts`
- `src/loaders/csv-preview-reader.ts`
- `src/worker/csv-preview-worker.ts`
- `src/test/csv-preview.test.ts`
- `src/test/csv-preview-fixture.ts` (disposable sparse test data; Windows uses built-in fsutil before expansion)
- `webview/csv-preview.ts`
- `webview/csv-preview.css`
- `test/unit/file-loader.test.ts`
- `test/unit/csv-preview.test.ts`
- `test/unit/csv-preview-ui.test.ts`
- `test/unit/csv-preview-panel.test.ts`
- `test/unit/csv-preview-snapshot.test.ts`
- `test/unit/csv-preview-fixture.test.ts` (real OS sparse-file attribute/block verification)

Modified:
- `.vscodeignore`
- `README.md` (only the new preview section)
- `CHANGELOG.md`
- `esbuild.js`
- `package.json`
- `tsconfig.json` (DOM declarations required by upstream parser typings)
- `src/extension.ts`
- `src/protocol.ts`
- `webview/browser-grid.ts` (configurable missing-field labels)
- `test/unit/dependency-audit.test.ts`
- `specs/dependency-licenses.json` (parser notice, unchanged locked tree)
- `specs/DEPENDENCIES.md`
- `specs/SPEC.md`
- `specs/PLAN.md`
- `specs/TASKS.md`
- `specs/VALIDATION.md`
- `PROGRESS.md`
- `AGENTS.md` (owner-authorized fifth exact renderer diagnostic family)
- `scripts/integration-logs.mts` (same source/severity guards and reporting)
- `test/unit/integration-logs.test.ts` (13 added acceptance/guard cases)

Build output and the local VSIX are generated, ignored artifacts. Existing
static fixtures and the owner's unrelated working-tree files are unchanged.

## Reviewed follow-up repairs

The follow-up to commit `256ebb2` changes only:
- `src/loaders/csv-preview-reader.ts` and `test/unit/csv-preview.test.ts`
  (unscanned UTF-8 tails and POSIX FIFO safety, with failing regressions first).
- `src/editor/csv-preview.ts` and `test/unit/csv-preview-panel.test.ts`
  (failure cleanup completes without waiting for notification dismissal).
- `src/test/csv-preview-fixture.ts`, `test/unit/csv-preview-fixture.test.ts`
  and `src/test/csv-preview.test.ts` (genuine sparse disposable fixtures;
  the original 3 GB size, read bounds and timing assertions remain intact).
- This guide, `PROGRESS.md`, `specs/TASKS.md` and `specs/VALIDATION.md`
  (file inventory and passing/failing evidence).

The canonical alias-path race injector is also repaired with a red-first
regression; expected error, actual replacement and 1,000-ms deadline remain
asserted. Owner-delegated HOST-005 adds only the exact remoteStatusIndicator
startup timing family with all other diagnostic failures retained.

Independent review clears all repairs. Final standalone passes 601 tests in
53 files with zero errors/warnings. Prior real-host runs pass 52 cases with
explicitly recorded approved warnings. Final [CI run 38592857439](https://github.com/JreyForFun/lite-voyager/actions/runs/38592857439),
attempt 1 at 6f19368, passes locked installs/full checks on Windows/macOS/Ubuntu.
Remote raw counts/diagnostics are not retrieved; no warning-free remote claim.
Owner visual QA 1-5 PASS. T-020 is complete and checked; the next chat plans
T-021 only. Full import and all later formats remain unimplemented.

Verification commands: `npm run verify`, `npm run verify:full`; Linux full is
`dbus-run-session -- xvfb-run -a npm run verify:full`. Do not repeat large local
WSL workloads under the retained host-resource limitations. All failed probes
remain recorded in `specs/VALIDATION.md`; no retry-to-green or erased failure.
