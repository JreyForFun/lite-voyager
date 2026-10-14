interface Assets { scriptUri: string; styleUri: string; nonce: string; cspSource: string; }
const escape = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export function csvPreviewHtml(name: string, contextId: string, assets: Assets): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${escape(assets.nonce)}'; style-src ${escape(assets.cspSource)}; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>CSV preview</title>
<link rel="stylesheet" href="${escape(assets.styleUri)}"></head><body>
<main id="csv-preview" data-context="${escape(contextId)}"><h1>CSV / TSV preview</h1><p>${escape(name)}</p>
<p>Read-only preview of up to 100 complete rows. Full import and SQL are not available yet.</p>
<p class="browser-help">CSV uses comma and TSV uses tab; the first row is the header. Values remain exact text.
Preview is limited to 1,000 columns, 2 Mi UTF-16 code units of names/cells and 4 Mi per raw record.
Limits stop the preview with a message; no cell is truncated. The remainder of the file is not validated.</p>
<div class="browser-toolbar"><button id="csv-cancel">Cancel preview</button><span id="csv-status" role="status" aria-live="polite">Reading the first records…</span></div>
<div class="browser-results"><section><div id="browser-grid" role="grid" tabindex="0" aria-label="CSV preview">
<div class="browser-header-clip"><div id="browser-header" role="row"></div></div>
<div id="browser-viewport"><div id="browser-track"><div id="browser-rows" role="rowgroup"></div></div></div></div>
<p class="browser-help">Click a cell or use arrow keys, Home/End and Ctrl/Cmd+End to inspect its complete value.
Missing fields, empty text and literal NULL are distinct.</p></section>
<aside aria-labelledby="csv-cell-title"><h2 id="csv-cell-title">Selected cell</h2><pre id="csv-cell-value">Select a cell to read its complete text.</pre></aside></div>
</main><script nonce="${escape(assets.nonce)}" src="${escape(assets.scriptUri)}"></script></body></html>`;
}
