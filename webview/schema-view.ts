import { isBrowserRequest, type BrowserRequest, type BrowserResponse, type BrowserStatus } from '../src/protocol';

type Request = Omit<Extract<BrowserRequest, { type: 'browserSchema' }>, 'type' | 'requestId'>;
type Reply = Extract<BrowserResponse, { type: 'browserSchemaRows' }>;
const labels: Record<string, string> = { cid: 'Ordinal', name: 'Name', type: 'Declared type', notNull: 'NOT NULL', defaultValue: 'Default SQL', primaryKey: 'Primary key ordinal', hidden: 'Hidden/generated', unique: 'Unique', origin: 'Origin', partial: 'Partial', sql: 'SQL', seqno: 'Term ordinal', desc: 'Descending', coll: 'Collation', key: 'Key term' };

/** One opt-in metadata page. No whole-schema cache or execution of displayed SQL. */
export class SchemaView {
  private readonly show: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly title: HTMLElement;
  private readonly kindControl: HTMLSelectElement;
  private readonly size: HTMLSelectElement;
  private readonly index: HTMLInputElement;
  private readonly inspect: HTMLButtonElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly rows: HTMLElement;
  private readonly status: HTMLElement;
  private readonly events = new AbortController();
  private table: string | null = null;
  private kind: Request['kind'] = 'columns';
  private offset = 0;
  private limit = 100;
  private hasMore = false;
  private rowCount = 0;
  private preview = '';
  private busy = false;
  private pending: Request | undefined;

  constructor(root: HTMLElement, private readonly send: (request: Request) => void) {
    const find = <T extends HTMLElement>(id: string): T => {
      const element = root.querySelector<T>(`#${id}`); if (element === null) { throw new Error(`Missing schema control: ${id}`); } return element;
    };
    this.show = find('schema-show'); this.panel = find('schema-panel'); this.title = find('schema-title');
    this.kindControl = find('schema-kind'); this.size = find('schema-size'); this.index = find('schema-index'); this.inspect = find('schema-inspect');
    this.previous = find('schema-previous'); this.next = find('schema-next'); this.rows = find('schema-rows'); this.status = find('schema-status');
    this.panel.hidden = true; this.kindControl.value = 'columns'; this.size.value = '100';
    const options = { signal: this.events.signal };
    this.show.addEventListener('click', () => {
      if (this.show.disabled) { return; }
      this.panel.hidden = !this.panel.hidden; this.show.textContent = this.panel.hidden ? 'View schema' : 'Hide schema';
      if (!this.panel.hidden) { this.load('columns', 0); }
    }, options);
    this.kindControl.addEventListener('change', () => {
      const kind = this.kindControl.value; if (!this.kindControl.disabled && (kind === 'columns' || kind === 'indexes' || kind === 'indexColumns')) { this.load(kind, 0); }
    }, options);
    this.size.addEventListener('change', () => { const limit = Number(this.size.value); if (!this.size.disabled && [1, 10, 100].includes(limit)) { this.load(this.kind, 0, limit); } }, options);
    this.previous.addEventListener('click', () => { if (!this.previous.disabled) { this.load(this.kind, Math.max(0, this.offset - this.limit)); } }, options);
    this.next.addEventListener('click', () => { if (!this.next.disabled) { this.load(this.kind, this.offset + this.limit); } }, options);
    this.inspect.addEventListener('click', () => { if (!this.inspect.disabled) { this.load('indexColumns', 0); } }, options);
    this.controls();
  }
  selectObject(table: string | null): void {
    this.table = table; this.pending = undefined; this.kind = 'columns'; this.offset = 0; this.hasMore = false; this.rowCount = 0; this.preview = '';
    this.rows.replaceChildren(); this.title.textContent = `Schema: ${table === null ? 'no object selected' : table === '' ? '(empty name)' : table}`;
    this.status.textContent = 'Choose View schema to read metadata.'; this.controls();
  }
  setBusy(busy: boolean): void { this.busy = busy; this.controls(); }
  private controls(): void {
    const disabled = this.busy || this.table === null;
    this.show.disabled = disabled; this.kindControl.disabled = disabled; this.size.disabled = disabled; this.inspect.disabled = disabled;
    this.index.disabled = disabled; this.previous.disabled = disabled || this.offset === 0; this.next.disabled = disabled || !this.hasMore;
    if (this.pending === undefined) { this.kindControl.value = this.kind; this.size.value = String(this.limit); }
    this.panel.setAttribute('aria-busy', String(this.busy));
  }
  private load(kind: Request['kind'], offset: number, limit = this.limit): void {
    if (this.table === null || this.busy) { return; }
    const request = { table: this.table, kind, offset, limit, ...(kind === 'indexColumns' ? { index: this.index.value } : {}) };
    if (!isBrowserRequest({ type: 'browserSchema', requestId: 1, ...request })) { this.failed('The schema request exceeds the identifier or page limit, or contains NUL. Nothing was truncated.'); return; }
    this.pending = request;
    this.status.textContent = 'Loading schema metadata in the worker. You can cancel.'; this.send(this.pending);
  }
  receive(message: Reply): void {
    if (message.table !== this.table || this.pending === undefined || message.kind !== this.pending.kind || message.offset !== this.pending.offset || message.limit !== this.pending.limit) { return; }
    this.pending = undefined; this.kind = message.kind; this.offset = message.offset; this.limit = message.limit;
    this.hasMore = message.page.hasMore; this.rowCount = message.page.rows.length;
    this.preview = message.page.rows[0]?.map((value) => value === null ? 'NULL' : value.slice(0, 128)).join(' | ').slice(0, 2048) ?? '';
    const table = document.createElement('table'); const heading = document.createElement('tr');
    for (const column of message.page.columns) { const cell = document.createElement('th'); cell.textContent = labels[column] ?? column; cell.setAttribute('scope', 'col'); heading.append(cell); }
    table.append(heading);
    for (const values of message.page.rows) {
      const row = document.createElement('tr');
      for (const value of values) { const cell = document.createElement('td'); const text = document.createElement('pre'); text.tabIndex = 0;
        text.textContent = value === null ? 'NULL (not declared)' : value === '' ? '(empty)' : value; cell.append(text); row.append(cell); }
      if (message.kind === 'indexes' && typeof values[0] === 'string') {
        const cell = document.createElement('td'); const button = document.createElement('button'); button.textContent = 'Inspect terms';
        button.addEventListener('click', () => { if (!this.busy) { this.index.value = values[0] ?? ''; this.load('indexColumns', 0); } }, { signal: this.events.signal });
        cell.append(button); row.append(cell);
      }
      table.append(row);
    }
    this.rows.replaceChildren(table);
    this.status.textContent = this.rowCount === 0 ? 'No metadata rows on this page.' : `Metadata rows ${String(this.offset + 1)}–${String(this.offset + this.rowCount)}${this.hasMore ? ' · more available' : ' · end of metadata'}`;
    this.controls();
  }
  failed(message: string): void { this.pending = undefined; this.status.textContent = `${message} Previous metadata retained; retry or choose fewer rows.`; this.controls(); }
  summary(): NonNullable<BrowserStatus['schema']> { return { table: this.table, kind: this.kind, offset: this.offset, rows: this.rowCount, hasMore: this.hasMore, preview: this.preview, message: (this.status.textContent ?? '').slice(0, 2048) }; }
  exercise(action: string, value?: string): void {
    const change = (element: HTMLSelectElement, text: string): void => { if (!element.disabled) { element.value = text; element.dispatchEvent(new Event('change')); } };
    if (action === 'schema') { this.show.click(); }
    else if (action === 'schemaKind' && value !== undefined) { change(this.kindControl, value); }
    else if (action === 'schemaSize' && value !== undefined) { change(this.size, value); }
    else if (action === 'schemaIndex' && value !== undefined) { this.index.value = value; this.inspect.click(); }
    else if (action === 'schemaNext') { this.next.click(); }
    else if (action === 'schemaPrevious') { this.previous.click(); }
  }
  dispose(): void { this.events.abort(); this.pending = undefined; this.rows.replaceChildren(); }
}
