import { afterEach, expect, test, vi } from 'vitest';
import { SqliteBrowser } from '../../src/editor/sqlite-browser';
import type { Engine } from '../../src/engine/engine';
import { isBrowserRequest, isBrowserResponse, type BrowserResponse } from '../../src/protocol';
import { BrowserElement, browserRoot } from './browser-dom';
afterEach(() => vi.unstubAllGlobals());
test('FR-013: Given an explicit SQL run cancelled before completion, When the worker rejects it, Then no history entry is recorded', async () => {
  let rejectQuery!: (error: Error) => void;
  const engine = { query: () => new Promise((_resolve, reject) => { rejectQuery = reject; }), cancel: () => { rejectQuery(new Error('cancelled')); return Promise.resolve(); } } as unknown as Engine;
  const browser = new SqliteBrowser(engine); const history = { record: vi.fn<((sql: string) => Promise<void>)>(), list: () => Promise.resolve([]), read: () => Promise.resolve(''), clear: () => Promise.resolve() };
  browser.setHistory(history); const run = browser.handle({ type: 'browserQuery', requestId: 1, sql: 'SELECT slow', offset: 0, limit: 1, remember: true }, () => {});
  await browser.handle({ type: 'browserCancel', requestId: 2 }, () => {}); await run; expect(history.record).not.toHaveBeenCalled(); browser.dispose();
});
test('FR-013: Given successful, paged and failed SQL, When handled by the browser, Then only explicit successful runs are recorded and storage failure preserves results', async () => {
  const query = vi.fn<Engine['query']>().mockResolvedValue({ columns: ['x'], rows: [['1']], hasMore: false });
  const browser = new SqliteBrowser({ query } as unknown as Engine);
  const history = { record: vi.fn<((sql: string) => Promise<void>)>().mockResolvedValue(undefined), list: () => Promise.resolve([]), read: () => Promise.resolve('SELECT 1'), clear: () => Promise.resolve() };
  browser.setHistory(history); const messages: BrowserResponse[] = []; const send = (message: BrowserResponse) => { messages.push(message); };
  await browser.handle({ type: 'browserQuery', requestId: 1, sql: ' SELECT 1 ', offset: 0, limit: 1, remember: true }, send);
  await browser.handle({ type: 'browserQuery', requestId: 2, sql: ' SELECT 1 ', offset: 1, limit: 1 }, send);
  query.mockRejectedValueOnce(new Error('SQL error'));
  await browser.handle({ type: 'browserQuery', requestId: 3, sql: 'bad', offset: 0, limit: 1, remember: true }, send);
  expect(history.record.mock.calls).toEqual([[' SELECT 1 ']]);
  history.record.mockRejectedValueOnce(new Error('disk full'));
  await browser.handle({ type: 'browserQuery', requestId: 4, sql: 'SELECT 2', offset: 0, limit: 1, remember: true }, send);
  const last = messages.at(-1); expect(last?.type).toBe('browserQueryRows'); expect(last?.type === 'browserQueryRows' ? last.historyError : '').toContain('history');
});
test('FR-013: Given bounded history transport, When validating malformed IDs, lists or SQL, Then only exact typed messages are accepted', () => {
  expect(isBrowserRequest({ type: 'browserHistory', requestId: 1, action: 'list' })).toBe(true);
  expect(isBrowserRequest({ type: 'browserHistory', requestId: 1, action: ['clear'] })).toBe(false);
  expect(isBrowserRequest({ type: 'browserHistory', requestId: 1, action: 'load', id: '../outside' })).toBe(false);
  expect(isBrowserRequest({ type: 'browserQuery', requestId: 1, sql: 'SELECT 1', offset: 0, limit: 1, remember: 'yes' })).toBe(false);
  const entry = { id: 'a'.repeat(32), preview: '<script>', length: 8 };
  expect(isBrowserResponse({ type: 'browserHistoryEntries', requestId: 1, entries: [entry] })).toBe(true);
  expect(isBrowserResponse({ type: 'browserHistoryEntries', requestId: 1, entries: Array.from({ length: 51 }, () => entry) })).toBe(false);
  expect(isBrowserResponse({ type: 'browserHistorySql', requestId: 1, sql: 'x'.repeat(4 * 1024 * 1024 + 1) })).toBe(false);
});
test('FR-013: Given history with literal previews, When loading and clearing through keyboard-accessible controls, Then full SQL loads without execution and requests stay bounded', async () => {
  const { HistoryView } = await import('../../webview/history-view');
  vi.stubGlobal('document', { createElement: () => new BrowserElement() });
  const root = browserRoot(['history-show', 'history-panel', 'history-select', 'history-load', 'history-clear', 'history-status']);
  const sent: unknown[] = []; const loaded: string[] = [];
  const view = new HistoryView(root as unknown as HTMLElement, action => { sent.push(action); }, sql => { loaded.push(sql); });
  root.elements.get('history-show')?.click(); expect(sent.at(-1)).toEqual({ action: 'list' });
  view.receive({ type: 'browserHistoryEntries', requestId: 1, entries: [{ id: 'a'.repeat(32), preview: '<script>', length: 12 }] });
  root.elements.get('history-select')!.value = 'a'.repeat(32); root.elements.get('history-load')?.click();
  expect(sent.at(-1)).toEqual({ action: 'load', id: 'a'.repeat(32) }); expect(loaded).toEqual([]);
  view.receive({ type: 'browserHistorySql', requestId: 2, sql: ' SELECT 42; ' }); expect(loaded).toEqual([' SELECT 42; ']);
  root.elements.get('history-clear')?.click(); expect(sent.at(-1)).toEqual({ action: 'clear' }); view.dispose();
});
const historyIds = ['history-show', 'history-panel', 'history-select', 'history-load', 'history-clear', 'history-status'];
test('FR-013: Given a stored preview, When listed, Then the option shows it verbatim with its length and adds no ellipsis of its own', async () => {
  const { HistoryView } = await import('../../webview/history-view');
  vi.stubGlobal('document', { createElement: () => new BrowserElement() }); const root = browserRoot(historyIds);
  const view = new HistoryView(root as unknown as HTMLElement, () => {}, () => {});
  view.receive({ type: 'browserHistoryEntries', requestId: 1, entries: [{ id: 'a'.repeat(32), preview: 'SELECT * FROM t', length: 19 }, { id: 'b'.repeat(32), preview: 'SELECT long…', length: 400 }] });
  expect(root.elements.get('history-select')?.children.map(option => option.textContent)).toEqual(['1. SELECT * FROM t (19 characters)', '2. SELECT long… (400 characters)']);
  view.dispose();
});
test('FR-013: Given history that cannot be read, When the error reaches the history panel, Then it is shown there and Clear stays available for recovery', async () => {
  const { HistoryView } = await import('../../webview/history-view');
  vi.stubGlobal('document', { createElement: () => new BrowserElement() }); const root = browserRoot(historyIds); const sent: unknown[] = [];
  const view = new HistoryView(root as unknown as HTMLElement, action => { sent.push(action); }, () => {});
  root.elements.get('history-show')?.click(); view.setBusy(true);
  view.failed('Query history is unreadable or invalid. Its stored files were preserved.');
  expect(root.elements.get('history-status')?.textContent).toBe('Query history is unreadable or invalid. Its stored files were preserved. Clear this history to start over.');
  expect(root.elements.get('history-clear')?.disabled).toBe(false); expect(root.elements.get('history-load')?.disabled).toBe(true);
  root.elements.get('history-clear')?.click(); expect(sent.at(-1)).toEqual({ action: 'clear' }); view.dispose();
});
test('FR-013: Given unreadable history storage, When the host lists it, Then the error is reported without the page-size retry hint', async () => {
  const browser = new SqliteBrowser({} as unknown as Engine); const detail = 'Query history is unreadable or invalid. Its stored files were preserved.';
  browser.setHistory({ record: () => Promise.resolve(), list: () => Promise.reject(new Error(detail)), read: () => Promise.resolve(''), clear: () => Promise.resolve() });
  const messages: BrowserResponse[] = []; await browser.handle({ type: 'browserHistory', requestId: 1, action: 'list' }, message => { messages.push(message); });
  expect(messages.at(-1)).toEqual({ type: 'browserError', requestId: 1, message: detail }); browser.dispose();
});
