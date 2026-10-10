import type { SqliteEditorState } from './sqlite-session';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function sqliteEditorHtml(name: string, state: SqliteEditorState): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Lite Voyager</title></head>
<body><h1>Lite Voyager</h1><p>${escapeHtml(name)}</p>
${state.mode === undefined ? '' : `<aside role="status" aria-label="Database engine mode"><strong>${escapeHtml(state.mode.notice)}</strong></aside>`}
<p role="${state.phase === 'error' ? 'alert' : 'status'}">${escapeHtml(state.message)}</p>
${state.phase === 'opened' ? '<p>Table browsing will be available in a later release.</p>' : ''}
</body></html>`;
}
