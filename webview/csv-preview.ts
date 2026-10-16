import { isCsvPreviewState, type CsvPreviewRequest, type CsvPreviewStatus } from '../src/protocol';
import { BrowserGrid } from './browser-grid';
import './sqlite-browser.css';
import './csv-preview.css';

type Post = (message: CsvPreviewRequest | CsvPreviewStatus) => void;
export class CsvPreviewView {
  readonly grid: BrowserGrid;
  private readonly status: HTMLElement;
  private readonly cancel: HTMLButtonElement;
  private readonly events = new AbortController();
  private phase = 'loading';
  private disposed = false;
  constructor(root: HTMLElement, private readonly contextId: string, private readonly post: Post) {
    const json = root.getAttribute('data-format') === 'json';
    const element = <T extends HTMLElement>(id: string): T => {
      const found = root.querySelector<T>(`#${id}`); if (found === null) { throw new Error(`Missing preview element: ${id}`); } return found;
    };
    this.status = element('csv-status'); this.cancel = element('csv-cancel');
    const title = element('csv-cell-title'); const value = element('csv-cell-value');
    this.grid = new BrowserGrid(element('browser-grid'), () => {
      if (this.disposed || this.phase !== 'ready') { return; }
      const metrics = this.grid.metrics();
      this.post({ type: 'csvPreviewStatus', contextId, renderedRows: metrics.renderedRows, renderedColumns: metrics.renderedColumns });
    }, () => {}, (selection) => {
      title.textContent = selection === null ? 'Selected cell' : `Row ${String(selection.rowNumber)} · ${selection.name}`;
      value.textContent = selection === null ? 'Select a cell to read its complete text.'
        : selection.value === null ? (json ? '(SQL NULL / missing key)' : '(missing field)') : selection.value === '' ? '(empty string)' : selection.value;
    }, () => {}, json ? { display: 'NULL', label: 'JSON null or missing key' } : { display: '(missing)', label: 'Missing CSV field' });
    this.cancel.addEventListener('click', () => {
      if (this.phase === 'loading') { this.cancel.disabled = true; this.post({ type: 'csvPreviewCancel', contextId }); }
    }, { signal: this.events.signal });
    this.post({ type: 'csvPreviewReady', contextId });
  }
  receive(message: unknown): void {
    if (this.disposed || !isCsvPreviewState(message) || message.contextId !== this.contextId || this.phase === 'cancelled') { return; }
    this.phase = message.phase; this.status.textContent = message.message;
    this.status.setAttribute('role', message.phase === 'error' ? 'alert' : 'status');
    this.cancel.disabled = message.phase !== 'loading';
    if (message.phase === 'ready') {
      this.grid.setPage({ columns: message.preview.columns, rows: message.preview.rows, hasMore: false }, 0);
    }
  }
  dispose(): void { this.disposed = true; this.events.abort(); this.grid.dispose(); }
}
declare function acquireVsCodeApi(): { postMessage(message: CsvPreviewRequest | CsvPreviewStatus): void };
if (typeof acquireVsCodeApi === 'function') {
  const root = document.getElementById('csv-preview');
  const contextId = root?.getAttribute('data-context');
  if (root !== null && contextId !== null && contextId !== undefined) {
    const api = acquireVsCodeApi(); const view = new CsvPreviewView(root, contextId, (message) => { api.postMessage(message); });
    window.addEventListener('message', (event: MessageEvent<unknown>) => { view.receive(event.data); });
    window.addEventListener('pagehide', () => { view.dispose(); });
  }
}
