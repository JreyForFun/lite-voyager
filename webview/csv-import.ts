import { isCsvImportExercise, isCsvImportState, type CsvImportRequest, type CsvPreviewRequest, type CsvPreviewStatus } from '../src/protocol';
import { CsvPreviewView } from './csv-preview';

type Post = (message: CsvImportRequest | CsvPreviewRequest | CsvPreviewStatus) => void;
export class CsvImportView {
  readonly preview: CsvPreviewView;
  private readonly events = new AbortController();
  private readonly delimiter: HTMLSelectElement;
  private readonly header: HTMLInputElement;
  private readonly text: HTMLInputElement;
  private readonly refresh: HTMLButtonElement;
  private readonly start: HTMLButtonElement;
  private readonly cancel: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly progress: HTMLProgressElement;
  private dirty = false;
  private phase = 'loading';
  private disposed = false;
  private readonly fixedOptions: boolean;
  private readonly workbook: boolean;
  constructor(root: HTMLElement, private readonly contextId: string, post: Post) {
    this.fixedOptions = ['json', 'xlsx'].includes(root.getAttribute('data-format') ?? ''); this.workbook = root.getAttribute('data-format') === 'xlsx';
    const element = <T extends HTMLElement>(id: string): T => {
      const result = root.querySelector<T>(`#${id}`); if (result === null) { throw new Error(`Missing import element: ${id}`); } return result;
    };
    this.delimiter = element('import-delimiter'); this.header = element('import-header'); this.text = element('import-text');
    this.refresh = element('import-refresh'); this.start = element('import-start'); this.cancel = element('import-cancel');
    this.status = element('import-status'); this.progress = element('import-progress');
    this.preview = new CsvPreviewView(root, contextId, post);
    for (const input of [this.delimiter, this.header, this.text]) {
      input.addEventListener('change', () => { this.dirty = true; this.start.disabled = true; this.status.textContent = 'Apply options / preview before importing.'; }, { signal: this.events.signal });
    }
    this.refresh.addEventListener('click', () => {
      if (!['ready', 'error'].includes(this.phase)) { return; }
      if (this.fixedOptions) { this.refresh.disabled = true; this.start.disabled = true; post({ type: 'csvImportRefresh', contextId, options: {} }); return; }
      const delimiter = this.delimiter.value;
      if (delimiter !== ',' && delimiter !== '\t' && delimiter !== ';' && delimiter !== '|') { return; }
      this.refresh.disabled = true; this.start.disabled = true;
      post({ type: 'csvImportRefresh', contextId, options: { delimiter, header: this.header.checked, allText: this.text.checked } });
    }, { signal: this.events.signal });
    this.start.addEventListener('click', () => {
      if (this.phase === 'ready' && !this.dirty) { this.start.disabled = true; post({ type: 'csvImportStart', contextId }); }
    }, { signal: this.events.signal });
    this.cancel.addEventListener('click', () => { this.cancel.disabled = true; post({ type: 'csvImportCancel', contextId }); }, { signal: this.events.signal });
  }
  receive(value: unknown): void {
    if (!this.disposed && isCsvImportExercise(value) && value.contextId === this.contextId) {
      if (value.action === 'refresh' && value.options !== undefined) {
        this.delimiter.value = value.options.delimiter ?? this.delimiter.value; this.header.checked = value.options.header !== false; this.text.checked = value.options.allText === true;
        this.delimiter.dispatchEvent(new Event('change')); this.refresh.click();
      } else if (value.action === 'start') { this.start.click(); }
      else if (value.action === 'cancel') { this.cancel.click(); }
      return;
    }
    if (this.disposed || !isCsvImportState(value) || value.contextId !== this.contextId || this.phase === 'cancelled' || this.phase === 'opened') { return; }
    this.phase = value.phase; this.status.textContent = value.message; this.status.setAttribute('role', value.phase === 'error' ? 'alert' : 'status');
    const busy = ['loading', 'importing', 'opening'].includes(value.phase);
    for (const input of [this.delimiter, this.header, this.text]) { input.disabled = busy || value.phase === 'cancelled'; }
    this.refresh.disabled = !['ready', 'error'].includes(value.phase); this.start.disabled = value.phase !== 'ready'; this.cancel.disabled = !busy;
    this.progress.hidden = value.phase !== 'importing';
    if (value.progress !== undefined) {
      const total = BigInt(value.progress.totalBytes); const bytes = BigInt(value.progress.bytes);
      this.progress.value = total === 0n ? 0 : Number(bytes * 10000n / total) / 100;
    }
    if (value.phase === 'ready' && value.preview !== undefined) {
      this.dirty = false; if ('delimiter' in value.preview) { this.delimiter.value = value.preview.delimiter; }
      this.header.checked = value.options.header !== false; this.text.checked = value.options.allText === true;
      this.preview.receive({ type: 'csvPreviewState', contextId: this.contextId, phase: 'ready', message: value.preview.notice, preview: value.preview });
    } else if (value.phase === 'loading' || value.phase === 'error' || value.phase === 'cancelled') {
      this.preview.receive({ type: 'csvPreviewState', contextId: this.contextId, phase: value.phase, message: this.workbook ? '' : value.message });
    }
  }
  dispose(): void { this.disposed = true; this.events.abort(); this.preview.dispose(); }
}

declare function acquireVsCodeApi(): { postMessage(message: CsvImportRequest | CsvPreviewRequest | CsvPreviewStatus): void };
if (typeof acquireVsCodeApi === 'function') {
  const root = document.getElementById('csv-import'); const contextId = root?.getAttribute('data-context');
  if (root !== null && contextId !== null && contextId !== undefined) {
    const api = acquireVsCodeApi(); const view = new CsvImportView(root, contextId, (message) => { api.postMessage(message); });
    window.addEventListener('message', (event: MessageEvent<unknown>) => { view.receive(event.data); });
    window.addEventListener('pagehide', () => { view.dispose(); });
  }
}
