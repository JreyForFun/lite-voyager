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

test('FR-002: Given withheld animation frames and a wide page, When selecting and keyboard-navigating offscreen cells, Then exact bounded DOM and accessibility state update immediately', () => {
  const columns = Array.from({ length: 1000 }, (_, index) => `c${String(index)}`);
  const rows = Array.from({ length: 100 }, (_, row) => columns.map((_, column) => row === 99 && column === 999 ? '9223372036854775807' : `${String(row)}:${String(column)}`));
  grid.setPage({ columns, rows, hasMore: false }, 0);
  grid.lastCell();
  expect(element('browser-rows').children.at(-1)?.children.at(-1)?.textContent).toBe('9223372036854775807');
  expect(root.attributes.get('aria-activedescendant')).toBe('browser-cell-99-999');
  root.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Home', ctrlKey: true }));
  expect(element('browser-rows').children[0]?.children[0]?.textContent).toBe('0:0');
  expect(root.attributes.get('aria-activedescendant')).toBe('browser-cell-0-0');
  expect(grid.metrics().renderedRows).toBeLessThan(30);
  expect(grid.metrics().renderedColumns).toBeLessThan(26);
  expect(frames).toEqual([]);
});

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

test('FR-002: Given a rendered page and a queued scroll frame, When a replacement arrives, Then only its new DOM is reported without a stale duplicate', () => {
  grid.dispose();
  const changed = vi.fn();
  grid = new BrowserGrid(root as unknown as HTMLElement, changed);
  grid.setPage({ columns: ['value'], rows: [['old']], hasMore: true }, 0); flush();
  element('browser-viewport').dispatchEvent(new Event('scroll'));
  changed.mockClear();
  grid.setPage({ columns: ['value'], rows: [['new']], hasMore: false }, 100);
  expect(grid.metrics().renderedRows).toBe(1);
  expect(grid.firstRow()[0]?.text).toBe('new');
  expect(changed).toHaveBeenCalledTimes(1);
  flush();
  expect(grid.firstRow()[0]?.text).toBe('new');
  expect(changed).toHaveBeenCalledTimes(1);
});

test('D-5: Given animation frames never run, When a wide page arrives, Then exact literal cells and bounded DOM are immediately reportable', () => {
  grid.dispose();
  const observed: string[] = [];
  grid = new BrowserGrid(root as unknown as HTMLElement, () => { observed.push(grid.firstRow()[0]?.text ?? 'missing'); });
  element('browser-viewport').clientWidth = 100000;
  element('browser-viewport').clientHeight = 100000;
  const columns = Array.from({ length: 1000 }, (_, i) => `c${String(i)}`);
  const values = ['9007199254740993', '<script>literal</script>', ...columns.slice(2)];
  grid.setPage({ columns, rows: Array.from({ length: 100 }, () => values), hasMore: true }, 0);
  expect(observed).toEqual(['9007199254740993']);
  expect(grid.firstRow()[1]?.text).toBe('<script>literal</script>');
  expect(element('browser-rows').children[0]?.children[1]?.children).toEqual([]);
  expect(grid.metrics()).toMatchObject({ cachedRows: 100 });
  expect(grid.metrics().renderedRows).toBeGreaterThan(0);
  expect(grid.metrics().renderedRows).toBeLessThan(30);
  expect(grid.metrics().renderedColumns).toBeLessThan(26);
});

test('D-5: Given a queued scroll frame, When the grid is disposed, Then even a late callback cannot restore DOM or report another page', () => {
  grid.dispose();
  const changed = vi.fn();
  grid = new BrowserGrid(root as unknown as HTMLElement, changed);
  grid.setPage({ columns: ['a'], rows: [['exact']], hasMore: false }, 0); flush();
  element('browser-viewport').dispatchEvent(new Event('scroll'));
  const queued = frames.slice();
  changed.mockClear(); grid.dispose();
  for (const callback of queued) { callback(0); }
  expect(changed).not.toHaveBeenCalled();
  expect(element('browser-rows').children).toEqual([]);
});

test('FR-018: Given a wide paged grid, When selecting and extending offscreen cells, Then copying uses the page values and replacement clears selection', () => {
  const columns = Array.from({ length: 1000 }, (_, i) => `c${String(i)}`);
  const rows = Array.from({ length: 100 }, (_, r) => columns.map((_, c) => `${String(r)}:${String(c)}`));
  grid.setPage({ columns, rows, hasMore: true }, 100); flush();
  grid.selectCell(98, 998); grid.selectCell(99, 999, true); flush();
  expect(grid.selection()).toMatchObject({ row: 99, column: 999, value: '99:999', name: 'c999', rowNumber: 200 });
  expect(grid.copyRows('selection')).toEqual([['98:998', '98:999'], ['99:998', '99:999']]);
  expect(grid.copyRows('cell')).toEqual([['99:999']]);
  expect(grid.copyRows('row')?.[0]).toEqual(rows[99]);
  expect(element('browser-rows').children.at(-1)?.children.at(-1)?.attributes.get('aria-selected')).toBe('true');
  grid.setPage({ columns, rows: [], hasMore: false }, 200);
  expect(grid.selection()).toBeNull(); expect(grid.copyRows('cell')).toBeNull();
});

test('FR-018: Given grid keyboard navigation, When shift extends and select-all runs, Then the rectangle is bounded and header key events do not select cells', () => {
  grid.setPage({ columns: ['a', 'b'], rows: [[null, ''], ['NULL', '9223372036854775807']], hasMore: false }, 0); flush();
  root.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Home', ctrlKey: true }));
  root.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'ArrowRight', shiftKey: true }));
  expect(grid.copyRows('selection')).toEqual([[null, '']]);
  root.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'ArrowDown', shiftKey: true }));
  expect(grid.copyRows('selection')).toEqual([[null, ''], ['NULL', '9223372036854775807']]);
  root.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'a', metaKey: true }));
  expect(grid.copyRows('selection')).toEqual([[null, ''], ['NULL', '9223372036854775807']]);
});

test('FR-018: Given mouse selection and virtualization, When the active cell scrolls out, Then selection survives and its accessibility reference never points to absent DOM', () => {
  grid.setPage({ columns: ['a'], rows: Array.from({ length: 100 }, (_, i) => [String(i)]), hasMore: false }, 0); flush();
  element('browser-rows').children[0]?.children[0]?.click(); flush();
  expect(grid.selection()?.value).toBe('0');
  expect(root.attributes.get('aria-activedescendant')).toBe('browser-cell-0-0');
  element('browser-viewport').scrollTop = 2800;
  element('browser-viewport').dispatchEvent(new Event('scroll')); flush();
  expect(grid.selection()?.value).toBe('0');
  expect(root.attributes.has('aria-activedescendant')).toBe(false);
});

test('FR-018: Given an old painted page, When replacement clears selection, Then its callback cannot report old DOM under the new page', () => {
  grid.dispose();
  const observed: { renderedRows: number; first: string | null | undefined }[] = [];
  grid = new BrowserGrid(root as unknown as HTMLElement, () => {}, () => {}, () => {
    observed.push({ renderedRows: grid.metrics().renderedRows, first: grid.firstRow()[0]?.text });
  });
  grid.setPage({ columns: ['a'], rows: [['old']], hasMore: true }, 0); flush(); observed.length = 0;
  grid.setPage({ columns: ['a'], rows: [['new']], hasMore: false }, 100);
  expect(observed).toEqual([{ renderedRows: 0, first: undefined }]);
});

test('FR-018: Given the narrowed details layout, When navigating offscreen fidelity columns, Then DOM summaries identify every exact cell by its actual column', () => {
  element('browser-viewport').clientWidth = 620;
  const values = [null, '', 'NULL', '9223372036854775807', '-9223372036854775808', '[BLOB 24 bytes]', '1e-200', '2026-10-10T12:00:00+08:00', '<script>literal</script>'];
  grid.setPage({ columns: values.map((_, i) => `c${String(i)}`), rows: [values], hasMore: false }, 0); flush();
  expect(grid.firstRow()).toHaveLength(6);
  const observed: (string | null | undefined)[] = [];
  for (let column = 0; column < values.length; column++) {
    grid.selectCell(0, column); flush();
    const cell = grid.firstRow().find((cell) => cell.column === column);
    expect(cell).toBeDefined(); observed.push(cell?.text);
  }
  expect(observed).toEqual(['NULL', '(empty)', ...values.slice(2)]);
  expect(grid.metrics().renderedColumns).toBeLessThan(values.length);
});
