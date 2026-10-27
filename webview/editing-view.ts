import { isEditingRequest, type EditingRequest, type EditingState } from '../src/protocol';
import { editValue, type EditKind, type EditTarget } from '../src/staging/edit-types';

type Selected = Omit<EditTarget, 'value'>;
export class EditingView {
  private readonly mode: HTMLInputElement;
  private readonly save: HTMLButtonElement;
  private readonly revert: HTMLButtonElement;
  private readonly sql: HTMLButtonElement;
  private readonly cell: HTMLButtonElement;
  private readonly kind: HTMLSelectElement;
  private readonly value: HTMLTextAreaElement;
  private readonly status: HTMLElement;
  private readonly selected: HTMLElement;
  private readonly cancel: HTMLButtonElement;
  private readonly events = new AbortController();
  private readonly contextId = crypto.randomUUID();
  private requestId = 0;
  private revision = -1;
  private disposed = false;
  private browserBusy = false;
  private target: Selected | undefined;
  private state: EditingState = { type: 'editingState', revision: 0, writeMode: false, dirty: false, count: 0, busy: true, message: 'Read-only' };
  constructor(root: HTMLElement, private readonly post: (message: EditingRequest) => void,
    private readonly sqlText: () => string, private readonly refresh: () => void) {
    const find = <T extends HTMLElement>(id: string): T => {
      const element = root.querySelector<T>(`#${id}`); if (element === null) { throw new Error(`Missing editing control: ${id}`); } return element;
    };
    this.mode = find('edit-mode'); this.save = find('edit-save'); this.revert = find('edit-revert'); this.sql = find('edit-sql');
    this.cell = find('edit-cell'); this.kind = find('edit-type'); this.value = find('edit-value'); this.status = find('edit-status'); this.selected = find('edit-selected');
    this.cancel = find('edit-cancel');
    const options = { signal: this.events.signal };
    this.mode.addEventListener('change', () => { this.send({ action: 'mode', on: this.mode.checked }); }, options);
    this.save.addEventListener('click', () => { this.send({ action: 'save' }); }, options);
    this.revert.addEventListener('click', () => { this.send({ action: 'revert' }); }, options);
    this.cancel.addEventListener('click', () => { this.send({ action: 'cancel' }); }, options);
    this.sql.addEventListener('click', () => { this.send({ action: 'sql', sql: this.sqlText() }); }, options);
    this.kind.addEventListener('change', () => { this.controls(); }, options);
    this.cell.addEventListener('click', () => {
      if (this.target === undefined) { return; }
      try { this.send({ action: 'stage', target: { ...this.target, value: editValue(this.kind.value as EditKind, this.value.value) } }); }
      catch (error: unknown) { this.status.textContent = error instanceof Error ? error.message : 'Invalid edit value.'; }
    }, options);
    this.controls();
  }
  start(): void { this.send({ action: 'ready' }); }
  setBrowserBusy(busy: boolean): void { this.browserBusy = busy; this.controls(); }
  private send(action: EditingRequest extends infer R ? R extends EditingRequest ? Omit<R, 'type' | 'contextId' | 'requestId'> : never : never): void {
    if (this.disposed || (this.state.busy || this.browserBusy) && action.action !== 'ready' && action.action !== 'cancel') { return; }
    const message: EditingRequest = { type: 'editingRequest', contextId: this.contextId, requestId: ++this.requestId, ...action };
    if (!isEditingRequest(message)) {
      this.status.textContent = 'Editing input exceeds the 4-Mi-character transport limit or is incomplete. Nothing was truncated.'; return;
    }
    this.state = { ...this.state, busy: true }; this.controls();
    this.post(message);
  }
  select(target: Selected | undefined): void {
    this.target = target;
    this.selected.textContent = target === undefined ? 'Select a Browse cell to edit.' : `${target.table} · row ${String(target.offset + 1)} · ${target.column}`;
    this.kind.value = target?.expected === null ? 'null' : 'text'; this.value.value = this.state.writeMode ? target?.expected ?? '' : '';
    this.controls();
  }
  receive(state: EditingState): void {
    if (this.disposed || state.revision < this.revision) { return; }
    const refresh = this.revision >= 0 && state.revision > this.revision;
    this.revision = state.revision; this.state = state; this.status.textContent = state.message; this.controls();
    if (refresh && !state.busy) { this.refresh(); }
  }
  exercise(action: string, value?: string): void {
    if (this.disposed) { return; }
    if (action === 'editMode' && !this.mode.disabled) { this.mode.checked = value === 'true'; this.mode.dispatchEvent(new Event('change')); }
    else if (action === 'editType' && !this.kind.disabled && value !== undefined) { this.kind.value = value; this.kind.dispatchEvent(new Event('change')); }
    else if (action === 'editValue' && !this.value.disabled && value !== undefined) { this.value.value = value; }
    else if (action === 'editCell') { this.cell.click(); }
    else if (action === 'editSql') { this.sql.click(); }
    else if (action === 'editSave') { this.save.click(); }
    else if (action === 'editRevert') { this.revert.click(); }
  }
  summary(): NonNullable<import('../src/protocol').BrowserStatus['editing']> {
    return { writeMode: this.mode.checked, saveDisabled: this.save.disabled, stageDisabled: this.cell.disabled, busy: this.state.busy,
      kind: this.kind.value, valueLength: this.value.value.length, valuePreview: this.value.value.length <= 128 ? this.value.value : null, message: this.status.textContent ?? '' };
  }
  private controls(): void {
    const busy = this.state.busy || this.browserBusy;
    this.mode.checked = this.state.writeMode; this.mode.disabled = busy;
    this.cancel.disabled = !this.state.busy;
    this.save.disabled = busy || !this.state.dirty; this.revert.disabled = busy || !this.state.dirty;
    this.sql.disabled = busy || !this.state.writeMode;
    this.cell.disabled = busy || !this.state.writeMode || this.target === undefined;
    this.kind.disabled = this.cell.disabled; this.value.disabled = this.cell.disabled || this.kind.value === 'null';
  }
  dispose(): void { this.disposed = true; this.events.abort(); this.target = undefined; }
}
