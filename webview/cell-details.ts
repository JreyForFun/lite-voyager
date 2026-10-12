import { isCellRequest, isCellResponse, type CellRequest, type CellResponse } from '../src/protocol';
import type { CopyMode, GridSelection } from './browser-grid';

export class CellDetails {
  private readonly title: HTMLElement;
  private readonly kind: HTMLElement;
  private readonly value: HTMLElement;
  private readonly status: HTMLElement;
  private readonly buttons: HTMLButtonElement[];
  private readonly cancelButton: HTMLButtonElement;
  private readonly events = new AbortController();
  private selected: GridSelection | null = null;
  private id = 0;
  private detailsId = 0;
  private copyId = 0;
  private cancelId = 0;
  private preparingDetails = false;
  private preparingCopy = false;
  private disposed = false;

  constructor(root: HTMLElement, private readonly contextId: string, private readonly post: (message: CellRequest) => void,
    private readonly rows: (mode: CopyMode) => (string | null)[][] | null, private readonly changed: () => void) {
    const find = <T extends HTMLElement>(id: string): T => {
      const result = root.querySelector<T>(`#${id}`);
      if (result === null) { throw new Error(`Missing cell details element: ${id}`); }
      return result;
    };
    this.title = find('cell-title'); this.kind = find('cell-kind'); this.value = find('cell-value'); this.status = find('cell-status');
    this.cancelButton = find('cell-cancel');
    this.buttons = (['cell', 'row', 'selection'] as const).map((mode) => {
      const button = find<HTMLButtonElement>(`cell-copy-${mode}`);
      button.addEventListener('click', () => { this.copy(mode); }, { signal: this.events.signal }); return button;
    });
    this.cancelButton.addEventListener('click', () => { this.cancel(); }, { signal: this.events.signal });
    this.clear();
  }

  select(selection: GridSelection | null): void {
    if (this.disposed) { return; }
    // Page replacement reports atomically from BrowserView after all page
    // metadata, controls and messages have been committed.
    if (selection === null) { this.clear(); return; }
    this.selected = selection; this.detailsId = ++this.id; this.preparingDetails = true;
    this.title.textContent = `Row ${String(selection.rowNumber)} · Column ${String(selection.column + 1)}: ${selection.name}`;
    this.kind.textContent = selection.value === null ? 'SQL NULL' : selection.value === '' ? 'Empty string' : 'Stored text';
    this.value.textContent = selection.value ?? 'NULL';
    this.message('Preparing details… The complete raw value is shown while formatting.'); this.controls();
    const request: CellRequest = { type: 'cellDetails', contextId: this.contextId, id: this.detailsId, value: selection.value };
    if (isCellRequest(request)) { this.post(request); }
    else { this.preparingDetails = false; this.message('This cell exceeds the details input budget. The complete raw value is shown.', true); this.controls(); }
    this.changed();
  }

  private clear(): void {
    this.selected = null; this.detailsId = ++this.id; this.preparingDetails = false;
    this.title.textContent = 'Cell details'; this.kind.textContent = ''; this.value.textContent = '';
    if (!this.preparingCopy) { this.message('Select a cell to see its complete value.'); }
    this.controls();
  }

  copy(mode: CopyMode): void {
    if (this.disposed || this.preparingCopy || this.selected === null) { return; }
    const rows = this.rows(mode); if (rows === null) { return; }
    const request: CellRequest = { type: 'cellCopy', contextId: this.contextId, id: ++this.id, rows };
    if (!isCellRequest(request)) {
      this.message('Copy exceeds the page input budget. Copy fewer cells. Nothing was truncated; the clipboard was not changed.', true); this.changed(); return;
    }
    this.copyId = request.id; this.preparingCopy = true;
    this.message('Preparing TSV for the clipboard… You can cancel preparation.'); this.controls(); this.post(request); this.changed();
  }

  cancel(): void {
    if (this.disposed || !this.preparingDetails && !this.preparingCopy) { return; }
    this.cancelId = ++this.id; this.detailsId = this.cancelId; this.copyId = this.cancelId;
    this.preparingDetails = false; this.preparingCopy = false;
    this.message('Cancelling cell preparation… A clipboard write already started may finish.'); this.controls();
    this.post({ type: 'cellCancel', contextId: this.contextId, id: this.cancelId }); this.changed();
  }

  receive(reply: CellResponse): void {
    if (this.disposed || !isCellResponse(reply) || reply.contextId !== this.contextId) { return; }
    if (reply.type === 'cellDetailsResult' && reply.id === this.detailsId && this.selected !== null) {
      this.preparingDetails = false; this.value.textContent = reply.detail.text; this.kind.textContent = reply.detail.kind;
      if (!this.preparingCopy) { this.message(reply.detail.notice || 'Cell details complete. Copy uses the original stored value.'); }
    } else if (reply.type === 'cellCopyResult' && reply.id === this.copyId && this.preparingCopy) {
      this.preparingCopy = false; this.message(reply.message);
    } else if (reply.type === 'cellFailed') {
      if (reply.operation === 'details' && reply.id === this.detailsId && this.selected !== null) {
        this.preparingDetails = false; this.message(`${reply.message} The complete raw value remains shown.`, true);
      } else if (reply.operation === 'copy' && reply.id === this.copyId && this.preparingCopy) { this.preparingCopy = false; this.message(reply.message, true); }
      else if (reply.operation === 'cancel' && reply.id === this.cancelId && reply.id === this.id) { this.message(reply.message); }
      else { return; }
    } else { return; }
    this.controls(); this.changed();
  }

  private message(text: string, error = false): void { this.status.textContent = text; this.status.setAttribute('role', error ? 'alert' : 'status'); }
  private controls(): void {
    for (const button of this.buttons) { button.disabled = this.selected === null || this.preparingCopy; }
    this.cancelButton.disabled = !this.preparingDetails && !this.preparingCopy;
  }
  summary() {
    const text = this.value.textContent ?? '';
    return { row: this.selected?.row ?? null, column: this.selected?.column ?? null, length: text.length,
      preview: text.length <= 128 ? text : null, kind: this.kind.textContent ?? '', busy: this.preparingDetails || this.preparingCopy, message: this.status.textContent ?? '' };
  }
  dispose(): void { this.events.abort(); this.clear(); this.disposed = true; }
}
