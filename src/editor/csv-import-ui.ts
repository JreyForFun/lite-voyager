import { csvPreviewHtml } from './csv-preview-ui';
import type { SqliteEditorAssets } from './sqlite-editor-ui';

/** Reuse the exact preview shell; its root differs to avoid preview-only bootstrap. */
export function csvImportHtml(name: string, contextId: string, assets: SqliteEditorAssets, format: 'csv' | 'json' | 'xlsx' = 'csv'): string {
  const json = format === 'json'; const xlsx = format === 'xlsx'; const fixed = json || xlsx; const label = xlsx ? 'XLSX' : json ? 'JSON / JSONL' : 'CSV / TSV';
  const controls = `<section aria-label="Import options"><div class="browser-toolbar">
${fixed ? '<span hidden>' : ''}<label for="import-delimiter">Delimiter</label><select id="import-delimiter"><option value=",">Comma</option><option value="&#9;">Tab</option><option value=";">Semicolon</option><option value="|">Pipe</option></select>
<label><input id="import-header" type="checkbox" checked> First row is header</label>
<label><input id="import-text" type="checkbox"> Keep all values as text</label>
${fixed ? '</span>' : ''}<button id="import-refresh" disabled>${fixed ? 'Retry preview' : 'Apply options / preview'}</button><button id="import-start" disabled>${xlsx ? 'Import workbook' : 'Import table'}</button>
<button id="import-cancel" disabled>Cancel import</button></div>
<progress id="import-progress" max="100" value="0" aria-label="Bytes processed" hidden></progress>
<p id="import-status" role="status" aria-live="polite">Reading preview before import…</p>
${xlsx ? '<p class="browser-help">XLSX expands in memory, potentially far beyond its compressed size even below 100 MB. Above 100 MB, loading asks for consent.</p><details><summary>XLSX values and limits</summary>' : ''}
<p class="browser-help">${xlsx ? 'Every worksheet becomes a table, including hidden/empty sheets; physical row 1 supplies headers. Formulas use cached values only (possibly stale); missing caches become SQL NULL. Dates remain Excel serial numbers or stored ISO text. XLSX is memory-bound: expanded XML/cells can be much larger than the compressed file, even below 100 MB; above 100 MB loading needs consent. Blank cells become SQL NULL; empty text stays empty; merged cells are not filled. Excel limits: 1,048,576 rows, 16,384 columns, 32,767 text characters/cell; SQLite supports 2,000 columns here. Memory-limited fallback: 20,000,000 source bytes / 64,000,000 SQLite bytes.' : json ? 'Use a top-level JSON array of objects, or one object per nonblank JSONL line. NULL includes missing keys; booleans become 1/0. Numbers that cannot round-trip safely stay exact text. Nested values stay JSON text for json_extract(); SQLite JSON numeric arithmetic has its own limits. Blank/NUL keys and case collisions receive unique column names. Fallback memory limits are shown with the preview.' : `Review the detected delimiter, then Import table. Changing options requires Apply options / preview.
Inference keeps canonical int64 integers exact; dates, ambiguous numbers and conflicting columns stay text.
Missing fields become SQL NULL; empty fields and literal NULL remain text. Extra fields add columns.
Preview stays browsable while importing; SQL becomes available after the whole file succeeds.
Memory-limited fallback allows at most 20,000,000 source bytes and 64,000,000 SQLite bytes; update VS Code for disk-backed imports.`}
The source is read-only. Imported table storage is temporary and removed when you close this tab.</p>${xlsx ? '</details>' : ''}</section>`;
  return csvPreviewHtml(name, contextId, assets)
    .replace('id="csv-preview"', `id="csv-import" data-format="${format}"`)
    .replace('<h1>CSV / TSV preview</h1>', `<h1>${label} import</h1>`)
    .replace('<title>CSV preview</title>', `<title>${label} import</title>`)
    .replace('aria-label="CSV preview"', `aria-label="${label} preview"`)
    .replace('Read-only preview of up to 100 complete rows. Full import and SQL are not available yet.', 'Read-only preview of up to 100 complete rows before importing.')
    .replace('CSV uses comma and TSV uses tab; the first row is the header. Values remain exact text.', xlsx ? 'Preview shows the first worksheet; Import workbook loads every sheet. Values retain stored precision.' : json ? 'Columns follow object keys. Nested values appear as JSON text. NULL includes missing keys.' : 'Review the detected delimiter and header setting. Preview values remain exact text.')
    .replace('Preview is limited to 1,000 columns, 2 Mi UTF-16 code units of names/cells and 4 Mi per raw record.', xlsx ? 'XLSX preview is limited to 256 columns and 1 Mi UTF-16 code units; wide rows are omitted completely. Full import retains supported data.' : 'Preview is limited to 1,000 columns, 2 Mi UTF-16 code units of names/cells and 4 Mi per raw record.')
    .replace('<div class="browser-toolbar"><button id="csv-cancel">', `${controls}<div class="browser-toolbar"><button id="csv-cancel">`)
    .replace('<button id="csv-cancel">', `<button id="csv-cancel"${fixed ? ' hidden' : ''}>`);
}
