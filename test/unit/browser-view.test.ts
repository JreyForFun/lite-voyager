import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BrowserView, readSavedState } from '../../webview/sqlite-browser';
import { BrowserElement, browserRoot } from './browser-dom';
import { isBrowserStatus, isBrowserExercise, type BrowserRequest, type BrowserStatus, type CellRequest } from '../../src/protocol';

let view: BrowserView;
let root: BrowserElement;
let sent: (BrowserRequest | BrowserStatus | CellRequest)[];
let frames: FrameRequestCallback[];
const flush = (): void => { const queued = frames; frames = []; for (const callback of queued) { callback(0); } };
const requests = () => sent.filter((message): message is BrowserRequest => message.type.startsWith('browser') && message.type !== 'browserStatus');

test('FR-012: Given successful SQL, When metadata completes or is superseded, Then result/export state survives and stale suggestions settle empty', async () => {
  view.runSql('SELECT 42');
  view.receive({ type: 'browserQueryRows', requestId: 2, offset: 0, limit: 100, ms: 1, page: { columns: ['v'], rows: [['42']], hasMore: false } });
  const first = view.complete({ prefix: 'r', tables: [], includeTables: true });
  const second = view.complete({ prefix: 're', tables: [], includeTables: true });
  expect(await first).toBeUndefined();
  view.receive({ type: 'browserCompletions', requestId: 3, items: [{ name: 'stale', kind: 'table', table: '' }], hasMore: false });
  view.receive({ type: 'browserCompletions', requestId: 4, items: [{ name: 'records', kind: 'table', table: '' }], hasMore: false });
  expect(await second).toEqual({ items: [{ name: 'records', kind: 'table', table: '' }], hasMore: false });
  expect(view.savedState().querySql).toBe('SELECT 42');
  expect(root.elements.get('browser-export-csv')?.disabled).toBe(false);
  const pending = view.complete({ prefix: '', tables: [], includeTables: true });
  view.dispose(); expect(await pending).toBeUndefined();
});

test('FR-012: Given active database work, When completion is requested, Then it does not supersede work; Run supersedes metadata safely', async () => {
  expect(await view.complete({ prefix: '', tables: [], includeTables: true })).toBeUndefined();
  expect(requests()).toHaveLength(1);
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [], hasMore: false });
  const pending = view.complete({ prefix: 'x', tables: [], includeTables: true });
  view.runSql('SELECT 1'); expect(await pending).toBeUndefined();
  expect(requests().at(-1)?.type).toBe('browserQuery');
});

test('FR-012: Given a pending slow-sort confirmation, When autocomplete is requested, Then the warning and staged sort are retained', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['v'], rows: [['old']], hasMore: true } });
  view.exercise({ type: 'browserExercise', action: 'sort', value: 'v' });
  view.receive({ type: 'browserSortWarning', requestId: 3, table: 'data', message: 'Slow sort requires confirmation.' });
  const count = requests().length;
  void view.complete({ prefix: 'v', tables: ['data'], includeTables: false });
  expect(requests()).toHaveLength(count);
  expect(root.elements.get('browser-sort-continue')?.hidden).toBe(false);
});

test('FR-012: Given a running SQL request, When an unsolicited completion reply arrives, Then SQL remains pending', () => {
  view.runSql('SELECT 1');
  view.receive({ type: 'browserCompletions', requestId: 2, items: [], hasMore: false });
  expect(root.attributes.get('aria-busy')).toBe('true');
  view.receive({ type: 'browserQueryRows', requestId: 2, offset: 0, limit: 100, ms: 1, page: { columns: ['v'], rows: [['1']], hasMore: false } });
  expect(view.savedState().querySql).toBe('SELECT 1');
});

test('FR-012: Given a selected table, When completing a FROM name versus an unqualified column, Then only column context uses the selected schema', async () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['v'], rows: [['old']], hasMore: false } });
  const table = view.complete({ prefix: '', tables: [], includeTables: true, useSelectedTable: false });
  expect(requests().at(-1)).toMatchObject({ tables: [] });
  view.receive({ type: 'browserCompletions', requestId: 3, items: [], hasMore: false }); await table;
  const column = view.complete({ prefix: '', tables: [], includeTables: true, useSelectedTable: true });
  expect(requests().at(-1)).toMatchObject({ tables: ['data'] });
  view.receive({ type: 'browserCompletions', requestId: 4, items: [], hasMore: false }); await column;
});
test('NFR-005: Given a local QA exercise, When appearance is sampled, Then only bounded computed theme colors are reported', () => {
  vi.stubGlobal('getComputedStyle', () => ({ color: 'rgb(0, 0, 0)', backgroundColor: 'rgb(255, 255, 255)' }));
  vi.stubGlobal('document', { createElement: () => new BrowserElement(), body: { className: 'vscode-light' } });
  view.exercise({ type: 'browserExercise', action: 'appearance', exerciseId: 1 });
  expect(sent.at(-1)).toMatchObject({ appearance: { theme: 'vscode-light', foreground: 'rgb(0, 0, 0)', background: 'rgb(255, 255, 255)' } });
});
beforeEach(() => {
  root = browserRoot(['browser-grid', 'browser-viewport', 'browser-track', 'browser-rows', 'browser-header', 'browser-select', 'browser-list-previous', 'browser-list-next', 'browser-previous', 'browser-next', 'browser-count', 'browser-cancel', 'browser-size', 'browser-status', 'browser-total', 'browser-list-status', 'browser-browse', 'sql-limit-status']);
  for (const id of ['browser-export-csv', 'browser-export-json']) { root.elements.set(id, new BrowserElement()); }
  for (const id of ['browser-filter-column', 'browser-filter-operator', 'browser-filter-value', 'browser-filter-apply', 'browser-filter-remove', 'browser-grid-clear', 'browser-grid-summary', 'browser-sort-warning', 'browser-sort-continue', 'browser-sort-dismiss']) { root.elements.set(id, new BrowserElement()); }
  root.elements.get('browser-filter-operator')?.setAttribute('value', 'contains');
  for (const id of ['cell-details', 'cell-title', 'cell-kind', 'cell-value', 'cell-status', 'cell-copy-cell', 'cell-copy-row', 'cell-copy-selection', 'cell-cancel']) { root.elements.set(id, new BrowserElement()); }
  const operator = root.elements.get('browser-filter-operator'); if (operator !== undefined) { operator.value = 'contains'; }
  root.elements.get('browser-grid')?.elements.clear();
  const grid = root.elements.get('browser-grid');
  if (grid === undefined) { throw new Error('Missing grid'); }
  for (const id of ['browser-viewport', 'browser-track', 'browser-rows', 'browser-header']) {
    const value = root.elements.get(id);
    if (value !== undefined) { grid.elements.set(id, value); }
  }
  frames = []; sent = [];
  vi.stubGlobal('document', { createElement: () => new BrowserElement() });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
  view = new BrowserView(root as unknown as HTMLElement, (message) => { sent.push(message); });
  view.start();
});

test.each(['browserError', 'browserCancelled'] as const)('FR-002: Given a successful ten-row page, When a larger page replacement fails with %s, Then successful size and subsequent navigation survive without skipping rows', (type) => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['v'], rows: [['old']], hasMore: true } });
  view.exercise({ type: 'browserExercise', action: 'size', value: '10' });
  view.receive({ type: 'browserRows', requestId: 3, table: 'data', offset: 0, limit: 10, page: { columns: ['v'], rows: Array.from({ length: 10 }, () => ['old']), hasMore: true } });
  view.exercise({ type: 'browserExercise', action: 'size', value: '100' });
  if (type === 'browserError') { view.receive({ type, requestId: 4, message: 'Page exceeds 4 MiB.' }); }
  else { view.exercise({ type: 'browserExercise', action: 'cancel' }); view.receive({ type, requestId: 5 }); }
  expect(view.savedState().limit).toBe(10); expect(root.elements.get('browser-size')?.value).toBe('10');
  view.exercise({ type: 'browserExercise', action: 'next' });
  expect(requests().at(-1)).toMatchObject({ type: 'browserPage', offset: 10, limit: 10 });
});

test('FR-014: Given successful SQL results, When exporting, Then counters remain busy until commit, Cancel disables during Saving and the page survives', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['v'], rows: [['old']], hasMore: true } });
  expect(root.elements.get('browser-export-csv')?.disabled).toBe(true);
  view.runSql('SELECT 42');
  view.receive({ type: 'browserQueryRows', requestId: 3, offset: 0, limit: 100, ms: 1, page: { columns: ['v'], rows: [['42']], hasMore: true } }); flush();
  root.elements.get('browser-export-json')?.click();
  expect(requests().at(-1)).toEqual({ type: 'browserExport', requestId: 4, format: 'json' });
  view.receive({ type: 'browserExportProgress', requestId: 4, phase: 'writing', rows: '200', bytes: '65536', blobs: '2' });
  expect(root.elements.get('browser-status')?.textContent).toContain('200'); expect(root.elements.get('browser-cancel')?.disabled).toBe(false);
  expect(root.attributes.get('aria-busy')).toBe('true'); expect(root.elements.get('browser-select')?.disabled).toBe(true);
  view.receive({ type: 'browserExportProgress', requestId: 4, phase: 'saving', rows: '205', bytes: '70000', blobs: '2' });
  expect(root.elements.get('browser-cancel')?.disabled).toBe(true);
  view.receive({ type: 'browserExportDone', requestId: 4, report: { rows: '205', bytes: '70000', blobs: '2' } }); flush();
  expect(root.attributes.get('aria-busy')).toBe('false'); expect(root.elements.get('browser-status')?.textContent).toContain('205');
  expect(view.savedState()).toMatchObject({ querySql: 'SELECT 42', offset: 0 });
  expect(root.elements.get('browser-export-csv')?.disabled).toBe(false);
  view.receive({ type: 'browserExportProgress', requestId: 4, phase: 'writing', rows: '999', bytes: '9', blobs: '0' });
  expect(root.elements.get('browser-status')?.textContent).not.toContain('999');
});

test('FR-014: Given Cancel clicked before the Saving message is delivered, When the host reports completed save on the Cancel request, Then the UI settles with the saved outcome', () => {
  view.runSql('SELECT 42');
  view.receive({ type: 'browserQueryRows', requestId: 2, offset: 0, limit: 100, ms: 1, page: { columns: ['v'], rows: [['42']], hasMore: false } });
  root.elements.get('browser-export-csv')?.click();
  root.elements.get('browser-cancel')?.click();
  expect(requests().at(-1)).toEqual({ type: 'browserCancel', requestId: 4 });
  view.receive({ type: 'browserExportDone', requestId: 4, report: { rows: '1', bytes: '10', blobs: '0' } });
  expect(root.attributes.get('aria-busy')).toBe('false');
  expect(root.elements.get('browser-status')?.textContent).toContain('Export saved: 1');
});

test('FR-018: Given Browse cells, When selected and copied, Then full raw values appear safely and typed worker requests preserve original TSV data', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['same', 'same'], rows: [[null, '{"n":9223372036854775807}'], ['<script>x</script>', '']], hasMore: true } }); flush();
  view.exercise({ type: 'browserExercise', action: 'cell', value: '0,1' });
  const request = sent.slice().reverse().find((message): message is Extract<CellRequest, { type: 'cellDetails' }> => message.type === 'cellDetails');
  expect(request).toMatchObject({ value: '{"n":9223372036854775807}' });
  expect(root.elements.get('cell-value')?.textContent).toBe('{"n":9223372036854775807}');
  view.exercise({ type: 'browserExercise', action: 'copyCell' });
  expect(sent.at(-1)).toMatchObject({ type: 'browserStatus' });
  expect(sent.slice().reverse().find((message) => message.type === 'cellCopy')).toMatchObject({ rows: [['{"n":9223372036854775807}']] });
  view.exercise({ type: 'browserExercise', action: 'extendCell', value: '1,0' });
  expect(root.elements.get('cell-value')?.textContent).toBe('<script>x</script>');
  expect(root.elements.get('cell-value')?.children).toEqual([]);
});

test('FR-018: Given changing selection and page replacement, When stale details arrive, Then they cannot overwrite current details or persist values', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['a'], rows: [['old'], ['new']], hasMore: true } }); flush();
  view.exercise({ type: 'browserExercise', action: 'cell', value: '0,0' });
  const old = sent.slice().reverse().find((message) => message.type === 'cellDetails');
  view.exercise({ type: 'browserExercise', action: 'cell', value: '1,0' });
  const next = sent.slice().reverse().find((message) => message.type === 'cellDetails');
  if (old?.type !== 'cellDetails' || next?.type !== 'cellDetails') { throw new Error('Missing details requests'); }
  view.receiveCell({ type: 'cellDetailsResult', id: old.id, contextId: old.contextId, detail: { text: 'stale', kind: 'Stored text', notice: '' } });
  expect(root.elements.get('cell-value')?.textContent).toBe('new');
  view.receiveCell({ type: 'cellDetailsResult', id: next.id, contextId: next.contextId, detail: { text: 'new', kind: 'Stored text', notice: '' } });
  expect(root.elements.get('cell-status')?.textContent).toContain('complete');
  expect(view.savedState()).not.toHaveProperty('cell'); expect(view.savedState()).not.toHaveProperty('rows');
  view.exercise({ type: 'browserExercise', action: 'next' });
  view.receive({ type: 'browserRows', requestId: 3, table: 'data', offset: 100, limit: 100, page: { columns: ['a'], rows: [['replacement']], hasMore: false } });
  expect(root.elements.get('cell-value')?.textContent).toBe('');
  expect(root.elements.get('cell-copy-cell')?.disabled).toBe(true);
  view.receiveCell({ type: 'cellDetailsResult', id: next.id, contextId: next.contextId, detail: { text: 'stale', kind: 'Stored text', notice: '' } });
  expect(root.elements.get('cell-value')?.textContent).toBe('');
});

test('FR-018: Given completed details and withheld frames, When selecting an offscreen cell, Then every new-action report carries its DOM and current pending details together', () => {
  const columns = Array.from({ length: 1000 }, (_, index) => `c${String(index)}`);
  const rows = Array.from({ length: 100 }, (_, row) => columns.map((_, column) => `${String(row)}:${String(column)}`));
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns, rows, hasMore: false } });
  view.exercise({ type: 'browserExercise', action: 'cell', value: '0,0', exerciseId: 80 });
  const old = sent.slice().reverse().find((message) => message.type === 'cellDetails');
  if (old?.type !== 'cellDetails') { throw new Error('Missing previous details request'); }
  view.receiveCell({ type: 'cellDetailsResult', id: old.id, contextId: old.contextId, detail: { text: '0:0', kind: 'Stored text', notice: '' } });
  expect(sent.at(-1)).toMatchObject({ cell: { busy: false, preview: '0:0' } });
  sent.length = 0;
  view.exercise({ type: 'browserExercise', action: 'lastCell', exerciseId: 81 });
  const reports = sent.filter(isBrowserStatus);
  expect(reports.length).toBeGreaterThan(0);
  for (const report of reports) {
    expect(report.exerciseId).toBe(81);
    expect(report.cell).toMatchObject({ row: 99, column: 999, busy: true, preview: '99:999' });
    expect(report.firstRow.some((cell) => cell.column === 999)).toBe(true);
    expect(report.renderedRows).toBeGreaterThan(0);
    expect(report.renderedRows).toBeLessThan(30);
    expect(report.renderedColumns).toBeLessThan(26);
  }
});

test('FR-018: Given cancelled preparation followed by a new selection, When late cancellation arrives, Then the newer details status survives', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['a'], rows: [['old'], ['new']], hasMore: false } }); flush();
  view.exercise({ type: 'browserExercise', action: 'cell', value: '0,0' });
  view.exercise({ type: 'browserExercise', action: 'cancelCell' });
  const cancelled = sent.slice().reverse().find((message) => message.type === 'cellCancel');
  if (cancelled?.type !== 'cellCancel') { throw new Error('Missing cancel request'); }
  view.exercise({ type: 'browserExercise', action: 'cell', value: '1,0' });
  view.receiveCell({ type: 'cellFailed', operation: 'cancel', contextId: cancelled.contextId, id: cancelled.id, message: 'Cell operation cancelled.' });
  expect(root.elements.get('cell-value')?.textContent).toBe('new');
  expect(root.elements.get('cell-status')?.textContent).toContain('Preparing details');
});

test('FR-018: Given a counted page, When an empty replacement clears details, Then no settled report carries the previous operation message', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }, { name: 'empty', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['a'], rows: [['old']], hasMore: false } }); flush();
  view.exercise({ type: 'browserExercise', action: 'count' }); view.receive({ type: 'browserCounted', requestId: 3, table: 'data', count: '1' });
  sent.length = 0; view.exercise({ type: 'browserExercise', action: 'select', value: 'empty' });
  view.receive({ type: 'browserRows', requestId: 4, table: 'empty', offset: 0, limit: 100, page: { columns: ['a'], rows: [], hasMore: false } });
  const settled = sent.filter((message): message is BrowserStatus => message.type === 'browserStatus' && !message.busy && message.table === 'empty');
  expect(settled.length).toBeGreaterThan(0);
  expect(settled.every((status) => status.message === 'No rows on this page.')).toBe(true);
});
afterEach(() => { view.dispose(); vi.unstubAllGlobals(); });

test('FR-017: Given a painted page, When its header sorts and filters change, Then engine requests reset paging/counts and include literal controls', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  const page = { columns: ['id', 'text'], rows: [['1', 'old']], hasMore: true };
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page }); flush();
  view.exercise({ type: 'browserExercise', action: 'sort', value: 'id' });
  expect(requests().at(-1)).toMatchObject({ type: 'browserPage', offset: 0, grid: { sort: { column: 'id', direction: 'asc' } } });
  view.receive({ type: 'browserSortWarning', requestId: 3, table: 'data', message: 'Potentially slow sort' }); flush();
  expect(root.elements.get('browser-rows')?.children).toHaveLength(1);
  expect(root.elements.get('browser-sort-continue')?.disabled).toBe(false);
  view.exercise({ type: 'browserExercise', action: 'continueSort' });
  expect(requests().at(-1)).toMatchObject({ grid: { allowSlowSort: true } });
  view.receive({ type: 'browserRows', requestId: 4, table: 'data', offset: 0, limit: 100, page }); flush();
  expect(view.savedState()).toMatchObject({ grid: { sort: { column: 'id', direction: 'asc' } } });
  expect(view.savedState().grid).not.toHaveProperty('allowSlowSort');
  view.exercise({ type: 'browserExercise', action: 'filter', value: JSON.stringify({ column: 'text', operator: 'contains', value: "%_'🚀" }) });
  expect(requests().at(-1)).toMatchObject({ offset: 0, grid: { filters: [{ column: 'text', operator: 'contains', value: "%_'🚀" }] } });
  view.receive({ type: 'browserRows', requestId: 5, table: 'data', offset: 0, limit: 100, page }); flush();
  view.exercise({ type: 'browserExercise', action: 'count' });
  expect(requests().at(-1)).toMatchObject({ type: 'browserCount', grid: { filters: [{ column: 'text', operator: 'contains', value: "%_'🚀" }] } });
});

test('FR-017: Given an unapproved sort, When dismissed or an operation fails, Then the prior page and successful controls survive', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 100, limit: 100, page: { columns: ['id'], rows: [['101']], hasMore: true } }); flush();
  view.exercise({ type: 'browserExercise', action: 'sort', value: 'id' });
  view.receive({ type: 'browserSortWarning', requestId: 3, table: 'data', message: 'Slow' });
  view.exercise({ type: 'browserExercise', action: 'dismissSort' }); flush();
  expect(view.savedState().offset).toBe(100);
  expect(view.savedState().grid?.sort).toBeUndefined();
  expect(root.elements.get('browser-rows')?.children[0]?.children[0]?.textContent).toBe('101');
  view.exercise({ type: 'browserExercise', action: 'filter', value: JSON.stringify({ column: 'id', operator: 'contains', value: 'x'.repeat(65537) }) });
  expect(requests()).toHaveLength(3);
  expect(root.elements.get('browser-status')?.textContent).toContain('Nothing was truncated');
});

test('FR-017: Given persisted filters and a sort, When recreating a view, Then controls restore but rows, counts and slow-sort consent do not', () => {
  const grid = { sort: { column: 'id', direction: 'desc' as const }, filters: [{ column: 'id', operator: 'contains' as const, value: '2' }] };
  const saved = { requestId: 6, table: 'data', offset: 100, listOffset: 0, limit: 100, grid: { ...grid, allowSlowSort: true }, rows: [['secret']] };
  const restored = readSavedState(saved);
  expect(restored.grid).toEqual(grid); expect(restored).not.toHaveProperty('rows');
  view.dispose(); sent = [];
  view = new BrowserView(root as unknown as HTMLElement, (message) => { sent.push(message); }, restored); view.start();
  view.receive({ type: 'browserTables', requestId: 7, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  expect(requests().at(-1)).toMatchObject({ type: 'browserPage', offset: 100, grid });
});

test('FR-017: Given extra data inside saved controls, When restoring state, Then only known control fields survive', () => {
  const saved = readSavedState({ requestId: 1, table: 'data', offset: 0, listOffset: 0, limit: 100,
    grid: { sort: { column: 'id', direction: 'asc', rows: [['secret']] }, filters: [{ column: 'id', operator: 'isNull', rows: [['secret']] }] } });
  expect(saved.grid).toEqual({ sort: { column: 'id', direction: 'asc' }, filters: [{ column: 'id', operator: 'isNull' }] });
});

test('FR-017: Given a restored filter on a later column, When the page paints, Then the active column is selected and its filter can be removed', () => {
  view.dispose(); sent = [];
  view = new BrowserView(root as unknown as HTMLElement, (message) => { sent.push(message); }, {
    requestId: 4, table: 'data', offset: 0, listOffset: 0, limit: 100, grid: { filters: [{ column: 'text', operator: 'contains', value: 'match' }] },
  }); view.start();
  view.receive({ type: 'browserTables', requestId: 5, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 6, table: 'data', offset: 0, limit: 100, page: { columns: ['id', 'text'], rows: [['1', 'match']], hasMore: false } }); flush();
  expect(root.elements.get('browser-filter-column')?.value).toBe('text');
  expect(root.elements.get('browser-filter-remove')?.disabled).toBe(false);
  view.exercise({ type: 'browserExercise', action: 'removeFilter' });
  expect(requests().at(-1)).toEqual({ type: 'browserPage', requestId: 7, table: 'data', offset: 0, limit: 100 });
});

test('FR-017: Given successful filters and paging, When an attempted replacement fails or cancels, Then stale replies and failed controls cannot replace the successful page', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  const page = { columns: ['id'], rows: [['101']], hasMore: true };
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 100, limit: 100, page }); flush();
  view.exercise({ type: 'browserExercise', action: 'filter', value: JSON.stringify({ column: 'id', operator: 'contains', value: 'x' }) });
  view.receive({ type: 'browserError', requestId: 3, message: 'The worker failed. Reopen.' }); flush();
  expect(view.savedState().grid).toBeUndefined(); expect(view.savedState().offset).toBe(100);
  view.exercise({ type: 'browserExercise', action: 'filter', value: JSON.stringify({ column: 'id', operator: 'contains', value: 'y' }) });
  view.exercise({ type: 'browserExercise', action: 'cancel' });
  view.receive({ type: 'browserRows', requestId: 4, table: 'data', offset: 0, limit: 100, page: { ...page, rows: [['stale']] } });
  view.receive({ type: 'browserCancelled', requestId: 5 }); flush();
  expect(view.savedState().grid).toBeUndefined(); expect(view.savedState().offset).toBe(100);
  expect(root.elements.get('browser-rows')?.children[0]?.children[0]?.textContent).toBe('101');
});

test('FR-017: Given a changed filter awaiting sort confirmation, When counting or paging is attempted, Then the warning survives and continuation resets the page and count', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  const page = { columns: ['id'], rows: [['1']], hasMore: true };
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page }); flush();
  view.exercise({ type: 'browserExercise', action: 'sort', value: 'id' });
  view.receive({ type: 'browserSortWarning', requestId: 3, table: 'data', message: 'Slow sort' });
  view.exercise({ type: 'browserExercise', action: 'continueSort' });
  view.receive({ type: 'browserRows', requestId: 4, table: 'data', offset: 0, limit: 100, page }); flush();
  view.exercise({ type: 'browserExercise', action: 'next' });
  view.receive({ type: 'browserRows', requestId: 5, table: 'data', offset: 100, limit: 100, page: { ...page, rows: [['101']] } }); flush();
  view.exercise({ type: 'browserExercise', action: 'count' });
  view.receive({ type: 'browserCounted', requestId: 6, table: 'data', count: '205' });
  view.exercise({ type: 'browserExercise', action: 'filter', value: JSON.stringify({ column: 'id', operator: 'contains', value: '9' }) });
  view.receive({ type: 'browserSortWarning', requestId: 7, table: 'data', message: 'Slow filtered sort' });
  for (const id of ['browser-count', 'browser-next', 'browser-previous', 'browser-size', 'schema-show', 'schema-inspect']) {
    expect(root.elements.get(id)?.disabled).toBe(true);
  }
  for (const action of ['count', 'next', 'previous', 'size', 'schema', 'schemaIndex'] as const) {
    view.exercise({ type: 'browserExercise', action, value: '10' });
  }
  expect(requests()).toHaveLength(7);
  expect(root.elements.get('browser-sort-warning')?.hidden).toBe(false);
  expect(view.savedState()).toMatchObject({ offset: 100, grid: { sort: { column: 'id', direction: 'asc' } } });
  view.exercise({ type: 'browserExercise', action: 'continueSort' });
  expect(requests().at(-1)).toMatchObject({ requestId: 8, offset: 0, limit: 100, grid: { filters: [{ column: 'id', operator: 'contains', value: '9' }], allowSlowSort: true } });
  view.receive({ type: 'browserRows', requestId: 8, table: 'data', offset: 0, limit: 100, page: { ...page, rows: [['9']], hasMore: false } }); flush();
  expect(view.savedState().offset).toBe(0);
  expect(root.elements.get('browser-total')?.textContent).toBe('Total rows: not counted');
  view.exercise({ type: 'browserExercise', action: 'count' });
  expect(requests().at(-1)).toMatchObject({ requestId: 9, grid: { filters: [{ column: 'id', operator: 'contains', value: '9' }] } });
  view.receive({ type: 'browserCounted', requestId: 9, table: 'data', count: '1' });
  expect(root.elements.get('browser-total')?.textContent).toBe('Total rows: 1');
});

test('FR-010: Given a recreated webview, When observing its DOM, Then its identity differs from the destroyed context', () => {
  const old = sent.find((message) => message.type === 'browserStatus');
  if (old?.type !== 'browserStatus') { throw new Error('Expected old DOM status'); }
  expect(old.contextId).toMatch(/^[\da-f-]{36}$/u);
  view.dispose(); sent = [];
  view = new BrowserView(root as unknown as HTMLElement, (message) => { sent.push(message); });
  view.start();
  const fresh = sent.find((message) => message.type === 'browserStatus');
  if (fresh?.type !== 'browserStatus') { throw new Error('Expected recreated DOM status'); }
  expect(fresh.contextId).toMatch(/^[\da-f-]{36}$/u);
  expect(fresh.contextId).not.toBe(old.contextId);
});

test('FR-010: Given previous result frames and a new host action, When it is processed, Then every subsequent status acknowledges that exact action', () => {
  view.exercise({ type: 'browserExercise', action: 'run', exerciseId: 71 });
  const acknowledgement = sent.at(-1);
  if (acknowledgement?.type !== 'browserStatus') { throw new Error('Expected action acknowledgement'); }
  expect(acknowledgement.exerciseId).toBe(71);
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [], hasMore: false }); flush();
  const settled = sent.at(-1);
  if (settled?.type !== 'browserStatus') { throw new Error('Expected settled DOM status'); }
  expect(settled.exerciseId).toBe(71);
  expect(settled.contextId).toBe(acknowledgement.contextId);
});

test('FR-011: Given query results for an already selected table, When Browse table is clicked, Then returning to that same table is possible', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: false });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['v'], rows: [['old']], hasMore: false } });
  view.runSql('SELECT 1');
  view.receive({ type: 'browserQueryRows', requestId: 3, offset: 0, limit: 100, ms: 1, page: { columns: ['1'], rows: [['1']], hasMore: false } }); flush();
  const browse = root.elements.get('browser-browse');
  expect(browse?.disabled).toBe(false);
  browse?.dispatchEvent(new Event('click'));
  expect(requests().at(-1)).toEqual({ type: 'browserPage', requestId: 4, table: 'data', offset: 0, limit: 100 });
});

test('FR-010: Given oversized or malformed saved SQL, When restoring state, Then SQL is rejected without storing results or accepting unsafe query context', () => {
  const base = { requestId: 3, table: null, offset: 0, listOffset: 0, limit: 100 };
  expect(readSavedState({ ...base, sqlText: 'SELECT 1', querySql: 'SELECT 1', rows: [['data']] })).toEqual({ ...base, sqlText: 'SELECT 1', querySql: 'SELECT 1' });
  expect(readSavedState({ ...base, sqlText: 'x'.repeat(4 * 1024 * 1024 + 1), querySql: 'SELECT\0' })).toEqual(base);
});

test('FR-010: Given a tab still restoring its catalog, When the SQL document changes, Then the latest editor text is persisted even before the catalog replies', () => {
  view.dispose(); sent = [];
  view = new BrowserView(root as unknown as HTMLElement, (message) => { sent.push(message); }, { requestId: 4, table: 'saved', offset: 100, listOffset: 100, limit: 10, sqlText: 'SELECT old' });
  const editor = { text: 'SELECT new', metrics: () => ({ editorReady: true, sqlLength: editor.text.length, selectionLength: 0, highlighted: true }),
    setDisabled: vi.fn<(disabled: boolean) => void>(), setText: vi.fn<(text: string) => void>(), select: vi.fn<(anchor: number, head: number) => void>(),
    clickRun: vi.fn<() => void>(), shortcut: vi.fn<() => void>(), dispose: vi.fn<() => void>() };
  view.attachEditor(editor);
  expect(view.savedState()).toEqual({ requestId: 4, table: 'saved', offset: 100, listOffset: 100, limit: 10, sqlText: 'SELECT new' });
  editor.text = 'x'.repeat(4 * 1024 * 1024 + 1);
  view.editorChanged();
  expect(view.savedState()).not.toHaveProperty('sqlText');
  expect(root.elements.get('sql-limit-status')?.textContent).toContain('not saved');
});

test('FR-011: Given successful SQL results, When edited SQL fails, Then the old DOM, count and successful paging SQL remain', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [], hasMore: false });
  view.runSql('SELECT x FROM data ORDER BY x');
  expect(requests().at(-1)).toEqual({ type: 'browserQuery', requestId: 2, sql: 'SELECT x FROM data ORDER BY x', offset: 0, limit: 100 });
  view.receive({ type: 'browserQueryRows', requestId: 2, offset: 0, limit: 100, ms: 5, page: { columns: ['x'], rows: [['1']], hasMore: true } }); flush();
  expect(root.elements.get('browser-total')?.textContent).toContain('Page execution time: 5.0 ms');
  expect(root.elements.get('browser-count')?.disabled).toBe(true);
  view.runSql('SELECT FROM');
  expect(root.elements.get('browser-rows')?.children).toHaveLength(1);
  view.receive({ type: 'browserError', requestId: 3, message: 'near "FROM": syntax error' }); flush();
  expect(root.elements.get('browser-rows')?.children).toHaveLength(1);
  expect(root.elements.get('browser-status')?.textContent).toContain('syntax error');
  expect(root.elements.get('browser-total')?.textContent).toContain('5.0 ms');
  view.exercise({ type: 'browserExercise', action: 'next' });
  expect(requests().at(-1)).toMatchObject({ type: 'browserQuery', sql: 'SELECT x FROM data ORDER BY x', offset: 100 });
  view.receive({ type: 'browserQueryRows', requestId: 4, offset: 100, limit: 100, ms: 6, page: { columns: ['x'], rows: [['101']], hasMore: false } }); flush();
  expect(root.elements.get('browser-total')?.textContent).toContain('Total rows: 101');
  expect(root.elements.get('browser-next')?.disabled).toBe(true);
});

test('FR-015: Given successful SQL and a worker-start acknowledgement, When Cancel is clicked twice, Then recovery remains busy, stale replies are ignored and the previous page survives', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [], hasMore: false });
  view.runSql('SELECT 42');
  view.receive({ type: 'browserQueryRows', requestId: 2, offset: 0, limit: 100, ms: 1, page: { columns: ['value'], rows: [['42']], hasMore: false } }); flush();
  view.runSql('SELECT slow');
  // Runtime protocol validation must accept the new nonterminal response.
  view.receive({ type: 'browserQueryStarted', requestId: 3 });
  expect(root.elements.get('browser-status')?.textContent).toContain('executing');
  expect(root.elements.get('browser-cancel')?.disabled).toBe(false);
  view.exercise({ type: 'browserExercise', action: 'cancel' });
  view.exercise({ type: 'browserExercise', action: 'cancel' });
  expect(requests().filter((request) => request.type === 'browserCancel')).toHaveLength(1);
  expect(root.attributes.get('aria-busy')).toBe('true');
  expect(root.elements.get('browser-cancel')?.disabled).toBe(true);
  for (const reply of [{ type: 'browserQueryStarted', requestId: 3 }, { type: 'browserError', requestId: 3, message: 'old error' }] as const) { view.receive(reply); }
  expect(root.elements.get('browser-status')?.textContent).toContain('Cancelling');
  view.receive({ type: 'browserQueryRows', requestId: 3, offset: 0, limit: 100, ms: 2, page: { columns: ['bad'], rows: [['stale']], hasMore: false } });
  view.receive({ type: 'browserCancelled', requestId: 4 }); flush();
  expect(root.attributes.get('aria-busy')).toBe('false');
  expect(root.elements.get('browser-status')?.textContent).toContain('Run');
  expect(root.elements.get('browser-total')?.textContent).toContain('Total rows: 1');
  expect(view.savedState().querySql).toBe('SELECT 42');
  const status = sent.filter((message): message is BrowserStatus => message.type === 'browserStatus').at(-1);
  expect(status?.firstRow[0]?.text).toBe('42');
  view.runSql('SELECT 7');
  expect(requests().at(-1)).toMatchObject({ type: 'browserQuery', requestId: 5, sql: 'SELECT 7' });
});

test('FR-015: Given recovery failure, When Cancel settles with a reopen instruction, Then old SQL results and editor context are preserved', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [], hasMore: false });
  view.runSql('SELECT 42');
  view.receive({ type: 'browserQueryRows', requestId: 2, offset: 0, limit: 100, ms: 1, page: { columns: ['value'], rows: [['42']], hasMore: false } }); flush();
  view.runSql('SELECT slow'); view.exercise({ type: 'browserExercise', action: 'cancel' });
  view.receive({ type: 'browserError', requestId: 4, message: 'The database could not recover after cancellation. Close and reopen the file.' });
  expect(root.elements.get('browser-status')?.attributes.get('role')).toBe('alert');
  expect(root.elements.get('browser-status')?.textContent).toContain('Close and reopen');
  expect(view.savedState().querySql).toBe('SELECT 42');
  expect(root.elements.get('browser-total')?.textContent).toContain('Total rows: 1');
});

test('NFR-005: Given an opt-in responsiveness probe, When sampling then stopping or disposing, Then bounded metrics are validated and no timer remains', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
  try {
    expect(isBrowserExercise({ type: 'browserExercise', action: 'startResponsiveness' })).toBe(true);
    expect(isBrowserExercise({ type: 'browserExercise', action: 'stopResponsiveness' })).toBe(true);
    view.exercise({ type: 'browserExercise', action: 'startResponsiveness' });
    vi.advanceTimersByTime(40);
    view.exercise({ type: 'browserExercise', action: 'stopResponsiveness' });
    const status = sent.filter((message): message is BrowserStatus => message.type === 'browserStatus').at(-1);
    expect(status).toMatchObject({ responsiveness: { ticks: 4, maxGapMs: 10 } });
    expect(isBrowserStatus(status)).toBe(true);
    for (const responsiveness of [{ ticks: -1, maxGapMs: 10 }, { ticks: 1.5, maxGapMs: 10 }, { ticks: 4, maxGapMs: NaN }, { ticks: 4, maxGapMs: -1 }, { ticks: 4, maxGapMs: Infinity }]) {
      expect(isBrowserStatus({ ...status, responsiveness })).toBe(false);
    }
    expect(vi.getTimerCount()).toBe(0);
    view.exercise({ type: 'browserExercise', action: 'startResponsiveness' });
    view.exercise({ type: 'browserExercise', action: 'startResponsiveness' });
    expect(vi.getTimerCount()).toBe(1);
    view.dispose(); expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});

test('NFR-005: Given a delayed timer, When the probe resumes, Then its reported maximum retains the entire stall instead of clamping it to the target', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  let clock = 0;
  const now = vi.spyOn(performance, 'now').mockImplementation(() => clock);
  try {
    view.exercise({ type: 'browserExercise', action: 'startResponsiveness' });
    clock = 250; vi.advanceTimersByTime(10);
    clock = 260; view.exercise({ type: 'browserExercise', action: 'stopResponsiveness' });
    const status = sent.filter((message): message is BrowserStatus => message.type === 'browserStatus').at(-1);
    expect(status).toMatchObject({ responsiveness: { ticks: 1, maxGapMs: 250 } });
    expect(vi.getTimerCount()).toBe(0);
  } finally { now.mockRestore(); vi.useRealTimers(); }
});

test('NFR-005: Given background timer starvation, When keyed host pulses arrive, Then the webview records actual event gaps and rejects stale probes without changing action acknowledgements', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  let clock = 0; const now = vi.spyOn(performance, 'now').mockImplementation(() => clock);
  const latest = () => sent.filter((message): message is BrowserStatus => message.type === 'browserStatus').at(-1);
  try {
    expect(isBrowserExercise({ type: 'browserExercise', action: 'pulseResponsiveness', value: 'key' })).toBe(true);
    view.exercise({ type: 'browserExercise', action: 'startResponsiveness', exerciseId: 71 });
    const context = latest()?.contextId; expect(context).toBeTypeOf('string');
    // Do not advance the native timer scheduler: only delivered events sample.
    for (let i = 0; i < 5; ++i) {
      clock += 20;
      view.exercise({ type: 'browserExercise', action: 'pulseResponsiveness', value: `${context}:71`, exerciseId: 900 });
    }
    view.exercise({ type: 'browserExercise', action: 'stopResponsiveness', exerciseId: 72 });
    expect(latest()).toMatchObject({ exerciseId: 72, responsiveness: { ticks: 5, maxGapMs: 20 } });
    view.exercise({ type: 'browserExercise', action: 'startResponsiveness', exerciseId: 73 });
    view.exercise({ type: 'browserExercise', action: 'pulseResponsiveness', value: `${context}:71` });
    view.exercise({ type: 'browserExercise', action: 'pulseResponsiveness', value: 'wrong-context:73' });
    clock = 350;
    view.exercise({ type: 'browserExercise', action: 'pulseResponsiveness', value: `${context}:73` });
    view.exercise({ type: 'browserExercise', action: 'stopResponsiveness', exerciseId: 74 });
    expect(latest()).toMatchObject({ exerciseId: 74, responsiveness: { ticks: 1, maxGapMs: 250 } });
    clock = 500;
    view.exercise({ type: 'browserExercise', action: 'pulseResponsiveness', value: `${context}:73` });
    view.exercise({ type: 'browserExercise', action: 'selection', exerciseId: 75 });
    expect(latest()).toMatchObject({ exerciseId: 75, responsiveness: { ticks: 1, maxGapMs: 250 } });
    expect(vi.getTimerCount()).toBe(0);
  } finally { now.mockRestore(); vi.useRealTimers(); }
});

test('FR-010: Given empty or oversized editor SQL, When Run is requested, Then no query is sent and previous results survive', () => {
  const before = requests().length;
  view.runSql('  ');
  expect(root.elements.get('browser-status')?.textContent).toContain('Enter');
  view.runSql('x'.repeat(4 * 1024 * 1024 + 1));
  expect(root.elements.get('browser-status')?.textContent).toContain('limit');
  expect(requests()).toHaveLength(before);
});

test('FR-011: Given stale SQL replies and empty results, When a newer run settles, Then only its page is rendered and zero is exact', () => {
  view.runSql('SELECT 1');
  view.runSql('SELECT 2 WHERE 0');
  view.receive({ type: 'browserQueryRows', requestId: 2, offset: 0, limit: 100, ms: 1, page: { columns: ['old'], rows: [['stale']], hasMore: false } }); flush();
  expect(root.elements.get('browser-rows')?.children).toHaveLength(0);
  view.receive({ type: 'browserQueryRows', requestId: 3, offset: 0, limit: 100, ms: 2, page: { columns: ['2'], rows: [], hasMore: false } }); flush();
  expect(root.elements.get('browser-total')?.textContent).toContain('Total rows: 0');
  expect(root.elements.get('browser-previous')?.disabled).toBe(true);
  expect(root.elements.get('browser-next')?.disabled).toBe(true);
});

test('FR-011: Given saved query context, When recreating the webview, Then the successful SQL page is rerun without stored rows', () => {
  view.dispose(); sent = [];
  view = new BrowserView(root as unknown as HTMLElement, (message) => { sent.push(message); }, { requestId: 7, table: 'data', offset: 100, listOffset: 0, limit: 10, querySql: 'SELECT 1', sqlText: 'SELECT FROM' });
  view.start();
  view.receive({ type: 'browserTables', requestId: 8, offset: 0, objects: [{ name: 'first', kind: 'table' }, { name: 'data', kind: 'table' }], hasMore: false });
  expect(requests().at(-1)).toEqual({ type: 'browserQuery', requestId: 9, sql: 'SELECT 1', offset: 100, limit: 10 });
  expect(view.savedState()).not.toHaveProperty('rows');
  expect(root.elements.get('browser-select')?.value).toBe('data');
  view.receive({ type: 'browserQueryRows', requestId: 9, offset: 100, limit: 10, ms: 1, page: { columns: ['v'], rows: [['101']], hasMore: false } });
  expect(root.elements.get('schema-show')?.disabled).toBe(false);
  view.exercise({ type: 'browserExercise', action: 'schema' });
  expect(requests().at(-1)).toMatchObject({ type: 'browserSchema', table: 'data' });
});

test('FR-003: Given inspected metadata, When the replacement catalog is empty, Then stale schema is cleared and inspection is disabled', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }], hasMore: true });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['v'], rows: [['old']], hasMore: false } });
  view.exercise({ type: 'browserExercise', action: 'schema' });
  view.receive({ type: 'browserSchemaRows', requestId: 3, table: 'data', kind: 'columns', offset: 0, limit: 100, page: { columns: ['name'], rows: [['old metadata']], hasMore: false } });
  view.exercise({ type: 'browserExercise', action: 'listNext' });
  view.receive({ type: 'browserTables', requestId: 4, offset: 100, objects: [], hasMore: false });
  expect(sent.at(-1)).toMatchObject({ schema: { table: null, rows: 0, preview: '' } });
  expect(root.elements.get('schema-show')?.disabled).toBe(true); expect(root.elements.get('schema-rows')?.children).toHaveLength(0);
});

test('FR-002: Given a table list, When browsing and navigating an exact page boundary, Then selection is automatic, controls reflect hasMore and counting stays explicit', () => {
  expect(requests()).toEqual([{ type: 'browserList', requestId: 1, offset: 0 }]);
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'data', kind: 'table' }, { name: 'view', kind: 'view' }], hasMore: true });
  expect(requests().at(-1)).toEqual({ type: 'browserPage', requestId: 2, table: 'data', offset: 0, limit: 100 });
  view.receive({ type: 'browserRows', requestId: 2, table: 'data', offset: 0, limit: 100, page: { columns: ['value'], rows: Array.from({ length: 100 }, (_value, index) => [String(index)]), hasMore: false } }); flush();
  expect(root.elements.get('browser-next')?.disabled).toBe(true);
  expect(root.elements.get('browser-previous')?.disabled).toBe(true);
  expect(requests().some((message) => message.type === 'browserCount')).toBe(false);
  view.exercise({ type: 'browserExercise', action: 'count' });
  expect(requests().at(-1)).toEqual({ type: 'browserCount', requestId: 3, table: 'data' });
  view.receive({ type: 'browserCounted', requestId: 3, table: 'data', count: '9007199254740993' });
  expect(root.elements.get('browser-total')?.textContent).toContain('9007199254740993');
});

test('FR-002: Given an old page in flight, When another object is selected, Then old responses are ignored and empty/error states remain visible', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'old', kind: 'table' }, { name: 'new', kind: 'view' }], hasMore: false });
  view.exercise({ type: 'browserExercise', action: 'select', value: 'new' });
  view.receive({ type: 'browserRows', requestId: 2, table: 'old', offset: 0, limit: 100, page: { columns: ['v'], rows: [['stale']], hasMore: false } }); flush();
  expect(root.elements.get('browser-rows')?.children).toEqual([]);
  view.receive({ type: 'browserRows', requestId: 3, table: 'new', offset: 0, limit: 100, page: { columns: ['v'], rows: [], hasMore: false } }); flush();
  expect(root.elements.get('browser-status')?.textContent).toContain('No rows');
  view.exercise({ type: 'browserExercise', action: 'size', value: '1' });
  view.receive({ type: 'browserError', requestId: 4, message: 'Page too large. No value was truncated. Request fewer rows.' });
  expect(root.elements.get('browser-status')?.textContent).toContain('No value was truncated');
  expect(root.elements.get('browser-status')?.attributes.get('role')).toBe('alert');
  view.exercise({ type: 'browserExercise', action: 'size', value: '1' });
  expect(requests().at(-1)).toMatchObject({ type: 'browserPage', limit: 1 });
});

test('FR-002: Given an empty database and disposal, When list and late replies arrive, Then a friendly empty state appears and disposed controls send nothing', () => {
  view.receive({ type: 'browserTables', requestId: 1, offset: 0, objects: [], hasMore: false });
  expect(root.elements.get('browser-status')?.textContent).toContain('No tables or views');
  expect(root.elements.get('browser-count')?.disabled).toBe(true);
  view.dispose();
  const total = sent.length;
  view.exercise({ type: 'browserExercise', action: 'listNext' });
  view.receive({ type: 'browserError', requestId: 1, message: 'late' });
  expect(sent).toHaveLength(total);
});

test('FR-002: Given a webview context recreated after hiding a tab, When restoring its small saved state, Then IDs continue and selection/page position survive without storing rows', () => {
  view.dispose(); sent = [];
  view = new BrowserView(root as unknown as HTMLElement, (message) => { sent.push(message); }, { requestId: 4, table: 'saved', offset: 100, listOffset: 100, limit: 10 });
  view.start();
  expect(requests()).toEqual([{ type: 'browserList', requestId: 5, offset: 100 }]);
  expect(view.savedState()).toEqual({ requestId: 5, table: 'saved', offset: 100, listOffset: 100, limit: 10 });
  view.receive({ type: 'browserTables', requestId: 5, offset: 100, objects: [{ name: 'first', kind: 'table' }, { name: 'saved', kind: 'view' }], hasMore: false });
  expect(requests().at(-1)).toEqual({ type: 'browserPage', requestId: 6, table: 'saved', offset: 100, limit: 10 });
  expect(view.savedState()).toEqual({ requestId: 6, table: 'saved', offset: 100, listOffset: 100, limit: 10 });
});
