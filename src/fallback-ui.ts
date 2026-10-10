import type { EngineMode } from './engine/engine';

export function fallbackPrompt(mode: EngineMode): string {
  return `Memory-limited mode loads this ${mode.bytes}-byte file into memory. It is above 200 MB (200,000,000 bytes), and memory use can exceed the file size. To use the disk-backed engine, update VS Code or use a supported host with Node 22+ and node:sqlite available. Choose Proceed to load it, or Cancel to leave it unloaded.`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** Script-free status panel: source names and error text never become executable HTML. */
export function engineHtml(mode: EngineMode | undefined, status: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Lite Voyager Engine check</title></head>
<body><h1>Lite Voyager Engine check</h1>
${mode === undefined ? '' : `<aside role="status" aria-label="Database engine mode"><strong>${escapeHtml(mode.notice)}</strong></aside>`}
<p role="status">${escapeHtml(status)}</p><p>This panel validates T-009. The SQLite editor follows in T-010.</p></body></html>`;
}
