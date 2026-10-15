import { expect, test } from 'vitest';
import { isHostMessage, isSqliteSaveRequest, isSqliteSaveState, isWebviewMessage } from '../../src/protocol';
import { sqliteEditorHtml } from '../../src/editor/sqlite-editor-ui';

test('FR-007: Given an imported browser, When rendering, Then Save as SQLite has a scoped accessible button and cancel status', () => {
  const html = sqliteEditorHtml('source.csv', { phase: 'opened', message: 'Imported' }, { scriptUri: '/browser.js', styleUri: '/browser.css', nonce: 'safe', cspSource: 'local:' }, 'a'.repeat(32));
  expect(html).toContain('id="sqlite-save"'); expect(html).toContain('Save as SQLite'); expect(html).toContain('id="sqlite-save-cancel"');
  expect(html).toContain('id="sqlite-save-status"'); expect(html).toContain('data-save-context="' + 'a'.repeat(32) + '"');
  expect(html).toContain('entire imported database');
  expect(sqliteEditorHtml('source.db', { phase: 'opened', message: 'Opened' }, { scriptUri: '/browser.js', styleUri: '/browser.css', nonce: 'safe', cspSource: 'local:' })).not.toContain('id="sqlite-save"');
});
test('FR-007: Given save messages, When validating transport, Then exact scoped requests and bounded decimal progress are accepted', () => {
  const contextId = 'a'.repeat(32);
  for (const type of ['sqliteSave', 'sqliteSaveCancel', 'sqliteSaveReady']) {
    const request = { type, contextId }; expect(isSqliteSaveRequest(request)).toBe(true); expect(isWebviewMessage(request)).toBe(true);
  }
  const state = { type: 'sqliteSaveState', contextId, phase: 'copying', message: 'Copying', bytes: '9007199254740993', total: '9007199254740994' };
  expect(isSqliteSaveState(state)).toBe(true); expect(isHostMessage(state)).toBe(true);
  for (const changed of [{ contextId: '../' }, { phase: 'unknown' }, { bytes: '-1' }, { total: 3 }, { message: 'x'.repeat(4097) }]) {
    expect(isSqliteSaveState({ ...state, ...changed })).toBe(false);
  }
  expect(isSqliteSaveRequest({ type: 'sqliteSave', contextId: 'wrong' })).toBe(false);
});
