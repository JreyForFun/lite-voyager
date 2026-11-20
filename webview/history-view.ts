import type { BrowserResponse, HistoryAction } from '../src/protocol';

/** Loading a history entry edits the SQL document; it never executes a query. */
export class HistoryView {
  private readonly show: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly select: HTMLSelectElement;
  private readonly load: HTMLButtonElement;
  private readonly clear: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly events = new AbortController();
  private count = 0;
  constructor(root: HTMLElement, send: (action: HistoryAction) => void, private readonly loaded: (sql: string) => void) {
    const find = <T extends HTMLElement>(id: string): T => { const node = root.querySelector<T>(`#${id}`); if (node === null) { throw new Error(`Missing history control ${id}`); } return node; };
    this.show = find('history-show'); this.panel = find('history-panel'); this.select = find('history-select'); this.load = find('history-load'); this.clear = find('history-clear'); this.status = find('history-status');
    this.panel.hidden = true; this.setBusy(false); const options = { signal: this.events.signal };
    this.show.addEventListener('click', () => { if (!this.show.disabled) { this.panel.hidden = false; send({ action: 'list' }); } }, options);
    this.load.addEventListener('click', () => { if (!this.load.disabled && /^[a-f\d]{32}$/u.test(this.select.value)) { send({ action: 'load', id: this.select.value }); } }, options);
    this.clear.addEventListener('click', () => { if (!this.clear.disabled) { send({ action: 'clear' }); } }, options);
  }
  receive(message: BrowserResponse): void {
    if (message.type === 'browserHistoryEntries') {
      this.count = message.entries.length;
      this.select.replaceChildren(...message.entries.map((entry, index) => {
        const option = document.createElement('option'); option.value = entry.id;
        option.textContent = `${String(index + 1)}. ${entry.preview}${entry.length > entry.preview.length ? '…' : ''} (${String(entry.length)} characters)`; return option;
      })); this.select.value = message.entries[0]?.id ?? '';
      this.status.textContent = `${String(this.count)} of 50 recent successful runs. Load changes editor text without running it.`;
      this.setBusy(false);
    } else if (message.type === 'browserHistorySql') { this.loaded(message.sql); this.status.textContent = 'Complete query loaded into the SQL editor. Review it, then Run explicitly. Editor Undo restores the previous text.'; }
  }
  setBusy(busy: boolean): void { this.show.disabled = busy; this.select.disabled = busy || this.count === 0; this.load.disabled = busy || this.count === 0; this.clear.disabled = busy || this.count === 0; }
  exercise(action: string, value?: string): void {
    if (action === 'historyShow') { this.show.click(); }
    else if (action === 'historySelect' && value !== undefined && !this.select.disabled) { this.select.value = value; }
    else if (action === 'historyLoad') { this.load.click(); }
    else if (action === 'historyClear') { this.clear.click(); }
  }
  summary(): { count: number; selected: string } { return { count: this.count, selected: this.select.value }; }
  dispose(): void { this.events.abort(); }
}
