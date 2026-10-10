import { BROWSER_PAGE_SIZE, isBrowserExercise, isBrowserResponse, type BrowserExercise, type BrowserRequest, type BrowserResponse, type BrowserStatus } from '../src/protocol';
import { BrowserGrid } from './browser-grid';
import './sqlite-browser.css';

type Post = (message: BrowserRequest | BrowserStatus) => void;
export interface BrowserSavedState { requestId: number; table: string | null; offset: number; listOffset: number; limit: number; }
const INITIAL_STATE: BrowserSavedState = { requestId: 0, table: null, offset: 0, listOffset: 0, limit: BROWSER_PAGE_SIZE };

function readSavedState(value: unknown): BrowserSavedState {
  if (typeof value !== 'object' || value === null) { return INITIAL_STATE; }
  const state = value as Record<string, unknown>;
  const safe = (number: unknown): number is number => typeof number === 'number' && Number.isSafeInteger(number) && number >= 0 && number < Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE;
  if (!safe(state['requestId']) || !safe(state['offset']) || !safe(state['listOffset']) || typeof state['limit'] !== 'number' || ![1, 10, 100].includes(state['limit'])
    || !(state['table'] === null || typeof state['table'] === 'string' && state['table'].length > 0 && !state['table'].includes('\0'))) { return INITIAL_STATE; }
  return { requestId: state['requestId'], table: state['table'], offset: state['offset'], listOffset: state['listOffset'], limit: state['limit'] };
}

export class BrowserView {
  private readonly grid: BrowserGrid;
  private readonly select: HTMLSelectElement;
  private readonly size: HTMLSelectElement;
  private readonly status: HTMLElement;
  private readonly total: HTMLElement;
  private readonly listStatus: HTMLElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly listPrevious: HTMLButtonElement;
  private readonly listNext: HTMLButtonElement;
  private readonly countButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly events = new AbortController();
  private objects: string[] = [];
  private table: string | null = null;
  private offset = 0;
  private listOffset = 0;
  private listHasMore = false;
  private limit = BROWSER_PAGE_SIZE;
  private hasMore = false;
  private count: string | null = null;
  private requestId = 0;
  private pending: BrowserRequest['type'] | null = null;
  private revision = 0;
  private disposed = false;
  private restoring = true;

  constructor(private readonly root: HTMLElement, private readonly post: Post, private readonly saved: BrowserSavedState = INITIAL_STATE) {
    this.requestId = saved.requestId; this.listOffset = saved.listOffset; this.limit = saved.limit;
    const find = <T extends HTMLElement>(id: string): T => {
      const element = root.querySelector<T>(`#${id}`);
      if (element === null) { throw new Error(`Missing browser element: ${id}`); }
      return element;
    };
    this.select = find('browser-select'); this.size = find('browser-size'); this.status = find('browser-status');
    this.size.value = String(this.limit);
    this.total = find('browser-total'); this.listStatus = find('browser-list-status');
    this.previous = find('browser-previous'); this.next = find('browser-next');
    this.listPrevious = find('browser-list-previous'); this.listNext = find('browser-list-next');
    this.countButton = find('browser-count'); this.cancelButton = find('browser-cancel');
    this.grid = new BrowserGrid(find('browser-grid'), () => { this.report(); });
    const options = { signal: this.events.signal };
    this.select.addEventListener('change', () => { this.choose(this.select.value); }, options);
    this.size.addEventListener('change', () => { this.changeSize(this.size.value); }, options);
    for (const [button, action] of [[this.previous, 'previous'], [this.next, 'next'], [this.listPrevious, 'listPrevious'], [this.listNext, 'listNext'], [this.countButton, 'count'], [this.cancelButton, 'cancel']] as const) {
      button.addEventListener('click', () => { this.exercise({ type: 'browserExercise', action }); }, options);
    }
    this.controls();
  }

  start(): void { this.list(this.listOffset); }

  savedState(): BrowserSavedState {
    if (this.restoring) { return { ...this.saved, requestId: this.requestId }; }
    return { requestId: this.requestId, table: this.table, offset: this.offset, listOffset: this.listOffset, limit: this.limit };
  }

  private request(message: BrowserRequest): void {
    if (this.disposed) { return; }
    this.pending = message.type;
    const label = message.type === 'browserCount' ? 'Counting rows in the worker. You can cancel.'
      : message.type === 'browserCancel' ? 'Cancelling and reopening the database…'
      : message.type === 'browserList' ? 'Loading tables and views…' : 'Loading rows…';
    this.message(label); this.controls(); this.post(message); this.report();
  }

  private list(offset: number): void {
    this.request({ type: 'browserList', requestId: ++this.requestId, offset });
  }
  private page(offset: number): void {
    if (this.table !== null) { this.request({ type: 'browserPage', requestId: ++this.requestId, table: this.table, offset, limit: this.limit }); }
  }
  private choose(table: string, offset = 0): void {
    if (!this.objects.includes(table)) { return; }
    this.table = table; this.select.value = table; this.offset = offset; this.count = null; this.hasMore = false;
    this.grid.setPage({ columns: [], rows: [], hasMore: false }, 0);
    this.total.textContent = 'Total rows: not counted'; this.page(offset);
  }
  private changeSize(value: string): void {
    const size = Number(value);
    if (![1, 10, 100].includes(size)) { return; }
    this.limit = size; this.size.value = value; this.page(0);
  }

  receive(message: BrowserResponse): void {
    if (this.disposed || message.requestId !== this.requestId || this.pending === null || !isBrowserResponse(message)) { return; }
    this.pending = null;
    switch (message.type) {
      case 'browserTables': {
        this.listOffset = message.offset; this.listHasMore = message.hasMore;
        this.objects = message.objects.map((object) => object.name);
        this.select.replaceChildren(...message.objects.map((object) => {
          const option = document.createElement('option'); option.value = object.name;
          option.textContent = `${object.name} (${object.kind})`; return option;
        }));
        this.listStatus.textContent = message.objects.length === 0 ? 'No objects on this page'
          : `Objects ${String(message.offset + 1)}–${String(message.offset + message.objects.length)}${message.hasMore ? ' · more available' : ''}`;
        const first = this.objects[0];
        const restore = this.restoring && this.saved.table !== null && this.objects.includes(this.saved.table);
        this.restoring = false;
        if (first !== undefined) { this.choose(restore ? this.saved.table ?? first : first, restore ? this.saved.offset : 0); return; }
        this.table = null; this.hasMore = false; this.count = null; this.offset = 0;
        this.grid.setPage({ columns: [], rows: [], hasMore: false }, 0);
        this.message('No tables or views in this database.'); this.total.textContent = ''; break;
      }
      case 'browserRows': {
        if (message.table !== this.table) { return; }
        this.offset = message.offset; this.hasMore = message.page.hasMore;
        this.grid.setPage(message.page, message.offset);
        this.message(message.page.rows.length === 0 ? 'No rows on this page.'
          : `Showing rows ${String(message.offset + 1)}–${String(message.offset + message.page.rows.length)}${message.page.hasMore ? ' · more rows available' : ' · end of table'}`);
        break;
      }
      case 'browserCounted':
        if (message.table !== this.table) { return; }
        this.count = message.count; this.total.textContent = `Total rows: ${message.count}`; this.message('Row count complete.'); break;
      case 'browserCancelled': this.message('Operation cancelled. The database is ready; select a table or change page size to retry.'); break;
      case 'browserError': this.message(message.message, true); break;
    }
    this.controls(); this.report();
  }

  private message(text: string, error = false): void { this.status.textContent = text; this.status.setAttribute('role', error ? 'alert' : 'status'); }

  private controls(): void {
    const busy = this.pending !== null;
    this.root.setAttribute('aria-busy', String(busy));
    this.select.disabled = this.objects.length === 0 || this.pending === 'browserList' || this.pending === 'browserCancel';
    this.size.disabled = this.table === null || busy;
    this.previous.disabled = this.table === null || busy || this.offset === 0;
    this.next.disabled = this.table === null || busy || !this.hasMore;
    this.countButton.disabled = this.table === null || busy;
    this.listPrevious.disabled = busy || this.listOffset === 0;
    this.listNext.disabled = busy || !this.listHasMore;
    this.cancelButton.disabled = !busy || this.pending === 'browserCancel';
  }

  exercise(message: BrowserExercise): void {
    if (this.disposed) { return; }
    switch (message.action) {
      case 'select': if (!this.select.disabled && message.value !== undefined) { this.choose(message.value); } break;
      case 'size': if (!this.size.disabled && message.value !== undefined) { this.changeSize(message.value); } break;
      case 'next': if (!this.next.disabled) { this.page(this.offset + this.limit); } break;
      case 'previous': if (!this.previous.disabled) { this.page(Math.max(0, this.offset - this.limit)); } break;
      case 'listNext': if (!this.listNext.disabled) { this.list(this.listOffset + BROWSER_PAGE_SIZE); } break;
      case 'listPrevious': if (!this.listPrevious.disabled) { this.list(Math.max(0, this.listOffset - BROWSER_PAGE_SIZE)); } break;
      case 'count': if (!this.countButton.disabled && this.table !== null) { this.request({ type: 'browserCount', requestId: ++this.requestId, table: this.table }); } break;
      case 'cancel': if (!this.cancelButton.disabled) { this.request({ type: 'browserCancel', requestId: ++this.requestId }); } break;
      case 'lastCell': this.grid.lastCell(); break;
    }
  }

  private report(): void {
    if (!this.disposed) {
      this.post({ type: 'browserStatus', revision: ++this.revision, table: this.table, offset: this.offset, ...this.grid.metrics(),
        hasMore: this.hasMore, count: this.count, busy: this.pending !== null, message: this.status.textContent ?? '', firstRow: this.grid.firstRow() });
    }
  }

  dispose(): void { this.disposed = true; this.events.abort(); this.grid.dispose(); this.objects = []; }
}

declare function acquireVsCodeApi(): {
  postMessage(message: BrowserRequest | BrowserStatus): void;
  getState(): unknown;
  setState(state: BrowserSavedState): BrowserSavedState;
};
if (typeof acquireVsCodeApi === 'function') {
  const api = acquireVsCodeApi();
  const root = document.getElementById('browser');
  if (root !== null) {
    let view: BrowserView | undefined;
    const events = new AbortController();
    try {
      view = new BrowserView(root, (message) => {
        if (view !== undefined) { api.setState(view.savedState()); }
        api.postMessage(message);
      }, readSavedState(api.getState()));
      const browser = view;
      window.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (isBrowserResponse(event.data)) { browser.receive(event.data); }
        else if (isBrowserExercise(event.data)) { browser.exercise(event.data); }
      }, { signal: events.signal });
      window.addEventListener('pagehide', () => { events.abort(); browser.dispose(); }, { once: true });
      browser.start();
    } catch {
      events.abort(); view?.dispose();
      const status = document.getElementById('browser-status');
      if (status !== null) { status.textContent = 'Unable to initialize table browsing. Close and reopen the editor; if it persists, rebuild the extension.'; status.setAttribute('role', 'alert'); }
    }
  }
}
