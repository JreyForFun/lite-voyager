import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BrowserGrid } from '../../webview/browser-grid';
import { BrowserElement, browserRoot } from './browser-dom';

let root: BrowserElement;
let grid: BrowserGrid;
let frames: FrameRequestCallback[];
let resize: () => void;
const element = (id: string): BrowserElement => {
  const found = root.elements.get(id);
  if (found === undefined) { throw new Error('Missing test element'); }
  return found;
};
const flush = (): void => { const queued = frames; frames = []; for (const callback of queued) { callback(0); } };
beforeEach(() => {
  root = browserRoot(['browser-viewport', 'browser-track', 'browser-rows', 'browser-header']); frames = [];
  vi.stubGlobal('document', { createElement: () => new BrowserElement() });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe(): void { /* Dimensions explicitly supplied above. */ }
    disconnect(): void { /* No native observer allocated. */ }
  });
  grid = new BrowserGrid(root as unknown as HTMLElement);
});
afterEach(() => { grid.dispose(); vi.unstubAllGlobals(); });

test('FR-002: Given fidelity edge cells, When rendered, Then NULL/empty/text are distinct and exact values and script text survive safely', () => {
  const values = [null, '', 'NULL', '9223372036854775807', '-9223372036854775808', '[BLOB 24 bytes]', '<img onerror=alert(1)>', '1e-200', '2026-10-10T12:00:00+08:00'];
  element('browser-viewport').clientWidth = 2200;
  grid.setPage({ columns: values.map((_value, index) => `c${String(index)}`), rows: [values], hasMore: false }, 0); flush();
  const cells = element('browser-rows').children[0]?.children;
  expect(cells?.map((cell) => cell.textContent)).toEqual(['NULL', '(empty)', ...values.slice(2)]);
  expect(cells?.[0]?.className).toContain('cell-null');
  expect(cells?.[0]?.attributes.get('aria-label')).toBe('SQL NULL');
  expect(cells?.[1]?.attributes.get('aria-label')).toBe('Empty string');
  expect(cells?.[2]?.className).not.toContain('cell-null');
  expect(cells?.[6]?.children).toEqual([]);
});

test('FR-002: Given 100 rows and 1000 columns, When scrolling and using the keyboard, Then both dimensions stay virtualized and the last cell is reachable', () => {
  const columns = Array.from({ length: 1000 }, (_value, index) => `column${String(index)}`);
  const rows = Array.from({ length: 100 }, (_value, row) => columns.map((_name, column) => `${String(row)}:${String(column)}`));
  grid.setPage({ columns, rows, hasMore: false }, 100); flush();
  expect(element('browser-rows').children.length).toBeLessThan(30);
  expect(element('browser-rows').children[0]?.children.length).toBeLessThan(12);
  root.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'End', ctrlKey: true })); flush();
  expect(element('browser-rows').children.at(-1)?.children.at(-1)?.textContent).toBe('99:999');
  expect(root.attributes.get('aria-rowcount')).toBe('101');
  expect(root.attributes.get('aria-colcount')).toBe('1000');
  element('browser-viewport').clientHeight = 140; resize(); flush();
  expect(element('browser-rows').children.length).toBeLessThan(20);
  grid.dispose();
  expect(element('browser-rows').children).toEqual([]);
  expect(frames).toEqual([]);
});

test('FR-002: Given an empty page and a cell larger than 1 MiB, When switching pages, Then cache is replaced and the complete value remains available', () => {
  const text = '🚀'.repeat(270000);
  grid.setPage({ columns: ['value'], rows: [[text]], hasMore: false }, 0); flush();
  expect(element('browser-rows').children[0]?.children[0]?.textContent).toBe(text);
  expect(element('browser-rows').children[0]?.children[0]?.title).toBe(text);
  grid.setPage({ columns: ['value'], rows: [], hasMore: false }, 0); flush();
  expect(grid.metrics().cachedRows).toBe(0);
  expect(element('browser-rows').children).toEqual([]);
});

test('FR-002: Given a rendered page, When a replacement arrives before its frame, Then old DOM cells cannot be reported under the new page', () => {
  grid.setPage({ columns: ['value'], rows: [['old']], hasMore: true }, 0); flush();
  grid.setPage({ columns: ['value'], rows: [['new']], hasMore: false }, 100);
  expect(grid.metrics().renderedRows).toBe(0);
  expect(grid.firstRow()).toEqual([]);
  flush();
  expect(grid.firstRow()[0]?.text).toBe('new');
});
