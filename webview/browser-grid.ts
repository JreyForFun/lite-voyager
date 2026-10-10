import type { EnginePage } from '../src/engine/engine';

const ROW_HEIGHT = 32;
const COLUMN_WIDTH = 220;
const OVERSCAN = 3;

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

  constructor(private readonly root: HTMLElement, private readonly changed: () => void = () => {}) {
    this.viewport = this.element('browser-viewport'); this.track = this.element('browser-track');
    this.rows = this.element('browser-rows'); this.header = this.element('browser-header');
    this.viewport.addEventListener('scroll', () => { this.schedule(); }, { signal: this.events.signal });
    root.addEventListener('keydown', (event) => { this.key(event); }, { signal: this.events.signal });
    this.observer = new ResizeObserver(() => { this.schedule(); });
    this.observer.observe(this.viewport);
  }

  private element(id: string): HTMLElement {
    const result = this.root.querySelector<HTMLElement>(`#${id}`);
    if (result === null) { throw new Error(`Missing browser grid element: ${id}`); }
    return result;
  }

  setPage(page: EnginePage, offset: number): void {
    this.page = page; this.offset = offset;
    this.rows.replaceChildren(); this.header.replaceChildren();
    this.renderedRows = 0; this.renderedColumns = 0;
    this.viewport.scrollTop = 0; this.viewport.scrollLeft = 0;
    this.root.setAttribute('aria-rowcount', String(page.rows.length + 1));
    this.root.setAttribute('aria-colcount', String(page.columns.length));
    this.root.setAttribute('aria-label', `Rows on this page, starting at row ${String(offset + 1)}. Use arrow keys, Page Up/Down, Home/End; Control+End reaches the last cell.`);
    this.track.style.height = `${String(page.rows.length * ROW_HEIGHT)}px`;
    this.track.style.width = `${String(page.columns.length * COLUMN_WIDTH)}px`;
    this.schedule();
  }

  private schedule(): void {
    if (this.frame === 0 && !this.disposed) {
      this.frame = requestAnimationFrame(() => { this.frame = 0; if (!this.disposed) { this.render(); } });
    }
  }

  private render(): void {
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
      cell.setAttribute('role', 'columnheader'); headers.push(cell);
    }
    for (let row = rowStart; row < rowEnd; row++) {
      const element = document.createElement('div'); element.className = 'browser-row';
      element.setAttribute('role', 'row'); element.setAttribute('aria-rowindex', String(row + 2));
      element.setAttribute('aria-label', `Row ${String(this.offset + row + 1)}`);
      element.style.top = `${String(row * ROW_HEIGHT)}px`;
      for (let column = colStart; column < colEnd; column++) { element.append(this.cell(this.page.rows[row]?.[column] ?? null, column)); }
      rowElements.push(element);
    }
    this.header.style.width = this.track.style.width ?? '';
    this.header.style.transform = `translateX(-${String(this.viewport.scrollLeft)}px)`;
    this.header.replaceChildren(...headers); this.rows.replaceChildren(...rowElements);
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

  lastCell(): void { this.move(this.page.rows.length * ROW_HEIGHT, this.page.columns.length * COLUMN_WIDTH); }

  private key(event: KeyboardEvent): void {
    let row = this.viewport.scrollTop; let column = this.viewport.scrollLeft;
    switch (event.key) {
      case 'ArrowDown': row += ROW_HEIGHT; break;
      case 'ArrowUp': row -= ROW_HEIGHT; break;
      case 'ArrowRight': column += COLUMN_WIDTH; break;
      case 'ArrowLeft': column -= COLUMN_WIDTH; break;
      case 'PageDown': row += this.viewport.clientHeight; break;
      case 'PageUp': row -= this.viewport.clientHeight; break;
      case 'Home': row = 0; if (event.ctrlKey || event.metaKey) { column = 0; } break;
      case 'End': row = this.page.rows.length * ROW_HEIGHT; if (event.ctrlKey || event.metaKey) { column = this.page.columns.length * COLUMN_WIDTH; } break;
      default: return;
    }
    event.preventDefault(); this.move(row, column);
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
      text: (cell.textContent?.length ?? 0) <= 128 ? cell.textContent : null,
      length: cell.textContent?.length ?? 0, label: cell.getAttribute('aria-label'),
    }));
  }

  dispose(): void {
    this.disposed = true; this.events.abort(); this.observer.disconnect(); cancelAnimationFrame(this.frame); this.frame = 0;
    this.page = { columns: [], rows: [], hasMore: false }; this.rows.replaceChildren(); this.header.replaceChildren();
  }
}
