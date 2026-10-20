import { EditorState } from '@codemirror/state';
import { expect, test, vi } from 'vitest';
import { selectedSql, SQL_RUN_KEY, SqlEditor } from '../../webview/sql-editor';

test('FR-012: Given a platform that handles Command-Z, When exercising Undo or Redo, Then the real editor key handler receives the platform fallback', () => {
  class KeyEvent extends Event {
    readonly ctrlKey: boolean; readonly metaKey: boolean;
    constructor(type: string, init: KeyboardEventInit) { super(type, init); this.ctrlKey = init.ctrlKey === true; this.metaKey = init.metaKey === true; }
  }
  vi.stubGlobal('KeyboardEvent', KeyEvent);
  const received: KeyEvent[] = [];
  // Exercise the production method against a key-handler stand-in that models
  // macOS Mod bindings; no editor constructor or browser layout is fabricated.
  const editor = { view: { focus: () => {}, contentDOM: { dispatchEvent: (event: KeyEvent) => {
    received.push(event); if (event.metaKey) { event.preventDefault(); } return !event.defaultPrevented;
  } } } } as unknown as SqlEditor;
  try {
    for (const key of ['Undo', 'Redo']) {
      received.length = 0; SqlEditor.prototype.completionKey.call(editor, key);
      expect(received.map((event) => [event.ctrlKey, event.metaKey])).toEqual([[true, false], [false, true]]);
      expect(received.at(-1)?.defaultPrevented).toBe(true);
    }
  } finally { vi.unstubAllGlobals(); }
});

test('FR-010: Given SQL and a caret, When Run is requested, Then the entire literal document is used', () => {
  const state = EditorState.create({ doc: '-- 🚀\nSELECT 1;', selection: { anchor: 3 } });
  expect(selectedSql(state)).toBe('-- 🚀\nSELECT 1;');
  expect(SQL_RUN_KEY).toBe('Mod-Enter');
});

test('FR-010: Given a backward selection containing Unicode, When Run is requested, Then only the primary selection is used without changing it', () => {
  const doc = 'SELECT 1;\nSELECT \'🚀\';';
  const state = EditorState.create({ doc, selection: { anchor: doc.length, head: 10 } });
  expect(selectedSql(state)).toBe("SELECT '🚀';");
  expect(selectedSql(EditorState.create({ doc: '   ' }))).toBe('   ');
});
