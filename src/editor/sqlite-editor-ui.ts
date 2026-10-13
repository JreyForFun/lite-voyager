import type { SqliteEditorState } from './sqlite-session';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export interface SqliteEditorAssets { scriptUri: string; styleUri: string; nonce: string; cspSource: string; }

export function sqliteEditorHtml(name: string, state: SqliteEditorState, assets?: SqliteEditorAssets): string {
  const browser = state.phase === 'opened' && assets !== undefined;
  const csp = browser ? `default-src 'none'; script-src 'nonce-${assets.nonce}'; style-src ${assets.cspSource} 'nonce-${assets.nonce}'; base-uri 'none'; form-action 'none'`
    : "default-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp).replaceAll('&#39;', "'")}">
${browser ? `<meta name="style-nonce" content="${escapeHtml(assets.nonce)}"><link rel="stylesheet" href="${escapeHtml(assets.styleUri)}">` : ''}
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Lite Voyager</title></head>
<body><h1>Lite Voyager</h1><p>${escapeHtml(name)}</p>
${state.mode === undefined ? '' : `<aside role="status" aria-label="Database engine mode"><strong>${escapeHtml(state.mode.notice)}</strong></aside>`}
<p role="${state.phase === 'error' ? 'alert' : 'status'}">${escapeHtml(state.message)}</p>
${browser ? browserShell(assets) : ''}
</body></html>`;
}

function browserShell(assets: SqliteEditorAssets): string {
  return `<section id="browser" aria-label="Table browser">
<div class="sql-toolbar"><h2>SQL</h2><button id="sql-run" disabled>Run SQL</button><span>Ctrl/Cmd+Enter · selection or whole editor · read-only</span></div>
<div id="sql-editor"></div>
<div class="browser-toolbar" aria-label="Export query results"><button id="browser-export-csv" disabled>Export CSV</button>
<button id="browser-export-json" disabled>Export JSON</button></div>
<p class="browser-help">Export reruns the complete last successful query once, including all pages; changed files and nondeterministic SQL may give different results.
CSV uses UTF-8, comma-separated quoted fields, CRLF records and unquoted \\N for NULL; empty text is "" and literal \\N is quoted.
Consumers must honor this NULL convention. Spreadsheet formulas are exported literally.
JSON uses columns and row arrays; all non-NULL values are exact strings so 64-bit integers are never rounded by JSON parsers.
Stored JSON stays text. BLOBs export placeholders only; binary contents are omitted.
Cancel works until Saving begins; the final atomic save cannot be cancelled.</p>
<p id="sql-limit-status" role="status" aria-live="polite" hidden></p>
<p class="browser-help">Run one read-only statement. SQL transport and saved editor state have a 4-Mi-character limit (UTF-16 code units).
Results are paged; the exact total appears at the final page. Page time includes worker transport and offset traversal.
Use ORDER BY for predictable paging. Queries are rerun per page; nondeterministic SQL and external file changes may change results.
On an error, previous results remain. For oversized results, choose fewer rows and Run again.
Select a table or view to return to table browsing.</p>
<div class="browser-toolbar"><label for="browser-select">Table or view</label><select id="browser-select" disabled></select>
<button id="browser-browse" disabled>Browse table</button>
<button id="browser-list-previous" disabled>Previous objects</button><button id="browser-list-next" disabled>Next objects</button>
<span id="browser-list-status" role="status"></span></div>
<div class="browser-toolbar"><button id="browser-previous" disabled>Previous page</button><button id="browser-next" disabled>Next page</button>
<label for="browser-size">Rows per page</label><select id="browser-size"><option value="100">100</option><option value="10">10</option><option value="1">1</option></select>
<button id="browser-count" disabled>Count rows</button><button id="browser-cancel" disabled>Cancel operation</button>
<span id="browser-total">Total rows: not counted</span></div>
<div class="browser-toolbar" aria-label="Column filters">
<label for="browser-filter-column">Filter column</label><select id="browser-filter-column" disabled></select>
<label for="browser-filter-operator">Condition</label><select id="browser-filter-operator" disabled>
<option value="contains">Contains (case-sensitive)</option><option value="isNull">Is NULL</option><option value="isNotNull">Is not NULL</option></select>
<label for="browser-filter-value">Literal text</label><input id="browser-filter-value" type="text" disabled>
<button id="browser-filter-apply" disabled>Apply filter</button><button id="browser-filter-remove" disabled>Remove column filter</button>
<button id="browser-grid-clear" disabled>Clear sort and filters</button></div>
<p id="browser-grid-summary" role="status" aria-live="polite"></p>
<div class="browser-toolbar" aria-label="Sort confirmation"><span id="browser-sort-warning" role="alert" hidden></span>
<button id="browser-sort-continue" hidden disabled>Continue sort</button><button id="browser-sort-dismiss" hidden disabled>Dismiss sort</button></div>
<p id="browser-status" role="status" aria-live="polite">Loading tables and views…</p>
<div class="browser-results">
<div id="browser-grid" role="grid" tabindex="0" aria-label="Table rows" aria-readonly="true" aria-multiselectable="true">
<div class="browser-header-clip"><div id="browser-header" role="row" aria-rowindex="1"></div></div>
<div id="browser-viewport"><div id="browser-track"><div id="browser-rows"></div></div></div></div>
<aside id="cell-details" aria-labelledby="cell-title">
<h2 id="cell-title">Cell details</h2><p id="cell-kind"></p>
<pre id="cell-value" tabindex="0" aria-label="Complete cell value"></pre>
<div class="browser-toolbar"><button id="cell-copy-cell" disabled>Copy cell</button><button id="cell-copy-row" disabled>Copy row</button>
<button id="cell-copy-selection" disabled>Copy selection</button><button id="cell-cancel" disabled>Cancel preparation</button></div>
<p id="cell-status" role="status" aria-live="polite">Select a cell to see its complete value.</p>
<p class="browser-help">Copy as TSV: no headers; SQL NULL is \\N, empty text is "", and literal \\N is quoted.
Tabs, newlines and quotes inside fields use double-quote escaping. Copy keeps stored JSON text and BLOB placeholders.
Copy/JSON expansion is limited to 16 Mi characters; oversized JSON stays complete as raw text.
TSV consumers must honor quoting and the NULL token; spreadsheet formulas are copied literally.</p></aside></div>
<p class="browser-help">Embedded NUL text is rejected by Copy to avoid clipboard data loss; details retain the full raw value.</p>
<p class="browser-help">NULL is italic; empty strings show (empty). Long values are clipped visually; hover for their stored text.
Use arrow keys, Page Up/Down and Home/End in the grid; Control+End reaches the last cell on this page.
Click a cell to inspect it; Shift-click or Shift-navigation extends a rectangle on this page.
Ctrl/Cmd+A selects the loaded page; Ctrl/Cmd+C copies its selection. Page replacement clears selection.
Click a column header (or focus it and press Enter/Space) to cycle ascending, descending and unsorted.
Equal sort keys have no guaranteed tie order. Filters combine with AND; contains is literal and case-sensitive,
uses the stored numeric text and excludes BLOBs. Filter text is limited to 65,536 total UTF-16 characters across 1,000 columns.
If a page exceeds 4 MiB, choose fewer rows. No stored value is truncated.</p></section>
<script nonce="${escapeHtml(assets.nonce)}" src="${escapeHtml(assets.scriptUri)}"></script>`;
}
