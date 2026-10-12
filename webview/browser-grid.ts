import type { EnginePage } from '../src/engine/engine';
import type { GridSort } from '../src/protocol';

const ROW_HEIGHT = 32;
const COLUMN_WIDTH = 220;
const OVERSCAN = 3;
export interface GridSelection { row: number; column: number; rowNumber: number; name: string; value: string | null; }
export type CopyMode = 'cell' | 'row' | 'selection';

export class BrowserGrid {
  private page: EnginePage = { columns: [], rows: [], hasMore: false };
  private offset = 0;
  private readonly viewport: HTMLElement;
  private readonly track: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly header: HTMLElement;
  private readonly observer: ResizeObserver;
  private readonly events = new AbortController();
  private frame = 0;
  private disposed = false;
  private renderedRows = 0;
  private renderedColumns = 0;
  private sort: GridSort | undefined;
  private sortingEnabled = false;
  private readonly headerButtons = new Map<string, HTMLButtonElement>();
  private active: { row: number; column: number } | null = null;
  private anchor: { row: number; column: number } | null = null;

  constructor(private readonly root: HTMLElement, private readonly changed: () => void = () => {}, private readonly sortRequested: (column: string) => void = () => {},
    private readonly selected: (selection: GridSelection | null) => void = () => {}, private readonly copyRequested: () => void = () => {}) {
    this.viewport = this.element('browser-viewport'); this.track = this.element('browser-track');
    this.rows = this.element('browser-rows'); this.header = this.element('browser-header');
    this.viewport.addEventListener('scroll', () => { this.schedule(); }, { signal: this.events.signal });
    root.addEventListener('keydown', (event) => { this.key(event); }, { signal: this.events.signal });
    this.observer = new ResizeObserver(() => { this.schedule(); });
    this.observer.observe(this.viewport);
  }

  setSort(sort: GridSort | undefined, enabled: boolean): void {
    this.sort = sort; this.sortingEnabled = enabled;
    for (const [column, button] of this.headerButtons) {
      button.disabled = !enabled;
      button.textContent = `${column}${sort?.column === column ? sort.direction === 'asc' ? ' ↑' : ' ↓' : ''}`;
      button.parentElement?.setAttribute('aria-sort', sort?.column === column ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none');
    }
  }

  clickHeader(column: string): void { this.headerButtons.get(column)?.click(); }

  private element(id: string): HTMLElement {
    const result = this.root.querySelector<HTMLElement>(`#${id}`);
    if (result === null) { throw new Error(`Missing browser grid element: ${id}`); }
    return result;
  }

  setPage(page: EnginePage, offset: number): void {
    this.page = page; this.offset = offset;
    this.active = null; this.anchor = null; this.root.removeAttribute('aria-activedescendant');
    this.rows.replaceChildren(); this.header.replaceChildren();
    this.renderedRows = 0; this.renderedColumns = 0;
    this.viewport.scrollTop = 0; this.viewport.scrollLeft = 0;
    this.root.setAttribute('aria-rowcount', String(page.rows.length + 1));
    this.root.setAttribute('aria-colcount', String(page.columns.length));
    this.root.setAttribute('aria-label', `Rows on this page, starting at row ${String(offset + 1)}. Use arrow keys, Page Up/Down, Home/End; Control+End reaches the last cell.`);
    this.track.style.height = `${String(page.rows.length * ROW_HEIGHT)}px`;
    this.track.style.width = `${String(page.columns.length * COLUMN_WIDTH)}px`;
    // Clear old DOM/metrics before the details callback can report this page.
    this.selected(null);
    this.schedule();
  }

  private schedule(): void {
    if (this.frame === 0 && !this.disposed) {
      this.frame = requestAnimationFrame(() => { this.frame = 0; if (!this.disposed) { this.render(); } });
    }
  }

  private render(): void {
    const focused = document.activeElement?.getAttribute('data-sort-column');
    this.headerButtons.clear();
    const height = Math.min(560, this.viewport.clientHeight);
    const width = Math.min(4096, this.viewport.clientWidth);
    const rowStart = Math.max(0, Math.floor(this.viewport.scrollTop / ROW_HEIGHT) - OVERSCAN);
    const rowEnd = Math.min(this.page.rows.length, Math.ceil((this.viewport.scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
    const colStart = Math.max(0, Math.floor(this.viewport.scrollLeft / COLUMN_WIDTH) - OVERSCAN);
    const colEnd = Math.min(this.page.columns.length, Math.ceil((this.viewport.scrollLeft + width) / COLUMN_WIDTH) + OVERSCAN);
    const rowElements: HTMLElement[] = [];
    const headers: HTMLElement[] = [];
    for (let column = colStart; column < colEnd; column++) {
      const cell = this.cell(this.page.columns[column] ?? '', column);
      const name = this.page.columns[column] ?? '';
      cell.setAttribute('role', 'columnheader');
      cell.setAttribute('aria-sort', this.sort?.column === name ? this.sort.direction === 'asc' ? 'ascending' : 'descending' : 'none');
      const button = document.createElement('button'); button.className = 'browser-sort';
      button.textContent = `${name}${this.sort?.column === name ? this.sort.direction === 'asc' ? ' ↑' : ' ↓' : ''}`;
      button.title = `Sort ${name}: ascending, descending, unsorted. Equal keys have no guaranteed tie order.`;
      button.setAttribute('data-sort-column', name); button.disabled = !this.sortingEnabled;
      button.addEventListener('click', () => { if (this.sortingEnabled) { this.sortRequested(name); } });
      cell.replaceChildren(button); this.headerButtons.set(name, button); headers.push(cell);
    }
    for (let row = rowStart; row < rowEnd; row++) {
      const element = document.createElement('div'); element.className = 'browser-row';
      element.setAttribute('role', 'row'); element.setAttribute('aria-rowindex', String(row + 2));
      element.setAttribute('aria-label', `Row ${String(this.offset + row + 1)}`);
      element.style.top = `${String(row * ROW_HEIGHT)}px`;
      for (let column = colStart; column < colEnd; column++) {
        const cell = this.cell(this.page.rows[row]?.[column] ?? null, column);
        cell.id = `browser-cell-${String(row)}-${String(column)}`;
        cell.setAttribute('aria-selected', String(this.includes(row, column)));
        cell.addEventListener('click', (event) => { this.root.focus(); this.selectCell(row, column, event.shiftKey); });
        element.append(cell);
      }
      rowElements.push(element);
    }
    this.header.style.width = this.track.style.width ?? '';
    this.header.style.transform = `translateX(-${String(this.viewport.scrollLeft)}px)`;
    this.header.replaceChildren(...headers); this.rows.replaceChildren(...rowElements);
    if (this.active !== null && this.active.row >= rowStart && this.active.row < rowEnd && this.active.column >= colStart && this.active.column < colEnd) {
      this.root.setAttribute('aria-activedescendant', `browser-cell-${String(this.active.row)}-${String(this.active.column)}`);
    } else { this.root.removeAttribute('aria-activedescendant'); }
    if (focused !== null && focused !== undefined) { this.headerButtons.get(focused)?.focus(); }
    this.renderedRows = rowElements.length; this.renderedColumns = headers.length;
    this.changed();
  }

  private cell(value: string | null, column: number): HTMLElement {
    const cell = document.createElement('div');
    cell.className = `browser-cell${value === null ? ' cell-null' : value === '' ? ' cell-empty' : ''}`;
    cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-colindex', String(column + 1));
    cell.style.left = `${String(column * COLUMN_WIDTH)}px`;
    cell.textContent = value === null ? 'NULL' : value === '' ? '(empty)' : value;
    cell.title = cell.textContent;
    if (value === null || value === '') { cell.setAttribute('aria-label', value === null ? 'SQL NULL' : 'Empty string'); }
    return cell;
  }

  lastCell(): void { this.selectCell(this.page.rows.length - 1, this.page.columns.length - 1); }

  selection(): GridSelection | null {
    return this.active === null ? null : { ...this.active, rowNumber: this.offset + this.active.row + 1,
      name: this.page.columns[this.active.column] ?? '', value: this.page.rows[this.active.row]?.[this.active.column] ?? null };
  }

  selectCell(row: number, column: number, extend = false): void {
    if (this.disposed || !Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= this.page.rows.length || column >= this.page.columns.length) { return; }
    this.active = { row, column }; if (!extend || this.anchor === null) { this.anchor = { row, column }; }
    const top = row * ROW_HEIGHT; const left = column * COLUMN_WIDTH;
    const scrollRow = top < this.viewport.scrollTop ? top : top + ROW_HEIGHT > this.viewport.scrollTop + this.viewport.clientHeight ? top + ROW_HEIGHT - this.viewport.clientHeight : this.viewport.scrollTop;
    const scrollColumn = left < this.viewport.scrollLeft ? left : left + COLUMN_WIDTH > this.viewport.scrollLeft + this.viewport.clientWidth ? left + COLUMN_WIDTH - this.viewport.clientWidth : this.viewport.scrollLeft;
    this.move(scrollRow, scrollColumn); this.selected(this.selection());
  }

  private includes(row: number, column: number): boolean {
    return this.active !== null && this.anchor !== null && row >= Math.min(this.active.row, this.anchor.row) && row <= Math.max(this.active.row, this.anchor.row)
      && column >= Math.min(this.active.column, this.anchor.column) && column <= Math.max(this.active.column, this.anchor.column);
  }

  copyRows(mode: CopyMode): (string | null)[][] | null {
    if (this.active === null || this.anchor === null || this.disposed) { return null; }
    if (mode === 'cell') { return [[this.selection()?.value ?? null]]; }
    if (mode === 'row') { return [this.page.rows[this.active.row]?.slice() ?? []]; }
    const start = Math.min(this.active.column, this.anchor.column); const end = Math.max(this.active.column, this.anchor.column) + 1;
    return this.page.rows.slice(Math.min(this.active.row, this.anchor.row), Math.max(this.active.row, this.anchor.row) + 1).map((row) => row.slice(start, end));
  }

  private key(event: KeyboardEvent): void {
    // Header buttons keep native Space/Enter and browser shortcuts.
    if (event.target !== this.root || this.page.rows.length === 0 || this.page.columns.length === 0) { return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); this.copyRequested(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault(); this.selectCell(0, 0); this.selectCell(this.page.rows.length - 1, this.page.columns.length - 1, true); return;
    }
    let row = this.active?.row ?? 0; let column = this.active?.column ?? 0;
    switch (event.key) {
      case 'ArrowDown': row++; break;
      case 'ArrowUp': row--; break;
      case 'ArrowRight': column++; break;
      case 'ArrowLeft': column--; break;
      case 'PageDown': row += Math.max(1, Math.floor(this.viewport.clientHeight / ROW_HEIGHT)); break;
      case 'PageUp': row -= Math.max(1, Math.floor(this.viewport.clientHeight / ROW_HEIGHT)); break;
      case 'Home': row = 0; if (event.ctrlKey || event.metaKey) { column = 0; } break;
      case 'End': row = this.page.rows.length - 1; if (event.ctrlKey || event.metaKey) { column = this.page.columns.length - 1; } break;
      default: return;
    }
    event.preventDefault(); this.selectCell(Math.max(0, Math.min(row, this.page.rows.length - 1)), Math.max(0, Math.min(column, this.page.columns.length - 1)), event.shiftKey);
  }

  private move(row: number, column: number): void {
    this.viewport.scrollTop = Math.max(0, Math.min(row, this.page.rows.length * ROW_HEIGHT - this.viewport.clientHeight));
    this.viewport.scrollLeft = Math.max(0, Math.min(column, this.page.columns.length * COLUMN_WIDTH - this.viewport.clientWidth));
    this.schedule();
  }

  metrics() {
    return { cachedRows: this.page.rows.length, renderedRows: this.renderedRows, renderedColumns: this.renderedColumns, columns: this.page.columns.length };
  }

  /** Summaries read the actual DOM, never send long cell contents to the host. */
  firstRow() {
    const row = this.rows.firstElementChild;
    return row === null ? [] : Array.from(row.children).slice(0, 12).map((cell) => ({
      column: Number(cell.getAttribute('aria-colindex')) - 1,
      text: (cell.textContent?.length ?? 0) <= 128 ? cell.textContent : null,
      length: cell.textContent?.length ?? 0, label: cell.getAttribute('aria-label'),
    }));
  }

  dispose(): void {
    this.disposed = true; this.events.abort(); this.observer.disconnect(); cancelAnimationFrame(this.frame); this.frame = 0;
    this.headerButtons.clear(); this.page = { columns: [], rows: [], hasMore: false }; this.rows.replaceChildren(); this.header.replaceChildren();
    this.active = null; this.anchor = null; this.root.removeAttribute('aria-activedescendant'); this.selected(null);
  }
}
