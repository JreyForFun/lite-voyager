import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { isCsvPreviewResult, isCsvPreviewState, isHostMessage, isWebviewMessage, MAX_PREVIEW_CHARACTERS, type CsvPreviewState } from '../../src/protocol';
import { csvPreviewHtml } from '../../src/editor/csv-preview-ui';
import { CsvPreviewView } from '../../webview/csv-preview';
import { BrowserElement, browserRoot } from './browser-dom';

const contextId = '1'.repeat(32);
const ready: CsvPreviewState = { type: 'csvPreviewState', contextId, phase: 'ready', message: 'Preview only', preview: {
  columns: ['value', 'missing', 'literal'], rows: [['', null, 'NULL'], ['<script>source</script>', 'line\ntext', '9007199254740993']],
  delimiter: ',', header: true, bytesRead: '100', totalBytes: '100', reachedEnd: true, notice: '', threadId: 1,
} };
let root: BrowserElement;
let view: CsvPreviewView;
let frames: FrameRequestCallback[];
const post = vi.fn();
const element = (id: string): BrowserElement => {
  const value = root.elements.get(id); if (value === undefined) { throw new Error('Missing element'); } return value;
};
beforeEach(() => {
  frames = []; post.mockClear();
  root = browserRoot(['browser-grid', 'csv-status', 'csv-cancel', 'csv-cell-title', 'csv-cell-value']);
  const grid = browserRoot(['browser-viewport', 'browser-track', 'browser-rows', 'browser-header']); root.elements.set('browser-grid', grid);
  vi.stubGlobal('document', { createElement: () => new BrowserElement() });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
  view = new CsvPreviewView(root as unknown as HTMLElement, contextId, post);
});
afterEach(() => { view.dispose(); vi.unstubAllGlobals(); });
const flush = (): void => { const pending = frames; frames = []; for (const callback of pending) { callback(0); } };

test('FR-004: Given preview messages, When validating unknown input, Then bounds, sparse arrays and stale-context structure are enforced', () => {
  expect(isCsvPreviewState(ready)).toBe(true);
  expect(isHostMessage(ready)).toBe(true);
  expect(isWebviewMessage({ type: 'csvPreviewCancel', contextId })).toBe(true);
  expect(isWebviewMessage({ type: 'csvPreviewCancel', contextId: '' })).toBe(false);
  expect(isCsvPreviewResult({ ...ready.preview, rows: [new Array(3)] })).toBe(false);
  expect(isCsvPreviewResult({ ...ready.preview, columns: new Array(3) })).toBe(false);
  expect(isCsvPreviewResult({ ...ready.preview, rows: [['x'.repeat(MAX_PREVIEW_CHARACTERS), '', '']] })).toBe(false);
  expect(isCsvPreviewResult({ ...ready.preview, bytesRead: '101' })).toBe(false);
  expect(isCsvPreviewResult({ ...ready.preview, totalBytes: '-1' })).toBe(false);
  expect(isCsvPreviewResult({ ...ready.preview, delimiter: { toString: () => ',' } })).toBe(false);
  expect(isCsvPreviewState({ ...ready, phase: ['error'] })).toBe(false);
});

test('NFR-009: Given hostile filenames, When generating the preview shell, Then text is escaped and only local nonce scripts are permitted', () => {
  const html = csvPreviewHtml('<img src=x onerror=alert(1)>', contextId, { scriptUri: 'local:preview.js', styleUri: 'local:preview.css', nonce: 'nonce', cspSource: 'local:' });
  expect(html).toContain('&lt;img'); expect(html).not.toContain('<img');
  expect(html).toContain("default-src 'none'"); expect(html).toContain("script-src 'nonce-nonce'");
  expect(html).not.toMatch(/https?:\/\//u); expect(html).not.toContain('unsafe-inline');
  expect(html).toContain('100'); expect(html).toContain('UTF-16'); expect(html).toContain('role="grid"');
});

test('FR-004: Given an exact preview, When rendering and selecting cells, Then missing/empty/literal NULL are distinct and complete text is safely inspectable', () => {
  view.receive(ready); flush();
  const grid = element('browser-grid'); const cells = grid.elements.get('browser-rows')?.children[0]?.children;
  expect(cells?.map((cell) => cell.textContent)).toEqual(['(empty)', '(missing)', 'NULL']);
  expect(cells?.[1]?.getAttribute('aria-label')).toBe('Missing CSV field');
  view.grid.selectCell(1, 0);
  expect(element('csv-cell-value').textContent).toBe('<script>source</script>');
  expect(element('csv-cell-value').children).toEqual([]);
  view.grid.selectCell(1, 1); expect(element('csv-cell-value').textContent).toBe('line\ntext');
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'csvPreviewStatus', contextId, renderedRows: 2 }));
});

test('FR-004: Given cancellation or old replies, When delivered, Then stale messages cannot replace the cancellation and controls explain recovery', () => {
  expect(post).toHaveBeenCalledWith({ type: 'csvPreviewReady', contextId });
  element('csv-cancel').click(); expect(post).toHaveBeenCalledWith({ type: 'csvPreviewCancel', contextId });
  view.receive({ type: 'csvPreviewState', contextId, phase: 'cancelled', message: 'Cancelled. Reopen to try again.' });
  view.receive(ready); view.receive({ ...ready, contextId: '2'.repeat(32) });
  expect(element('csv-status').textContent).toContain('Cancelled');
  expect(view.grid.metrics().cachedRows).toBe(0);
  expect(element('csv-cancel').disabled).toBe(true);
});
