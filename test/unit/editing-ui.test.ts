import { afterEach, expect, test, vi } from 'vitest';
import { EditingView } from '../../webview/editing-view';
import { isEditingRequest, isEditingState, type EditingRequest } from '../../src/protocol';
import { browserRoot } from './browser-dom';
import { sqliteEditorHtml } from '../../src/editor/sqlite-editor-ui';

afterEach(() => vi.unstubAllGlobals());

test('FR-020: Given a selected cell, When the browser is loading, Then editing controls cannot act on the old page and resume only after loading settles', () => {
  const root = browserRoot(['edit-mode', 'edit-save', 'edit-revert', 'edit-sql', 'edit-cell', 'edit-type', 'edit-value', 'edit-status', 'edit-selected', 'edit-cancel']);
  const sent: EditingRequest[] = [];
  const view = new EditingView(root as unknown as HTMLElement, (request) => { sent.push(request); }, () => 'UPDATE data SET value=1', () => {});
  view.receive({ type: 'editingState', revision: 1, writeMode: true, dirty: true, count: 1, busy: false, message: 'One staged edit' });
  view.select({ table: 'data', column: 'value', offset: 0, expected: 'old' });
  view.setBrowserBusy(true);
  for (const id of ['edit-mode', 'edit-save', 'edit-revert', 'edit-sql', 'edit-cell', 'edit-type', 'edit-value']) { expect(root.elements.get(id)?.disabled).toBe(true); }
  expect(root.elements.get('edit-cancel')?.disabled).toBe(true);
  root.elements.get('edit-cell')?.dispatchEvent(new Event('click'));
  root.elements.get('edit-save')?.dispatchEvent(new Event('click'));
  expect(sent).toEqual([]);
  view.setBrowserBusy(false);
  expect(root.elements.get('edit-cell')?.disabled).toBe(false); expect(root.elements.get('edit-save')?.disabled).toBe(false);
  root.elements.get('edit-cell')?.click(); expect(sent.at(-1)?.action).toBe('stage');
  view.dispose();
});

test('FR-020: Given an oversized cell or empty SQL, When staging from the UI, Then invalid transport is explained without sending it or leaving controls busy', () => {
  const root = browserRoot(['edit-mode', 'edit-save', 'edit-revert', 'edit-sql', 'edit-cell', 'edit-type', 'edit-value', 'edit-status', 'edit-selected', 'edit-cancel']);
  const sent: EditingRequest[] = [];
  const view = new EditingView(root as unknown as HTMLElement, (request) => { sent.push(request); }, () => '', () => {});
  view.receive({ type: 'editingState', revision: 1, writeMode: true, dirty: false, count: 0, busy: false, message: 'Write mode' });
  view.select({ table: 'data', column: 'value', offset: 0, expected: 'old' });
  const value = root.elements.get('edit-value'); if (value === undefined) { throw new Error('Missing input'); }
  value.value = 'x'.repeat(4 * 1024 * 1024 + 1); root.elements.get('edit-cell')?.click();
  expect(sent).toEqual([]); expect(root.elements.get('edit-status')?.textContent).toMatch(/4 Mi|limit/iu);
  expect(root.elements.get('edit-cell')?.disabled).toBe(false);
  root.elements.get('edit-sql')?.click(); expect(sent).toEqual([]); expect(root.elements.get('edit-sql')?.disabled).toBe(false);
  view.dispose();
});

test('FR-016: Given editing transport, When malformed or oversized requests arrive, Then only bounded typed actions are accepted', () => {
  const base = { type: 'editingRequest', contextId: '12345678-1234-1234-1234-123456789012', requestId: 1 };
  expect(isEditingRequest({ ...base, action: 'mode', on: true })).toBe(true);
  for (const message of [{ ...base, action: 'mode', on: 'yes' }, { ...base, action: 'save', requestId: -1 }, { ...base, action: 'stage', target: {} }, { ...base, action: 'sql', sql: 'x'.repeat(4 * 1024 * 1024 + 1) }, { ...base, action: 'something' }]) { expect(isEditingRequest(message)).toBe(false); }
  expect(isEditingState({ type: 'editingState', revision: 1, writeMode: false, dirty: false, count: 0, busy: false, message: 'Read-only' })).toBe(true);
});

test('FR-020: Given the SQLite shell, When rendering source versus imported data, Then only SQLite sources expose explicit editing and type controls', () => {
  const assets = { scriptUri: 'local:js', styleUri: 'local:css', nonce: 'n', cspSource: 'local:' };
  const html = sqliteEditorHtml('x', { phase: 'opened', message: 'Read-only' }, assets);
  for (const id of ['edit-mode', 'edit-save', 'edit-revert', 'edit-sql', 'edit-cell', 'edit-type', 'edit-value', 'edit-status']) { expect(html).toContain(`id="${id}"`); }
  expect(html).toContain('saved data until Save');
  expect(sqliteEditorHtml('x', { phase: 'opened', message: 'Read-only' }, assets, 'import')).not.toContain('id="edit-mode"');
});

test('FR-020: Given a selected Browse cell, When write mode is enabled and an exact integer is staged, Then the typed action uses the selected absolute row and busy controls prevent duplicates', () => {
  vi.stubGlobal('document', { createElement: () => { throw new Error('No dynamic HTML required'); } });
  const root = browserRoot(['edit-mode', 'edit-save', 'edit-revert', 'edit-sql', 'edit-cell', 'edit-type', 'edit-value', 'edit-status', 'edit-selected', 'edit-cancel']);
  const sent: EditingRequest[] = [];
  const view = new EditingView(root as unknown as HTMLElement, (request) => { sent.push(request); }, () => 'UPDATE data SET value=1', () => {});
  view.select({ table: 'data', column: 'id', offset: 101, expected: '42', grid: {} });
  expect(root.elements.get('edit-cell')?.disabled).toBe(true);
  root.elements.get('edit-cancel')?.click(); expect(sent.at(-1)?.action).toBe('cancel');
  view.receive({ type: 'editingState', revision: 1, writeMode: true, dirty: false, count: 0, busy: false, message: 'Write mode' });
  const type = root.elements.get('edit-type'); const input = root.elements.get('edit-value');
  if (type === undefined || input === undefined) { throw new Error('Missing controls'); }
  type.value = 'integer'; input.value = '9223372036854775807';
  root.elements.get('edit-cell')?.click();
  expect(sent.at(-1)).toMatchObject({ action: 'stage', target: { table: 'data', column: 'id', offset: 101, value: { kind: 'integer', text: '9223372036854775807' } } });
  expect(root.elements.get('edit-cell')?.disabled).toBe(true);
  view.dispose();
});
