import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BrowserView } from '../../webview/sqlite-browser';
import { BrowserElement, browserRoot } from './browser-dom';
import type { BrowserRequest, BrowserStatus } from '../../src/protocol';

let view: BrowserView;
let root: BrowserElement;
let sent: (BrowserRequest | BrowserStatus)[];
let frames: FrameRequestCallback[];
const flush = (): void => { const queued = frames; frames = []; for (const callback of queued) { callback(0); } };
const requests = () => sent.filter((message): message is BrowserRequest => message.type !== 'browserStatus');
beforeEach(() => {
  root = browserRoot(['browser-grid', 'browser-viewport', 'browser-track', 'browser-rows', 'browser-header', 'browser-select', 'browser-list-previous', 'browser-list-next', 'browser-previous', 'browser-next', 'browser-count', 'browser-cancel', 'browser-size', 'browser-status', 'browser-total', 'browser-list-status']);
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
