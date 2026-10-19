import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../../src/protocol';
import { BrowserElement, browserRoot } from './browser-dom';

const editor = vi.hoisted((): { construct: (text: string) => void; disposed: number } => ({ construct: () => {}, disposed: 0 }));
vi.mock('../../webview/sql-editor', () => ({ SqlEditor: class {
  private readonly initial: string;
  constructor(...args: unknown[]) { this.initial = typeof args[3] === 'string' ? args[3] : ''; editor.construct(this.initial); }
  get text(): string { return this.initial; }
  metrics() { return { editorReady: true, sqlLength: this.initial.length, selectionLength: 0, highlighted: true }; }
  setDisabled(): void { /* Startup tests do not exercise keyboard input. */ }
  dispose(): void { editor.disposed++; }
} }));

let root: BrowserElement;
let surface: EventTarget;
let sent: WebviewToHostMessage[];
let respond: (message: HostToWebviewMessage) => void;
let deliverImmediately: boolean;
let replies: HostToWebviewMessage[];
let saved: unknown;

beforeEach(() => {
  vi.resetModules(); editor.disposed = 0; editor.construct = () => {};
  root = browserRoot(['browser-grid', 'browser-viewport', 'browser-track', 'browser-rows', 'browser-header',
    'browser-select', 'browser-list-previous', 'browser-list-next', 'browser-previous', 'browser-next',
    'browser-count', 'browser-cancel', 'browser-size', 'browser-status', 'browser-total', 'browser-list-status',
    'browser-browse', 'sql-limit-status', 'browser-export-csv', 'browser-export-json',
    'browser-filter-column', 'browser-filter-operator', 'browser-filter-value', 'browser-filter-apply',
    'browser-filter-remove', 'browser-grid-clear', 'browser-grid-summary', 'browser-sort-warning',
    'browser-sort-continue', 'browser-sort-dismiss', 'cell-details', 'cell-title', 'cell-kind', 'cell-value',
    'cell-status', 'cell-copy-cell', 'cell-copy-row', 'cell-copy-selection', 'cell-cancel', 'sql-editor', 'sql-run']);
  const grid = root.elements.get('browser-grid');
  for (const id of ['browser-viewport', 'browser-track', 'browser-rows', 'browser-header']) {
    const element = root.elements.get(id); if (element !== undefined) { grid?.elements.set(id, element); }
  }
  surface = new EventTarget(); sent = []; replies = []; saved = undefined; deliverImmediately = true;
  const dispatch = (message: HostToWebviewMessage): void => { surface.dispatchEvent(new MessageEvent('message', { data: message })); };
  respond = (message) => { if (deliverImmediately) { dispatch(message); } else { replies.push(message); } };
  vi.stubGlobal('window', surface);
  vi.stubGlobal('document', { createElement: () => new BrowserElement(),
    getElementById: (id: string) => id === 'browser' ? root : root.elements.get(id) ?? null,
    querySelector: (selector: string) => selector === 'meta[name="style-nonce"]' ? { content: 'nonce' } : null });
  vi.stubGlobal('HTMLButtonElement', BrowserElement);
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
  vi.stubGlobal('acquireVsCodeApi', () => ({ getState: () => saved, setState: (state: unknown) => { saved = state; return state; },
    postMessage: (message: WebviewToHostMessage) => {
      sent.push(message);
      if (message.type === 'browserList') {
        respond({ type: 'browserTables', requestId: message.requestId, offset: 0, objects: [{ name: 'records', kind: 'table' }], hasMore: false });
      } else if (message.type === 'browserPage') {
        respond({ type: 'browserRows', requestId: message.requestId, table: message.table, offset: 0, limit: 100,
          page: { columns: ['value'], rows: [['9223372036854775807']], hasMore: false } });
      }
    } }));
});
afterEach(() => { surface.dispatchEvent(new Event('pagehide')); vi.unstubAllGlobals(); });

test.each([true, false])('NFR-004: Given initial worker replies delivered immediately=%s, When the SQL editor starts, Then the initial table request has already begun and exact rows survive initialization', async (immediate) => {
  deliverImmediately = immediate;
  let requestedBeforeEditor = false; let rowsBeforeEditor = 0;
  editor.construct = () => {
    requestedBeforeEditor = sent.some((message) => message.type === 'browserList');
    rowsBeforeEditor = root.elements.get('browser-rows')?.children.length ?? 0;
  };
  await import('../../webview/sqlite-browser');
  expect(requestedBeforeEditor).toBe(true);
  expect(rowsBeforeEditor).toBe(immediate ? 1 : 0);
  while (replies.length > 0) {
    const reply = replies.shift(); if (reply !== undefined) { surface.dispatchEvent(new MessageEvent('message', { data: reply })); }
  }
  expect(root.elements.get('browser-rows')?.children[0]?.children[0]?.textContent).toBe('9223372036854775807');
  expect(sent.at(-1)).toMatchObject({ type: 'browserStatus', editorReady: true, busy: false, renderedRows: 1 });
});

test('FR-010: Given an editor constructor failure after initial worker dispatch, When a late response arrives, Then startup fails visibly and the disposed browser cannot consume it', async () => {
  deliverImmediately = false;
  editor.construct = () => { throw new Error('synthetic editor initialization failure'); };
  await import('../../webview/sqlite-browser');
  expect(sent.some((message) => message.type === 'browserList')).toBe(true);
  expect(root.elements.get('browser-status')?.textContent).toContain('Unable to initialize');
  const before = sent.length;
  for (const reply of replies) { surface.dispatchEvent(new MessageEvent('message', { data: reply })); }
  expect(sent).toHaveLength(before); expect(root.elements.get('browser-rows')?.children).toHaveLength(0);
});

test('FR-010: Given saved SQL text, When the early worker request updates persisted state before editor construction, Then the original SQL is restored exactly', async () => {
  const sql = 'SELECT \'🚀\' AS "restored";';
  saved = { requestId: 7, table: 'records', offset: 0, listOffset: 0, limit: 100, sqlText: sql };
  let restored = '';
  editor.construct = (text) => { restored = text; };
  await import('../../webview/sqlite-browser');
  expect(restored).toBe(sql);
  expect(saved).toMatchObject({ sqlText: sql });
});
