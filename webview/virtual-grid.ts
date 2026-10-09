import { SPIKE_COLUMNS, type SpikePage, type SpikeStatus, type WebviewToHostMessage } from '../src/protocol';
import { GridPages, gridWindow, logicalOffset, physicalOffset, ROW_HEIGHT, trackHeight } from './grid-window';

export class VirtualGrid {
  private readonly pages = new GridPages();
  private readonly viewport: HTMLElement;
  private readonly track: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly header: HTMLElement;
  private readonly observer: ResizeObserver;
  private readonly listeners = new AbortController();
  private count = 0;
  private offset = 0;
  private expectedScroll = 0;
  private frame = 0;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private failed = false;
  private disposed = false;
  constructor(private readonly root: HTMLElement, private readonly status: HTMLElement,
    private readonly post: (message: WebviewToHostMessage) => void) {
    this.viewport = this.element('viewport');
    this.track = this.element('track');
    this.rows = this.element('rows');
    this.header = this.element('grid-header');
    for (const name of SPIKE_COLUMNS) {
      const cell = document.createElement('div');
      cell.setAttribute('role', 'columnheader');
      cell.textContent = name;
      this.header.append(cell);
    }
    const options = { signal: this.listeners.signal };
    this.viewport.addEventListener('scroll', () => {
      if (Math.abs(this.viewport.scrollTop - this.expectedScroll) > 0.05) {
        this.offset = logicalOffset(this.count, this.viewport.scrollTop, this.viewport.clientHeight);
        this.expectedScroll = this.viewport.scrollTop;
      }
      this.schedule();
    }, options);
    this.viewport.addEventListener('wheel', (event) => {
      if (event.ctrlKey) { return; }
      event.preventDefault();
      const unit = event.deltaMode === 1 ? ROW_HEIGHT : event.deltaMode === 2 ? this.viewport.clientHeight : 1;
      if (event.shiftKey) { this.viewport.scrollLeft += (event.deltaY + event.deltaX) * unit; }
      else { this.viewport.scrollLeft += event.deltaX * unit; this.move(this.offset + event.deltaY * unit); }
    }, { ...options, passive: false });
    this.root.addEventListener('keydown', (event) => {
      let target: number;
      switch (event.key) {
        case 'ArrowDown': target = this.offset + ROW_HEIGHT; break;
        case 'ArrowUp': target = this.offset - ROW_HEIGHT; break;
        case 'PageDown': target = this.offset + this.viewport.clientHeight; break;
        case 'PageUp': target = this.offset - this.viewport.clientHeight; break;
        case 'Home': target = 0; break;
        case 'End': target = this.count * ROW_HEIGHT; break;
        case 'ArrowRight': this.viewport.scrollLeft += 80; event.preventDefault(); return;
        case 'ArrowLeft': this.viewport.scrollLeft -= 80; event.preventDefault(); return;
        default: return;
      }
      event.preventDefault();
      this.move(target);
    }, options);
    this.observer = new ResizeObserver(() => { this.move(this.offset); });
    this.observer.observe(this.viewport);
  }
  private element(id: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (element === null) { throw new Error(`Missing grid element: ${id}`); }
    return element;
  }
  initialize(count: number): void {
    this.count = count;
    this.track.style.height = `${trackHeight(count)}px`;
    this.move(0);
  }
  jump(row: number): void { this.move((row - 1) * ROW_HEIGHT); this.root.focus(); }
  receive(page: SpikePage): void {
    if (this.disposed || this.failed || !this.pages.accept(page)) { return; }
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.schedule();
  }
  error(message: string): void {
    this.failed = true;
    clearTimeout(this.timeout);
    this.status.textContent = message;
    this.root.setAttribute('aria-busy', 'false');
  }
  private move(target: number): void {
    this.offset = Math.max(0, Math.min(target, Math.max(0, this.count * ROW_HEIGHT - this.viewport.clientHeight)));
    this.viewport.scrollTop = physicalOffset(this.count, this.offset, this.viewport.clientHeight);
    this.expectedScroll = this.viewport.scrollTop;
    this.schedule();
  }
  private schedule(): void {
    if (this.frame !== 0 || this.disposed || this.failed) { return; }
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }
  private render(): void {
    if (this.count === 0 || this.viewport.clientHeight === 0) { return; }
    const range = gridWindow(this.count, this.offset, this.viewport.clientHeight);
    const fragment = document.createDocumentFragment();
    let loading = false;
    for (let index = range.start; index < range.end; index++) {
      const row = document.createElement('div');
      row.className = 'data-row';
      row.setAttribute('role', 'row');
      row.setAttribute('aria-rowindex', String(index + 2));
      row.style.top = `${this.viewport.scrollTop + index * ROW_HEIGHT - this.offset}px`;
      const values = this.pages.row(index);
      if (values === undefined) { loading = true; }
      for (let column = 0; column < SPIKE_COLUMNS.length; column++) {
        const cell = document.createElement('div');
        cell.setAttribute('role', 'gridcell');
        cell.textContent = values?.[column] ?? 'Loading…';
        row.append(cell);
      }
      fragment.append(row);
    }
    this.rows.replaceChildren(fragment);
    this.header.style.transform = `translateX(${-this.viewport.scrollLeft}px)`;
    this.root.setAttribute('aria-busy', String(loading));
    const firstRow = Math.floor(this.offset / ROW_HEIGHT);
    const lastRow = Math.min(this.count, Math.ceil((this.offset + this.viewport.clientHeight) / ROW_HEIGHT));
    this.status.textContent = `${loading ? 'Loading · ' : ''}Rows ${(firstRow + 1).toLocaleString()}–${lastRow.toLocaleString()} of ${this.count.toLocaleString()} · ${range.end - range.start} rendered · ${this.pages.cachedRows} cached`;
    const request = this.pages.request(range.start, range.end);
    if (request !== undefined) {
      this.timeout = setTimeout(() => { this.error('Rows did not arrive. Close and reopen the spike.'); }, 10000);
      this.post(request);
    }
    const diagnostics: SpikeStatus = { type: 'spikeStatus', editorReady: true,
      renderedRows: range.end - range.start, cachedRows: this.pages.cachedRows,
      firstRow, requestInFlight: this.pages.inFlight };
    this.post(diagnostics);
  }
  dispose(): void {
    this.disposed = true;
    this.listeners.abort();
    this.observer.disconnect();
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timeout);
    this.pages.clear();
    this.rows.replaceChildren();
  }
}
