export function sourceChangeShell(): string {
  return `<section id="source-changes" hidden aria-label="Source file changes"><p id="source-status" role="status" aria-live="polite"></p>
<div class="browser-toolbar"><button id="source-refresh" disabled>Refresh from disk</button><button id="source-keep" disabled>Keep current view</button></div></section>`;
}
