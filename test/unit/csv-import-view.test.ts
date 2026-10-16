import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CsvImportView } from '../../webview/csv-import';
import { BrowserElement, browserRoot } from './browser-dom';

const contextId = '1'.repeat(32); const post = vi.fn();
let root: BrowserElement; let view: CsvImportView;
const element = (name: string): BrowserElement => { const value = root.elements.get(name); if (value === undefined) { throw new Error('Missing element'); } return value; };
beforeEach(() => {
  post.mockClear(); root = browserRoot(['browser-grid', 'csv-status', 'csv-cancel', 'csv-cell-title', 'csv-cell-value',
    'import-delimiter', 'import-header', 'import-text', 'import-refresh', 'import-start', 'import-cancel', 'import-status', 'import-progress']);
  root.elements.set('browser-grid', browserRoot(['browser-viewport', 'browser-track', 'browser-rows', 'browser-header']));
  vi.stubGlobal('document', { createElement: () => new BrowserElement() });
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
  view = new CsvImportView(root as unknown as HTMLElement, contextId, post);
});
afterEach(() => { view.dispose(); vi.unstubAllGlobals(); });
const ready = { type: 'csvImportState', contextId, phase: 'ready', message: 'ready', options: { delimiter: ',', header: true },
  preview: { columns: ['a'], rows: [['1']], delimiter: ',', header: true, bytesRead: '4', totalBytes: '4', reachedEnd: true, notice: '', threadId: 1 } };

test('FR-005: Given JSON controls, When retrying preview and starting import, Then only empty JSON options are sent and exact preview rows render', () => {
  view.dispose(); root.setAttribute('data-format', 'json'); view = new CsvImportView(root as unknown as HTMLElement, contextId, post);
  view.receive({ ...ready, options: {}, preview: { columns: ['a'], rows: [['9007199254740993']], format: 'json', bytesRead: '30', totalBytes: '30', reachedEnd: true, notice: '', threadId: 1 } });
  expect(view.preview.grid.metrics().cachedRows).toBe(1); expect(element('import-start').disabled).toBe(false);
  element('import-refresh').click(); expect(post).toHaveBeenLastCalledWith({ type: 'csvImportRefresh', contextId, options: {} });
});

test('FR-005: Given a JSON preview failure, When showing the error then retrying, Then inner status stops loading and preview recovers without a stale cancel control', () => {
  view.receive({ type: 'csvImportState', contextId, phase: 'error', options: {}, message: 'Malformed JSON. Retry preview.' });
  expect(element('csv-status').textContent).toBe('Malformed JSON. Retry preview.'); expect(element('csv-cancel').disabled).toBe(true);
  view.receive(ready); expect(view.preview.grid.metrics().cachedRows).toBe(1); expect(element('csv-status').textContent).toBe('');
});
test('FR-004: Given ready controls, When changing options, Then import locks until a refreshed preview and the header/text selections are sent literally', () => {
  view.receive(ready); expect(element('import-start').disabled).toBe(false);
  element('import-delimiter').value = ';'; Object.assign(element('import-header'), { checked: false }); Object.assign(element('import-text'), { checked: true });
  element('import-delimiter').dispatchEvent(new Event('change')); element('import-start').click();
  expect(post).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'csvImportStart' }));
  element('import-refresh').click(); expect(post).toHaveBeenLastCalledWith({ type: 'csvImportRefresh', contextId, options: { delimiter: ';', header: false, allText: true } });
  view.receive({ ...ready, options: { delimiter: ';', header: false, allText: true }, preview: { ...ready.preview, delimiter: ';', header: false } });
  element('import-start').click(); expect(post).toHaveBeenLastCalledWith({ type: 'csvImportStart', contextId });
});
test('FR-004: Given byte progress and retained preview, When importing or cancelling, Then options lock, counters stay exact and stale messages do not revive the view', () => {
  view.receive(ready); view.receive({ type: 'csvImportState', contextId, phase: 'importing', options: {}, message: '9007199254740993 bytes',
    progress: { bytes: '9007199254740993', totalBytes: '18014398509481986', rows: '1', engine: 'node:sqlite', phase: 'reading', notice: '' } });
  expect(element('import-delimiter').disabled).toBe(true); expect(Number(element('import-progress').value)).toBe(50);
  expect(view.preview.grid.metrics().cachedRows).toBe(1); expect(element('import-status').textContent).toContain('9007199254740993');
  element('import-cancel').click(); expect(post).toHaveBeenLastCalledWith({ type: 'csvImportCancel', contextId });
  view.receive({ type: 'csvImportState', contextId, phase: 'cancelled', options: {}, message: 'cancelled' }); view.receive(ready);
  expect(element('import-status').textContent).toBe('cancelled'); expect(element('import-start').disabled).toBe(true);
});
