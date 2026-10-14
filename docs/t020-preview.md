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

Milestone 2 independent review and three-platform CI remain milestone gate
items. A fresh review should inspect the real T-020 diff against its parent,
the Constitution, SPEC's T-020 acceptance and VALIDATION section 5. Fix confirmed
findings with failing regressions first; do not rewrite unrelated owner changes.

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
- `webview/csv-preview.ts`
- `webview/csv-preview.css`
- `test/unit/file-loader.test.ts`
- `test/unit/csv-preview.test.ts`
- `test/unit/csv-preview-ui.test.ts`
- `test/unit/csv-preview-panel.test.ts`
- `test/unit/csv-preview-snapshot.test.ts`

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

Build output and the local VSIX are generated, ignored artifacts. Existing
static fixtures and the owner's unrelated working-tree files are unchanged.
