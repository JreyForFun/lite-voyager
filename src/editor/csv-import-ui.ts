import { csvPreviewHtml } from './csv-preview-ui';
import type { SqliteEditorAssets } from './sqlite-editor-ui';

/** Reuse the exact preview shell; its root differs to avoid preview-only bootstrap. */
export function csvImportHtml(name: string, contextId: string, assets: SqliteEditorAssets): string {
  const controls = `<section aria-label="Import options"><div class="browser-toolbar">
<label for="import-delimiter">Delimiter</label><select id="import-delimiter"><option value=",">Comma</option><option value="&#9;">Tab</option><option value=";">Semicolon</option><option value="|">Pipe</option></select>
<label><input id="import-header" type="checkbox" checked> First row is header</label>
<label><input id="import-text" type="checkbox"> Keep all values as text</label>
<button id="import-refresh" disabled>Apply options / preview</button><button id="import-start" disabled>Import table</button>
<button id="import-cancel" disabled>Cancel import</button></div>
<progress id="import-progress" max="100" value="0" aria-label="Bytes processed" hidden></progress>
<p id="import-status" role="status" aria-live="polite">Reading preview before import…</p>
<p class="browser-help">Review the detected delimiter, then Import table. Changing options requires Apply options / preview.
Inference keeps canonical int64 integers exact; dates, ambiguous numbers and conflicting columns stay text.
Missing fields become SQL NULL; empty fields and literal NULL remain text. Extra fields add columns.
Preview stays browsable while importing; SQL becomes available after the whole file succeeds.
Memory-limited fallback allows at most 20,000,000 source bytes and 64,000,000 SQLite bytes; update VS Code for disk-backed imports.
The source is read-only. Imported table storage is temporary and removed when you close this tab.</p></section>`;
  return csvPreviewHtml(name, contextId, assets)
    .replace('id="csv-preview"', 'id="csv-import"')
    .replace('<h1>CSV / TSV preview</h1>', '<h1>CSV / TSV import</h1>')
    .replace('Read-only preview of up to 100 complete rows. Full import and SQL are not available yet.', 'Read-only preview of up to 100 complete rows before importing.')
    .replace('CSV uses comma and TSV uses tab; the first row is the header. Values remain exact text.', 'Review the detected delimiter and header setting. Preview values remain exact text.')
    .replace('<div class="browser-toolbar"><button id="csv-cancel">', `${controls}<div class="browser-toolbar"><button id="csv-cancel">`);
}
