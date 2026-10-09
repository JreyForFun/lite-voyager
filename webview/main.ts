import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { sql, SQLite } from '@codemirror/lang-sql';
import { bracketMatching, syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';
import { isHostMessage, SPIKE_ROW_COUNT, type WebviewToHostMessage } from '../src/protocol';
import { VirtualGrid } from './virtual-grid';
import './spike.css';

interface WebviewApi {
  postMessage(message: WebviewToHostMessage): void;
}

declare function acquireVsCodeApi(): WebviewApi;

const vscode = acquireVsCodeApi();
const status = document.getElementById('status');
const editorRoot = document.getElementById('editor');
const gridRoot = document.getElementById('grid');
const jump = document.getElementById('jump-row');
const form = document.getElementById('jump-form');
if (status !== null && editorRoot !== null && gridRoot !== null && jump instanceof HTMLInputElement && form !== null) {
  let editor: EditorView | undefined;
  let grid: VirtualGrid | undefined;
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const fail = (): void => {
    const message = 'Unable to initialize the editor/grid spike. Close it, rebuild with npm run build, and reopen it.';
    if (grid !== undefined) { grid.error(message); } else { status.textContent = message; }
  };
  try {
    const nonce = document.querySelector<HTMLMetaElement>('meta[name="style-nonce"]')?.content;
    if (nonce === undefined) { throw new Error('Missing style nonce'); }
    editor = new EditorView({ parent: editorRoot, state: EditorState.create({
      doc: '-- T-008: edit this SQL; the grid contains synthetic data.\nSELECT "Exact int64", "Name"\nFROM demo\nWHERE "Row" > 100;\n',
      extensions: [lineNumbers(), history(), drawSelection(), highlightActiveLine(), bracketMatching(),
        sql({ dialect: SQLite }), syntaxHighlighting(classHighlighter),
        keymap.of([...defaultKeymap, ...historyKeymap]), EditorView.cspNonce.of(nonce),
        EditorView.contentAttributes.of({ 'aria-label': 'SQL editor', 'aria-multiline': 'true' }),
        EditorView.exceptionSink.of(fail),
        EditorView.theme({ '&': { color: 'var(--vscode-editor-foreground)', backgroundColor: 'var(--vscode-editor-background)' },
          '.cm-gutters': { color: 'var(--vscode-editorLineNumber-foreground)', backgroundColor: 'var(--vscode-editor-background)', border: 'none' },
          '.cm-activeLine': { backgroundColor: 'var(--vscode-editor-lineHighlightBackground)' },
          '.cm-cursor': { borderLeftColor: 'var(--vscode-editorCursor-foreground)' },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--vscode-editor-selectionBackground)' },
          '.cm-scroller': { fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 'var(--vscode-editor-font-size, 14px)' } }),
      ],
    }) });
    const activeGrid = new VirtualGrid(gridRoot, status, (message) => vscode.postMessage(message));
    grid = activeGrid;
    window.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (!isHostMessage(event.data)) { return; }
      switch (event.data.type) {
        case 'spikeInit': activeGrid.initialize(event.data.rowCount); break;
        case 'spikePage': activeGrid.receive(event.data); break;
        case 'error': activeGrid.error(event.data.message); break;
      }
    }, options);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const row = Number(jump.value);
      if (Number.isSafeInteger(row) && row >= 1 && row <= SPIKE_ROW_COUNT) { activeGrid.jump(row); }
      else { status.textContent = 'Enter a whole row number from 1 to 10,000,000.'; }
    }, options);
    for (const [id, row] of [['first', 1], ['middle', 5_000_000], ['last', SPIKE_ROW_COUNT]] as const) {
      document.getElementById(id)?.addEventListener('click', () => { jump.value = String(row); activeGrid.jump(row); }, options);
    }
    vscode.postMessage({ type: 'ready' });
  } catch { fail(); }
  window.addEventListener('pagehide', () => { listeners.abort(); grid?.dispose(); editor?.destroy(); }, { once: true });
}
