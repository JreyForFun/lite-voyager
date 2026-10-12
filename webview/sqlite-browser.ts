import { BROWSER_PAGE_SIZE, MAX_SQL_LENGTH, isBrowserExercise, isBrowserResponse, isCellResponse, isGridOptions, type CellRequest, type CellResponse, type GridFilter, type GridOptions, type BrowserExercise, type BrowserRequest, type BrowserResponse, type BrowserStatus } from '../src/protocol';
import { BrowserGrid } from './browser-grid';
import { QueryView } from './query-view';
import { SqlEditor } from './sql-editor';
import { CellDetails } from './cell-details';
import './sqlite-browser.css';

type Post = (message: BrowserRequest | BrowserStatus | CellRequest) => void;
type BrowserSqlEditor = Pick<SqlEditor, 'text' | 'metrics' | 'setDisabled' | 'setText' | 'select' | 'clickRun' | 'shortcut' | 'dispose'>;
export interface BrowserSavedState { requestId: number; table: string | null; offset: number; listOffset: number; limit: number; sqlText?: string; querySql?: string; grid?: GridOptions; }
const INITIAL_STATE: BrowserSavedState = { requestId: 0, table: null, offset: 0, listOffset: 0, limit: BROWSER_PAGE_SIZE };

export function readSavedState(value: unknown): BrowserSavedState {
  if (typeof value !== 'object' || value === null) { return INITIAL_STATE; }
  const state = value as Record<string, unknown>;
  const safe = (number: unknown): number is number => typeof number === 'number' && Number.isSafeInteger(number) && number >= 0 && number < Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE;
  if (!safe(state['requestId']) || !safe(state['offset']) || !safe(state['listOffset']) || typeof state['limit'] !== 'number' || ![1, 10, 100].includes(state['limit'])
    || !(state['table'] === null || typeof state['table'] === 'string' && state['table'].length > 0 && !state['table'].includes('\0'))) { return INITIAL_STATE; }
  const result: BrowserSavedState = { requestId: state['requestId'], table: state['table'], offset: state['offset'], listOffset: state['listOffset'], limit: state['limit'] };
  if (typeof state['sqlText'] === 'string' && state['sqlText'].length <= MAX_SQL_LENGTH) { result.sqlText = state['sqlText']; }
  if (typeof state['querySql'] === 'string' && state['querySql'].length > 0 && state['querySql'].length <= MAX_SQL_LENGTH && !state['querySql'].includes('\0')) { result.querySql = state['querySql']; }
  if (isGridOptions(state['grid'])) { result.grid = savedGrid(state['grid']); }
  return result;
}

function savedGrid(grid: GridOptions): GridOptions {
  return { ...(grid.sort === undefined ? {} : { sort: { column: grid.sort.column, direction: grid.sort.direction } }),
    ...(grid.filters === undefined ? {} : { filters: grid.filters.map((filter) => filter.operator === 'contains'
      ? { column: filter.column, operator: filter.operator, value: filter.value } : { column: filter.column, operator: filter.operator }) }) };
}

export class BrowserView {
  private readonly grid: BrowserGrid;
  private readonly details: CellDetails;
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
  private readonly browseButton: HTMLButtonElement;
  private readonly sqlLimitStatus: HTMLElement;
  private readonly filterColumn: HTMLSelectElement;
  private readonly filterOperator: HTMLSelectElement;
  private readonly filterValue: HTMLInputElement;
  private readonly applyFilter: HTMLButtonElement;
  private readonly removeFilter: HTMLButtonElement;
  private readonly clearGrid: HTMLButtonElement;
  private readonly gridSummary: HTMLElement;
  private readonly sortWarning: HTMLElement;
  private readonly continueSort: HTMLButtonElement;
  private readonly dismissSort: HTMLButtonElement;
  private gridOptions: GridOptions = {};
  private shownGrid: GridOptions = {};
  private columns: string[] = [];
  private pendingPage: Extract<BrowserRequest, { type: 'browserPage' }> | undefined;
  private warningPage: Extract<BrowserRequest, { type: 'browserPage' }> | undefined;
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
  private readonly query = new QueryView();
  private pendingSql: string | null = null;
  private editor: BrowserSqlEditor | undefined;
  private readonly contextId = crypto.randomUUID();
  private exerciseId = 0;

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
    this.browseButton = find('browser-browse');
    this.sqlLimitStatus = find('sql-limit-status');
    this.filterColumn = find('browser-filter-column'); this.filterOperator = find('browser-filter-operator'); this.filterValue = find('browser-filter-value');
    this.applyFilter = find('browser-filter-apply'); this.removeFilter = find('browser-filter-remove'); this.clearGrid = find('browser-grid-clear');
    this.gridSummary = find('browser-grid-summary'); this.sortWarning = find('browser-sort-warning');
    this.continueSort = find('browser-sort-continue'); this.dismissSort = find('browser-sort-dismiss');
    this.details = new CellDetails(root, this.contextId, (message) => { this.post(message); }, (mode) => this.grid.copyRows(mode), () => { this.report(); });
    this.grid = new BrowserGrid(find('browser-grid'), () => { this.report(); }, (column) => { this.sortColumn(column); },
      (selection) => { this.details.select(selection); }, () => { this.details.copy('selection'); });
    const options = { signal: this.events.signal };
    this.select.addEventListener('change', () => { this.choose(this.select.value); }, options);
    this.size.addEventListener('change', () => { this.changeSize(this.size.value); }, options);
    this.filterColumn.addEventListener('change', () => { this.loadFilter(); }, options);
    this.filterOperator.addEventListener('change', () => { this.controls(); }, options);
    this.applyFilter.addEventListener('click', () => { this.applyColumnFilter(); }, options);
    this.filterValue.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); this.applyColumnFilter(); } }, options);
    for (const [button, action] of [[this.removeFilter, 'removeFilter'], [this.clearGrid, 'clearGrid'], [this.continueSort, 'continueSort'], [this.dismissSort, 'dismissSort']] as const) {
      button.addEventListener('click', () => { this.exercise({ type: 'browserExercise', action }); }, options);
    }
    for (const [button, action] of [[this.previous, 'previous'], [this.next, 'next'], [this.listPrevious, 'listPrevious'], [this.listNext, 'listNext'], [this.countButton, 'count'], [this.cancelButton, 'cancel'], [this.browseButton, 'browse']] as const) {
      button.addEventListener('click', () => { this.exercise({ type: 'browserExercise', action }); }, options);
    }
    this.controls();
  }

  start(): void { this.list(this.listOffset); }
  receiveCell(message: CellResponse): void { this.details.receive(message); }

  attachEditor(editor: BrowserSqlEditor): void { this.editor = editor; this.controls(); this.editorChanged(); }
  editorChanged(): void {
    const oversized = (this.editor?.metrics().sqlLength ?? 0) > MAX_SQL_LENGTH;
    this.sqlLimitStatus.textContent = oversized ? 'Editor text exceeds the 4-Mi-character saved-state limit. It is not saved across tab hiding. Nothing was truncated; shorten the document before leaving this tab.' : '';
    this.sqlLimitStatus.hidden = !oversized;
    this.report();
  }
  editorFailed(): void { this.message('The SQL editor could not initialize. Close and reopen the file.', true); this.report(); }

  runSql(sql: string): void {
    if (this.disposed || this.pending === 'browserCancel') { return; }
    if (sql.trim().length === 0) { this.message('Enter SQL or select a statement, then Run.', true); this.report(); return; }
    if (sql.length > MAX_SQL_LENGTH || sql.includes('\0')) {
      this.message('SQL exceeds the 4-Mi-character limit or contains a NUL character. Nothing was truncated. Shorten the text or run a smaller selection. Oversized editor text is not saved across tab hiding.', true);
      this.report(); return;
    }
    this.restoring = false;
    this.queryPage(sql, 0);
  }

  private queryPage(sql: string, offset: number): void {
    this.request({ type: 'browserQuery', requestId: ++this.requestId, sql, offset, limit: this.limit });
  }

  savedState(): BrowserSavedState {
    const state: BrowserSavedState = this.restoring ? { ...this.saved, requestId: this.requestId }
      : { requestId: this.requestId, table: this.table, offset: this.offset, listOffset: this.listOffset, limit: this.limit };
    if (this.query.sql !== null) { state.querySql = this.query.sql; }
    const text = this.editor?.text ?? this.saved.sqlText;
    if (text !== undefined && text.length <= MAX_SQL_LENGTH) { state.sqlText = text; }
    else { delete state.sqlText; }
    if (!this.restoring && (this.shownGrid.sort !== undefined || (this.shownGrid.filters?.length ?? 0) > 0)) { state.grid = savedGrid(this.shownGrid); }
    return state;
  }

  private request(message: BrowserRequest): void {
    if (this.disposed) { return; }
    this.pending = message.type;
    this.warningPage = undefined;
    this.pendingPage = message.type === 'browserPage' ? message : undefined;
    this.pendingSql = message.type === 'browserQuery' ? message.sql : null;
    const label = message.type === 'browserCount' ? 'Counting rows in the worker. You can cancel.'
      : message.type === 'browserCancel' ? 'Cancelling and reopening the database…'
      : message.type === 'browserList' ? 'Loading tables and views…' : message.type === 'browserQuery' ? 'Running SQL in the worker…' : 'Loading rows…';
    this.message(label); this.controls(); this.post(message); this.report();
  }

  private list(offset: number): void {
    this.request({ type: 'browserList', requestId: ++this.requestId, offset });
  }
  private page(offset: number, allowSlowSort = false): void {
    if (this.query.sql !== null) { this.queryPage(this.query.sql, offset); }
    else if (this.table !== null) {
      const grid = this.gridOptions.sort === undefined && (this.gridOptions.filters?.length ?? 0) === 0 ? {} : { grid: { ...this.gridOptions, ...(allowSlowSort ? { allowSlowSort: true } : {}) } };
      this.request({ type: 'browserPage', requestId: ++this.requestId, table: this.table, offset, limit: this.limit, ...grid });
    }
  }
  private choose(table: string, offset = 0, restoredGrid?: GridOptions): void {
    if (!this.objects.includes(table)) { return; }
    this.query.reset();
    this.gridOptions = savedGrid(restoredGrid ?? {}); this.shownGrid = savedGrid(this.gridOptions);
    this.columns = []; this.filterColumn.replaceChildren();
    this.table = table; this.select.value = table; this.offset = offset; this.count = null; this.hasMore = false;
    this.grid.setPage({ columns: [], rows: [], hasMore: false }, 0);
    this.total.textContent = 'Total rows: not counted'; this.page(offset);
  }

  private gridEnabled(): boolean { return this.pending === null && this.query.sql === null && this.table !== null && this.columns.length > 0; }

  private sortColumn(column: string): void {
    if (!this.gridEnabled() || !this.columns.includes(column)) { return; }
    const current = this.gridOptions.sort;
    const next: GridOptions = savedGrid(this.gridOptions);
    if (current?.column === column && current.direction === 'desc') { delete next.sort; }
    else { next.sort = { column, direction: current?.column === column ? 'desc' : 'asc' }; }
    this.changeGrid(next);
  }

  private changeGrid(next: unknown): void {
    if (!isGridOptions(next)) { this.message('Invalid filters: at most 1,000 columns and 65,536 total text characters. Nothing was truncated.', true); this.report(); return; }
    this.gridOptions = next; this.count = null; this.total.textContent = 'Total rows: not counted'; this.page(0);
  }

  private loadFilter(): void {
    const filter = this.gridOptions.filters?.find((item) => item.column === this.filterColumn.value);
    this.filterOperator.value = filter?.operator ?? 'contains';
    this.filterValue.value = filter?.operator === 'contains' ? filter.value : '';
    this.controls();
  }

  private applyColumnFilter(): void {
    if (!this.gridEnabled() || !this.columns.includes(this.filterColumn.value)) { return; }
    const column = this.filterColumn.value; const operator = this.filterOperator.value;
    const filter: GridFilter = operator === 'isNull' || operator === 'isNotNull' ? { column, operator } : { column, operator: 'contains', value: this.filterValue.value };
    this.changeGrid({ ...savedGrid(this.gridOptions), filters: [...(this.gridOptions.filters ?? []).filter((item) => item.column !== column), filter] });
  }
  private changeSize(value: string): void {
    const size = Number(value);
    if (![1, 10, 100].includes(size)) { return; }
    this.limit = size; this.size.value = value; this.page(0);
  }

  receive(message: BrowserResponse): void {
    if (this.disposed || message.requestId !== this.requestId || this.pending === null || !isBrowserResponse(message)) { return; }
    const sql = this.pendingSql;
    const pendingPage = this.pendingPage;
    if (message.type === 'browserQueryRows' && (this.pending !== 'browserQuery' || sql === null)) { return; }
    this.pending = null;
    this.pendingSql = null;
    this.pendingPage = undefined;
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
        const savedQuery = this.restoring ? this.saved.querySql : undefined;
        this.restoring = false;
        if (savedQuery !== undefined) {
          this.table = restore ? this.saved.table : first ?? null;
          this.select.value = this.table ?? ''; this.queryPage(savedQuery, this.saved.offset); return;
        }
        if (first !== undefined) { this.choose(restore ? this.saved.table ?? first : first, restore ? this.saved.offset : 0, restore ? this.saved.grid : undefined); return; }
        this.table = null; this.hasMore = false; this.count = null; this.offset = 0;
        this.grid.setPage({ columns: [], rows: [], hasMore: false }, 0);
        this.message('No tables or views in this database.'); this.total.textContent = ''; break;
      }
      case 'browserRows': {
        if (message.table !== this.table) { return; }
        this.offset = message.offset; this.hasMore = message.page.hasMore;
        this.gridOptions = savedGrid(pendingPage?.grid ?? {}); this.shownGrid = savedGrid(this.gridOptions);
        const selected = this.filterColumn.value;
        this.columns = message.page.columns;
        this.filterColumn.replaceChildren(...this.columns.map((column) => {
          const option = document.createElement('option'); option.value = column; option.textContent = column; return option;
        }));
        this.filterColumn.value = this.columns.includes(selected) ? selected
          : this.gridOptions.filters?.find((filter) => this.columns.includes(filter.column))?.column ?? this.columns[0] ?? '';
        this.loadFilter();
        this.grid.setPage(message.page, message.offset);
        this.message(message.page.rows.length === 0 ? 'No rows on this page.'
          : `Showing rows ${String(message.offset + 1)}–${String(message.offset + message.page.rows.length)}${message.page.hasMore ? ' · more rows available' : ' · end of table'}`);
        break;
      }
      case 'browserQueryRows': {
        if (sql === null) { return; }
        this.offset = message.offset; this.hasMore = message.page.hasMore;
        this.query.commit(sql, message.offset, message.page, message.ms);
        this.count = this.query.count; this.total.textContent = this.query.summary;
        this.grid.setPage(message.page, message.offset);
        this.message('Query complete. Edit SQL and Run, or page these results.');
        break;
      }
      case 'browserCounted':
        if (message.table !== this.table) { return; }
        this.count = message.count; this.total.textContent = `Total rows: ${message.count}`; this.message('Row count complete.'); break;
      case 'browserSortWarning':
        if (message.table !== this.table || pendingPage === undefined) { return; }
        this.warningPage = pendingPage; this.sortWarning.textContent = message.message;
        this.message('Sort needs confirmation. Continue sort or dismiss it; the previous page is retained.'); break;
      case 'browserCancelled':
        this.gridOptions = savedGrid(this.shownGrid); this.loadFilter();
        this.message('Operation cancelled. The database is ready; select a table or change page size to retry.'); break;
      case 'browserError': this.gridOptions = savedGrid(this.shownGrid); this.loadFilter(); this.message(message.message, true); break;
    }
    this.controls(); this.report();
  }

  private message(text: string, error = false): void { this.status.textContent = text; this.status.setAttribute('role', error ? 'alert' : 'status'); }

  private controls(): void {
    const busy = this.pending !== null;
    const pageBlocked = busy || this.warningPage !== undefined;
    this.root.setAttribute('aria-busy', String(busy));
    const results = this.table !== null || this.query.sql !== null;
    this.select.disabled = this.objects.length === 0 || this.pending === 'browserList' || this.pending === 'browserCancel';
    this.size.disabled = pageBlocked;
    this.previous.disabled = !results || pageBlocked || this.offset === 0;
    this.next.disabled = !results || pageBlocked || !this.hasMore;
    this.countButton.disabled = this.table === null || this.query.sql !== null || pageBlocked;
    this.listPrevious.disabled = busy || this.listOffset === 0;
    this.listNext.disabled = busy || !this.listHasMore;
    this.cancelButton.disabled = !busy || this.pending === 'browserCancel';
    this.browseButton.disabled = busy || !this.objects.includes(this.select.value);
    this.editor?.setDisabled(busy);
    const enabled = this.gridEnabled() && this.warningPage === undefined;
    this.grid.setSort(this.gridOptions.sort, enabled);
    this.filterColumn.disabled = !enabled; this.filterOperator.disabled = !enabled;
    this.filterValue.disabled = !enabled || this.filterOperator.value !== 'contains';
    this.applyFilter.disabled = !enabled; this.removeFilter.disabled = !enabled || !this.gridOptions.filters?.some((filter) => filter.column === this.filterColumn.value);
    this.clearGrid.disabled = !enabled || (this.gridOptions.sort === undefined && (this.gridOptions.filters?.length ?? 0) === 0);
    const warning = !busy && this.warningPage !== undefined;
    this.sortWarning.hidden = !warning; this.continueSort.hidden = !warning; this.dismissSort.hidden = !warning;
    this.continueSort.disabled = !warning; this.dismissSort.disabled = !warning;
    this.gridSummary.textContent = this.query.sql !== null ? 'Sort/filter SQL results with ORDER BY / WHERE in the editor.'
      : `Sort: ${this.gridOptions.sort === undefined ? 'none' : `${this.gridOptions.sort.column} ${this.gridOptions.sort.direction}`}. Filters (AND): ${this.gridOptions.filters?.map((filter) => `${filter.column}: ${filter.operator === 'contains' ? `contains ${JSON.stringify(filter.value)}` : filter.operator === 'isNull' ? 'is NULL' : 'is not NULL'}`).join('; ') || 'none'}.`;
  }

  exercise(message: BrowserExercise): void {
    if (this.disposed || !isBrowserExercise(message)) { return; }
    if (message.exerciseId !== undefined) { this.exerciseId = message.exerciseId; }
    switch (message.action) {
      case 'select': if (!this.select.disabled && message.value !== undefined) { this.choose(message.value); } break;
      case 'size': if (!this.size.disabled && message.value !== undefined) { this.changeSize(message.value); } break;
      case 'next': if (!this.next.disabled) { this.page(this.offset + this.limit); } break;
      case 'previous': if (!this.previous.disabled) { this.page(Math.max(0, this.offset - this.limit)); } break;
      case 'listNext': if (!this.listNext.disabled) { this.list(this.listOffset + BROWSER_PAGE_SIZE); } break;
      case 'listPrevious': if (!this.listPrevious.disabled) { this.list(Math.max(0, this.listOffset - BROWSER_PAGE_SIZE)); } break;
      case 'count': if (!this.countButton.disabled && this.table !== null) {
        const filters = this.shownGrid.filters ?? [];
        const grid = filters.length === 0 ? {} : { grid: { filters } };
        this.request({ type: 'browserCount', requestId: ++this.requestId, table: this.table, ...grid });
      } break;
      case 'cancel': if (!this.cancelButton.disabled) { this.request({ type: 'browserCancel', requestId: ++this.requestId }); } break;
      case 'lastCell': this.grid.lastCell(); break;
      case 'cell': case 'extendCell': {
        const coordinates = message.value?.split(',').map(Number) ?? [];
        const [row, column] = coordinates;
        if (coordinates.length === 2 && row !== undefined && column !== undefined) { this.grid.selectCell(row, column, message.action === 'extendCell'); }
        break;
      }
      case 'copyCell': this.details.copy('cell'); break;
      case 'copyRow': this.details.copy('row'); break;
      case 'copySelection': this.details.copy('selection'); break;
      case 'cancelCell': this.details.cancel(); break;
      case 'browse': if (!this.browseButton.disabled) { this.choose(this.select.value); } break;
      case 'sql': if (message.value !== undefined) { this.editor?.setText(message.value); } break;
      case 'selection': {
        const [anchor, head] = message.value?.split(',').map(Number) ?? [];
        if (anchor !== undefined && head !== undefined) { this.editor?.select(anchor, head); }
        break;
      }
      case 'run': this.editor?.clickRun(); break;
      case 'shortcut': this.editor?.shortcut(); break;
      case 'sort': if (message.value !== undefined) { this.grid.clickHeader(message.value); } break;
      case 'filter': {
        if (!this.gridEnabled() || message.value === undefined) { break; }
        try {
          const parsed: unknown = JSON.parse(message.value);
          if (typeof parsed !== 'object' || parsed === null || !('column' in parsed) || typeof parsed.column !== 'string' || !this.columns.includes(parsed.column)) { break; }
          if (!isGridOptions({ filters: [parsed] })) { this.changeGrid({ filters: [parsed] }); break; }
          const filter = parsed as GridFilter;
          this.filterColumn.value = filter.column; this.filterOperator.value = filter.operator;
          this.filterValue.value = filter.operator === 'contains' ? filter.value : ''; this.applyFilter.click();
        } catch { this.message('Invalid filter control.', true); }
        break;
      }
      case 'removeFilter': if (!this.removeFilter.disabled) { this.changeGrid({ ...savedGrid(this.gridOptions), filters: (this.gridOptions.filters ?? []).filter((filter) => filter.column !== this.filterColumn.value) }); } break;
      case 'clearGrid': if (!this.clearGrid.disabled) { this.changeGrid({}); } break;
      case 'continueSort': if (!this.continueSort.disabled && this.warningPage !== undefined) {
        this.request({ ...this.warningPage, requestId: ++this.requestId, grid: { ...this.warningPage.grid, allowSlowSort: true } });
      } break;
      case 'dismissSort': if (!this.dismissSort.disabled) {
        this.warningPage = undefined; this.gridOptions = savedGrid(this.shownGrid); this.loadFilter(); this.message('Sort dismissed. Previous results retained.'); this.controls(); this.report();
      } break;
    }
    if (message.exerciseId !== undefined) { this.report(); }
  }

  private report(): void {
    if (!this.disposed) {
      this.post({ type: 'browserStatus', revision: ++this.revision, table: this.query.sql === null ? this.table : null, offset: this.offset, ...this.grid.metrics(),
        contextId: this.contextId, exerciseId: this.exerciseId,
        cell: this.details.summary(),
        query: this.query.sql !== null, summary: this.total.textContent ?? '', ...this.editor?.metrics(),
        hasMore: this.hasMore, count: this.count, busy: this.pending !== null, message: this.status.textContent ?? '', firstRow: this.grid.firstRow() });
    }
  }

  dispose(): void { this.disposed = true; this.events.abort(); this.details.dispose(); this.grid.dispose(); this.editor?.dispose(); this.query.reset(); this.objects = []; }
}

declare function acquireVsCodeApi(): {
  postMessage(message: BrowserRequest | BrowserStatus | CellRequest): void;
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
      const editorRoot = document.getElementById('sql-editor');
      const runButton = document.getElementById('sql-run');
      const nonce = document.querySelector<HTMLMetaElement>('meta[name="style-nonce"]')?.content;
      if (editorRoot === null || !(runButton instanceof HTMLButtonElement) || nonce === undefined) { throw new Error('Missing SQL editor assets'); }
      const editor = new SqlEditor(editorRoot, runButton, nonce, readSavedState(api.getState()).sqlText ?? '-- Run a read-only statement, or select SQL to run.\nSELECT 1 AS value;',
        (sql) => { browser.runSql(sql); }, () => { browser.editorChanged(); }, () => { browser.editorFailed(); });
      browser.attachEditor(editor);
      window.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (isBrowserResponse(event.data)) { browser.receive(event.data); }
        else if (isCellResponse(event.data)) { browser.receiveCell(event.data); }
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
