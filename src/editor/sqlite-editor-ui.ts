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
${browser ? `<link rel="stylesheet" href="${escapeHtml(assets.styleUri)}">` : ''}
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Lite Voyager</title></head>
<body><h1>Lite Voyager</h1><p>${escapeHtml(name)}</p>
${state.mode === undefined ? '' : `<aside role="status" aria-label="Database engine mode"><strong>${escapeHtml(state.mode.notice)}</strong></aside>`}
<p role="${state.phase === 'error' ? 'alert' : 'status'}">${escapeHtml(state.message)}</p>
${browser ? browserShell(assets) : ''}
</body></html>`;
}

function browserShell(assets: SqliteEditorAssets): string {
  return `<section id="browser" aria-label="Table browser">
<div class="browser-toolbar"><label for="browser-select">Table or view</label><select id="browser-select" disabled></select>
<button id="browser-list-previous" disabled>Previous objects</button><button id="browser-list-next" disabled>Next objects</button>
<span id="browser-list-status" role="status"></span></div>
<div class="browser-toolbar"><button id="browser-previous" disabled>Previous page</button><button id="browser-next" disabled>Next page</button>
<label for="browser-size">Rows per page</label><select id="browser-size"><option value="100">100</option><option value="10">10</option><option value="1">1</option></select>
<button id="browser-count" disabled>Count rows</button><button id="browser-cancel" disabled>Cancel operation</button>
<span id="browser-total">Total rows: not counted</span></div>
<p id="browser-status" role="status" aria-live="polite">Loading tables and views…</p>
<div id="browser-grid" role="grid" tabindex="0" aria-label="Table rows" aria-readonly="true">
<div class="browser-header-clip"><div id="browser-header" role="row" aria-rowindex="1"></div></div>
<div id="browser-viewport"><div id="browser-track"><div id="browser-rows"></div></div></div></div>
<p class="browser-help">NULL is italic; empty strings show (empty). Long values are clipped visually; hover for their stored text.
Use arrow keys, Page Up/Down and Home/End in the grid; Control+End reaches the last cell on this page.
If a page exceeds 4 MiB, choose fewer rows. No stored value is truncated.</p></section>
<script nonce="${escapeHtml(assets.nonce)}" src="${escapeHtml(assets.scriptUri)}"></script>`;
}
