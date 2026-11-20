import type { SourceRequest, SourceState } from '../src/protocol';
export class SourceView {
  private readonly panel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly refresh: HTMLButtonElement;
  private readonly keep: HTMLButtonElement;
  private readonly events = new AbortController();
  private externalBusy = false;
  private state: SourceState = { type: 'sourceState', changed: false, offered: false, busy: false, message: '' };
  constructor(root: HTMLElement, private readonly post: (message: SourceRequest) => void) {
    const find = <T extends HTMLElement>(id: string): T => { const node = root.querySelector<T>(`#${id}`); if (node === null) { throw new Error(`Missing source control ${id}`); } return node; };
    this.panel = find('source-changes'); this.status = find('source-status'); this.refresh = find('source-refresh'); this.keep = find('source-keep');
    const options = { signal: this.events.signal };
    this.refresh.addEventListener('click', () => { if (!this.refresh.disabled) { post({ type: 'sourceRequest', action: 'refresh' }); } }, options);
    this.keep.addEventListener('click', () => { if (!this.keep.disabled) { post({ type: 'sourceRequest', action: 'keep' }); } }, options);
    this.controls();
  }
  start(): void { this.post({ type: 'sourceRequest', action: 'ready' }); }
  receive(state: SourceState): void { this.state = state; this.controls(); }
  setBusy(busy: boolean): void { this.externalBusy = busy; this.controls(); }
  private controls(): void {
    this.panel.hidden = !this.state.changed && this.state.message === ''; this.status.textContent = this.state.message;
    this.refresh.disabled = this.externalBusy || this.state.busy || !this.state.changed;
    this.keep.disabled = this.refresh.disabled || !this.state.offered; this.keep.hidden = !this.state.offered;
  }
  exercise(action: string): void { if (action === 'sourceRefresh') { this.refresh.click(); } else if (action === 'sourceKeep') { this.keep.click(); } }
  summary(): SourceState { return this.state; }
  dispose(): void { this.events.abort(); }
}
