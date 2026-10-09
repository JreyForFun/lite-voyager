import { SPIKE_PAGE_SIZE, SPIKE_ROW_COUNT, type SpikePage, type SpikePageRequest } from './protocol';

export function createSpikePage(request: SpikePageRequest): SpikePage {
  const rows = Array.from({ length: Math.min(SPIKE_PAGE_SIZE, SPIKE_ROW_COUNT - request.offset) }, (_, index) => {
    const row = request.offset + index;
    return [String(row + 1), String(9007199254740993n + BigInt(row)), `Row ${row + 1}`,
      '東京 🚀', '<script>alert("demo")</script>', '[BLOB 24 KB]'];
  });
  return { type: 'spikePage', requestId: request.requestId, offset: request.offset, rows };
}

function attribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
export function spikeHtml(source: string, script: string, style: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${attribute(nonce)}'; style-src ${attribute(source)} 'nonce-${attribute(nonce)}';">
<meta name="style-nonce" content="${attribute(nonce)}">
<link rel="stylesheet" href="${attribute(style)}"><title>T-008 editor and grid spike</title></head>
<body><h1>Editor &amp; grid spike</h1>
<p>CodeMirror 6 · 10,000,000 synthetic rows · No files opened or modified.</p>
<label id="editor-label">SQL editor — type, select text, and try undo</label><div id="editor" aria-labelledby="editor-label"></div>
<p class="hint">This editor is for usability testing. SQL execution follows in T-013.</p>
<form id="jump-form"><label for="jump-row">Jump to row</label> <input id="jump-row" type="number" min="1" max="10000000" value="1" required>
<button type="submit">Go</button><button type="button" id="first">First</button><button type="button" id="middle">Middle</button><button type="button" id="last">Last</button></form>
<div id="status" role="status">Loading editor and synthetic rows…</div>
<div id="grid" role="grid" aria-label="Synthetic data grid" aria-rowcount="10000001" aria-colcount="6" tabindex="0">
<div id="grid-header" role="row" aria-rowindex="1"></div><div id="viewport"><div id="track"><div id="rows"></div></div></div></div>
<p class="hint">Focus the grid: ↑/↓ and Page Up/Down scroll; Home/End reach the first/last row. Use Shift + wheel for horizontal scrolling.</p>
<script nonce="${attribute(nonce)}" src="${attribute(script)}"></script></body></html>`;
}
