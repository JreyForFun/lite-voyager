import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { sql, SQLite } from '@codemirror/lang-sql';
import { bracketMatching, syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';

export const SQL_RUN_KEY = 'Mod-Enter';
export function selectedSql(state: EditorState): string {
  const selection = state.selection.main;
  return selection.empty ? state.doc.toString() : state.sliceDoc(selection.from, selection.to);
}

export class SqlEditor {
  private readonly view: EditorView;
  private readonly events = new AbortController();

  constructor(private readonly root: HTMLElement, private readonly button: HTMLButtonElement, nonce: string,
    text: string, run: (sql: string) => void, changed: () => void, failed: () => void) {
    this.view = new EditorView({ parent: root, state: EditorState.create({ doc: text, extensions: [
      lineNumbers(), history(), drawSelection(), highlightActiveLine(), bracketMatching(),
      sql({ dialect: SQLite }), syntaxHighlighting(classHighlighter),
      keymap.of([{ key: SQL_RUN_KEY, run: () => { this.run(run); return true; } }, ...defaultKeymap, ...historyKeymap]),
      EditorView.cspNonce.of(nonce), EditorView.exceptionSink.of(failed),
      EditorView.contentAttributes.of({ 'aria-label': 'SQL editor', 'aria-multiline': 'true' }),
      EditorView.updateListener.of((update) => { if (update.docChanged || update.selectionSet) { changed(); } }),
      EditorView.theme({ '&': { color: 'var(--vscode-editor-foreground)', backgroundColor: 'var(--vscode-editor-background)' },
        '.cm-gutters': { color: 'var(--vscode-editorLineNumber-foreground)', backgroundColor: 'var(--vscode-editor-background)', border: 'none' },
        '.cm-activeLine': { backgroundColor: 'var(--vscode-editor-lineHighlightBackground)' },
        '.cm-cursor': { borderLeftColor: 'var(--vscode-editorCursor-foreground)' },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--vscode-editor-selectionBackground)' },
        '.cm-scroller': { fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 'var(--vscode-editor-font-size, 14px)' } }),
    ] }) });
    button.addEventListener('click', () => { this.run(run); }, { signal: this.events.signal });
  }

  private run(run: (sql: string) => void): void { if (!this.button.disabled) { run(selectedSql(this.view.state)); } }
  get text(): string { return this.view.state.doc.toString(); }
  metrics() {
    const selection = this.view.state.selection.main;
    return { editorReady: true, sqlLength: this.view.state.doc.length, selectionLength: selection.to - selection.from,
      highlighted: this.root.querySelector('.tok-keyword') !== null };
  }
  setDisabled(disabled: boolean): void { this.button.disabled = disabled; }
  setText(text: string): void { this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text }, selection: { anchor: 0 } }); }
  select(anchor: number, head: number): void {
    if (Number.isSafeInteger(anchor) && Number.isSafeInteger(head) && anchor >= 0 && head >= 0 && anchor <= this.view.state.doc.length && head <= this.view.state.doc.length) {
      this.view.dispatch({ selection: { anchor, head } });
    }
  }
  clickRun(): void { this.button.click(); }
  shortcut(): void {
    this.view.focus();
    // Exercise the real CodeMirror key handler on either platform in host tests.
    const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', ctrlKey: true, bubbles: true, cancelable: true });
    this.view.contentDOM.dispatchEvent(event);
    if (!event.defaultPrevented) {
      this.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
    }
  }
  dispose(): void { this.events.abort(); this.view.destroy(); }
}
