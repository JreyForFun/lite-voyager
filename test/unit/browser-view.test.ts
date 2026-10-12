import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BrowserView, readSavedState } from '../../webview/sqlite-browser';
import { BrowserElement, browserRoot } from './browser-dom';
import type { BrowserRequest, BrowserStatus } from '../../src/protocol';

let view: BrowserView;
let root: BrowserElement;
let sent: (BrowserRequest | BrowserStatus)[];
let frames: FrameRequestCallback[];
const flush = (): void => { const queued = frames; frames = []; for (const callback of queued) { callback(0); } };
const requests = () => sent.filter((message): message is BrowserRequest => message.type !== 'browserStatus');
beforeEach(() => {
  root = browserRoot(['browser-grid', 'browser-viewport', 'browser-track', 'browser-rows', 'browser-header', 'browser-select', 'browser-list-previous', 'browser-list-next', 'browser-previous', 'browser-next', 'browser-count', 'browser-cancel', 'browser-size', 'browser-status', 'browser-total', 'browser-list-status', 'browser-browse', 'sql-limit-status']);
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
afterEach(() => { view.dispose(); vi.unstubAllGlobals(); });

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
