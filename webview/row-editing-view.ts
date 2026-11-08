import type { EditingState } from '../src/protocol';
import { editValue, type DeleteTarget, type EditKind, type EditValue, type RowSchema } from '../src/staging/edit-types';

type RowAction = { action: 'rowSchema'; table: string } | { action: 'insert'; target: { table: string; values: { column: string; value: EditValue }[] } }
  | { action: 'delete'; target: DeleteTarget };

/** Saved pages keep their offsets; pending rows have their own paged review. */
export class RowEditingView {
  private readonly add: HTMLButtonElement;
  private readonly remove: HTMLButtonElement;
  private readonly confirm: HTMLButtonElement;
  private readonly dismissDelete: HTMLButtonElement;
  private readonly prompt: HTMLElement;
  private readonly form: HTMLElement;
  private readonly title: HTMLElement;
  private readonly column: HTMLSelectElement;
  private readonly kind: HTMLSelectElement;
  private readonly value: HTMLTextAreaElement;
  private readonly field: HTMLButtonElement;
  private readonly fields: HTMLElement;
  private readonly stage: HTMLButtonElement;
  private readonly dismiss: HTMLButtonElement;
  private readonly help: HTMLElement;
  private readonly pending: HTMLElement;
  private readonly list: HTMLElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly pageStatus: HTMLElement;
  private readonly events = new AbortController();
  private table: string | null = null;
  private target: DeleteTarget | undefined;
  private schema: RowSchema | undefined;
  private draft = new Map<string, EditValue>();
  private changes: string[] = [];
  private offset = 0;
  private writable = false;
  private busy = true;
  private insertCount: number | undefined;
  private awaitingSchema = false;

  constructor(root: HTMLElement, private readonly send: (action: RowAction) => void) {
    const find = <T extends HTMLElement>(id: string): T => {
      const element = root.querySelector<T>(`#${id}`); if (element === null) { throw new Error(`Missing row control: ${id}`); } return element;
    };
    this.add = find('edit-add'); this.remove = find('edit-delete'); this.confirm = find('edit-delete-confirm'); this.dismissDelete = find('edit-delete-dismiss');
    this.prompt = find('edit-delete-prompt'); this.form = find('row-form'); this.title = find('row-title'); this.column = find('row-column'); this.kind = find('row-type');
    this.value = find('row-value'); this.field = find('row-field'); this.fields = find('row-fields'); this.stage = find('row-stage'); this.dismiss = find('row-dismiss');
    this.help = find('row-help'); this.pending = find('row-pending'); this.list = find('row-pending-list'); this.previous = find('row-pending-prev');
    this.next = find('row-pending-next'); this.pageStatus = find('row-pending-status');
    this.form.hidden = true; this.prompt.hidden = true; this.pending.hidden = true;
    const options = { signal: this.events.signal };
    this.add.addEventListener('click', () => {
      if (this.add.disabled || this.table === null) { return; }
      this.awaitingSchema = true;
      this.send({ action: 'rowSchema', table: this.table });
    }, options);
    this.remove.addEventListener('click', () => {
      if (this.remove.disabled || this.target === undefined) { return; }
      this.prompt.hidden = false; this.confirm.focus();
    }, options);
    this.confirm.addEventListener('click', () => {
      if (this.confirm.disabled || this.prompt.hidden || this.target === undefined) { return; }
      this.prompt.hidden = true; this.send({ action: 'delete', target: this.target });
    }, options);
    this.dismissDelete.addEventListener('click', () => { this.prompt.hidden = true; this.remove.focus(); }, options);
    this.column.addEventListener('change', () => { this.loadField(); }, options);
    this.kind.addEventListener('change', () => { this.controls(); }, options);
    this.field.addEventListener('click', () => { this.setField(); }, options);
    this.stage.addEventListener('click', () => {
      if (this.stage.disabled || this.schema === undefined) { return; }
      if (!this.setField()) { return; }
      this.insertCount = this.currentCount;
      this.send({ action: 'insert', target: { table: this.schema.table, values: [...this.draft].map(([column, value]) => ({ column, value })) } });
    }, options);
    this.dismiss.addEventListener('click', () => { this.form.hidden = true; this.draft.clear(); this.add.focus(); }, options);
    this.previous.addEventListener('click', () => { this.offset = Math.max(0, this.offset - 10); this.renderPending(); }, options);
    this.next.addEventListener('click', () => { if (this.offset + 10 < this.changes.length) { this.offset += 10; this.renderPending(); } }, options);
  }

  setTable(table: string | null): void {
    if (this.table !== table) { this.table = table; this.schema = undefined; this.awaitingSchema = false; this.draft.clear(); this.form.hidden = true; this.prompt.hidden = true; }
    this.controls();
  }
  select(target: DeleteTarget | undefined): void { this.target = target; this.prompt.hidden = true; this.controls(); }
  receive(state: EditingState): void {
    this.writable = state.writeMode;
    if (this.insertCount !== undefined && !state.busy) {
      if (state.count > this.insertCount) { this.form.hidden = true; this.draft.clear(); }
      this.insertCount = undefined;
    }
    if (this.awaitingSchema && state.rowSchema !== undefined && state.rowSchema.table === this.table && this.writable) {
      this.schema = state.rowSchema; this.draft.clear(); this.form.hidden = false;
      this.title.textContent = `Add a row to ${this.table ?? ''}`;
      this.column.replaceChildren(...state.rowSchema.columns.map((column) => {
        const option = document.createElement('option'); option.value = column.name; option.textContent = `${column.name}${column.type === '' ? '' : ` (${column.type})`}`; return option;
      }));
      this.column.value = state.rowSchema.columns[0]?.name ?? ''; this.loadField(); this.column.focus();
    }
    if (!state.busy) { this.awaitingSchema = false; }
    if (!this.writable) { this.form.hidden = true; this.prompt.hidden = true; }
    this.changes = state.rowChanges ?? []; this.offset = Math.min(this.offset, Math.max(0, Math.floor((this.changes.length - 1) / 10) * 10));
    this.renderPending();
  }
  setBusy(busy: boolean, count: number): void { this.busy = busy; this.controls(); this.currentCount = count; }
  private currentCount = 0;
  private loadField(): void {
    const field = this.draft.get(this.column.value); this.kind.value = field?.kind ?? 'default'; this.value.value = field?.text ?? '';
    const metadata = this.schema?.columns.find((column) => column.name === this.column.value);
    this.help.textContent = `Default (omit): ${metadata?.defaultSql ?? 'SQLite supplies NULL or an automatic INTEGER primary key'}. Select a type, enter a value and Apply column. Unlisted columns keep their defaults.`;
    this.renderFields(); this.controls();
  }
  private setField(): boolean {
    if (this.field.disabled || !this.schema?.columns.some((column) => column.name === this.column.value)) { return false; }
    try {
      if (this.kind.value === 'default') { this.draft.delete(this.column.value); }
      else { this.draft.set(this.column.value, editValue(this.kind.value as EditKind, this.value.value)); }
      this.renderFields(); this.help.textContent = 'Column applied to this draft. Stage added row queues it; only Save writes the source.';
      return true;
    } catch (error: unknown) { this.help.textContent = error instanceof Error ? error.message : 'Invalid row value.'; return false; }
  }
  private renderFields(): void {
    this.fields.textContent = this.draft.size === 0 ? 'All columns: Default (omit).'
      : [...this.draft].map(([column, value]) => `${column}: ${value.kind === 'null' ? 'NULL' : `${value.kind} ${value.text.length <= 120 ? JSON.stringify(value.text) : `(preview) ${JSON.stringify(value.text.slice(0, 120))}… (${String(value.text.length)} characters)`}`}`).join('\n');
  }
  private renderPending(): void {
    this.pending.hidden = this.changes.length === 0;
    this.list.replaceChildren(...this.changes.slice(this.offset, this.offset + 10).map((label) => { const item = document.createElement('li'); item.textContent = label; return item; }));
    this.pageStatus.textContent = this.changes.length === 0 ? 'No pending row changes'
      : `Row changes ${String(this.offset + 1)}–${String(Math.min(this.offset + 10, this.changes.length))} of ${String(this.changes.length)}`;
    this.previous.disabled = this.offset === 0; this.next.disabled = this.offset + 10 >= this.changes.length;
  }
  private controls(): void {
    const blocked = this.busy || !this.writable;
    this.add.disabled = blocked || this.table === null || !this.form.hidden;
    this.remove.disabled = blocked || this.target === undefined || this.target.table !== this.table;
    this.confirm.disabled = this.remove.disabled; this.dismissDelete.disabled = this.busy;
    this.column.disabled = blocked || this.schema === undefined || this.schema.columns.length === 0;
    this.kind.disabled = this.column.disabled; this.value.disabled = this.column.disabled || this.kind.value === 'default' || this.kind.value === 'null';
    this.field.disabled = this.column.disabled; this.stage.disabled = blocked || this.schema === undefined || this.form.hidden !== false;
    this.dismiss.disabled = this.busy;
  }
  exercise(action: string, value?: string): void {
    if (action === 'rowAdd') { this.add.click(); }
    else if (action === 'rowColumn' && !this.column.disabled && value !== undefined) { this.column.value = value; this.column.dispatchEvent(new Event('change')); }
    else if (action === 'rowType' && !this.kind.disabled && value !== undefined) { this.kind.value = value; this.kind.dispatchEvent(new Event('change')); }
    else if (action === 'rowValue' && !this.value.disabled && value !== undefined) { this.value.value = value; }
    else if (action === 'rowField') { this.field.click(); }
    else if (action === 'rowStage') { this.stage.click(); }
    else if (action === 'rowDelete') { this.remove.click(); }
    else if (action === 'rowConfirm') { this.confirm.click(); }
    else if (action === 'rowDismiss') { this.dismiss.click(); }
  }
  summary(): NonNullable<import('../src/protocol').BrowserStatus['rowEditing']> {
    return { addDisabled: this.add.disabled, deleteDisabled: this.remove.disabled, form: !this.form.hidden, confirm: !this.prompt.hidden,
      column: this.column.value, kind: this.kind.value, fields: this.draft.size, pending: this.changes.length, valueLength: this.value.value.length,
      valuePreview: this.value.value.length <= 128 ? this.value.value : null };
  }
  dispose(): void { this.events.abort(); this.draft.clear(); }
}
