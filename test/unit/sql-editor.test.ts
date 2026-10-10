import { EditorState } from '@codemirror/state';
import { expect, test } from 'vitest';
import { selectedSql, SQL_RUN_KEY } from '../../webview/sql-editor';

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
