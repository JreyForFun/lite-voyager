import { MAX_PAGE_BYTES, type Engine, type EnginePage, type PageAddress } from '../engine/engine';
import type { GridOptions } from '../protocol';
import { assertEditOperations, checkWriteStatement, editDisplay, editValue, keyId, MAX_STAGED_BYTES, MAX_STAGED_OPERATIONS, type CellEdit, type EditCommand, type EditOperation, type EditRows, type EditSaveResult, type EditTarget } from './edit-types';
import type { DeleteEdit, DeleteTarget, InsertEdit, InsertTarget, RowSchema } from './edit-types';

/** Document-owned state survives worker cancellation and is never a write handle. */
export class StagedEdits {
  writeMode = false;
  private queue: readonly EditOperation[] = [];
  private version: string | undefined;
  private busy = false;
  constructor(private readonly engine: Pick<Engine, 'edit'>) {}
  get operations(): readonly EditOperation[] { return this.queue; }
  get dirty(): boolean { return this.queue.length > 0; }
  get isBusy(): boolean { return this.busy; }
  discard(): void { this.replace([]); this.version = undefined; this.writeMode = false; }
  private async command<T>(command: EditCommand, engine = this.engine): Promise<T> {
    if (engine.edit === undefined) { throw new Error('This document does not support SQLite editing.'); }
    const result = await engine.edit(command);
    const value = result.rows[0]?.[0]; if (typeof value !== 'string') { throw new Error('Invalid editing worker response. Reopen the document.'); }
    return JSON.parse(value) as T;
  }
  setWriteMode(on: boolean): void { this.idle(); this.writeMode = on; }
  replace(operations: readonly EditOperation[]): void {
    this.idle();
    assertEditOperations(operations);
    if (operations.length > MAX_STAGED_OPERATIONS || Buffer.byteLength(JSON.stringify(operations)) > MAX_STAGED_BYTES) {
      throw new Error('Staging is limited to 1,000 operations and 16 MiB per document. Save or revert first. Nothing was truncated.');
    }
    this.queue = operations.slice();
    // Retain the original version across undo/redo, even when the queue is empty.
  }
  private idle(): void { if (this.busy) { throw new Error('Wait for the current editing operation to finish.'); } }
  private writable(): void { this.idle(); if (!this.writeMode) { throw new Error('Switch on write mode before staging changes.'); } }
  async stage(target: EditTarget): Promise<void> {
    this.writable(); editValue(target.value.kind === 'blob' ? 'text' : target.value.kind, target.value.text);
    this.busy = true;
    try {
      const result = await this.command<{ version: string; operation: CellEdit }>({ action: 'prepare', target, ...(this.version === undefined ? {} : { version: this.version }) });
      this.notDeleted(result.operation.table, result.operation.key);
      const previous = [...this.queue].reverse().find((operation): operation is CellEdit => operation.kind === 'cell'
        && operation.column === target.column && keyId(operation.table, operation.key) === keyId(result.operation.table, result.operation.key));
      if (editDisplay(previous?.value ?? result.operation.before) !== target.expected) { throw new Error('The selected cell changed. Refresh it before staging an edit.'); }
      this.version = result.version;
      // Collapse a row's cells at Save, preserving original identity even after key edits.
      this.busy = false; this.replace([...this.queue, result.operation]);
    } finally { this.busy = false; }
  }
  private notDeleted(table: string, key: DeleteEdit['key']): void {
    if (this.queue.some((operation) => operation.kind === 'delete' && keyId(operation.table, operation.key) === keyId(table, key))) {
      throw new Error('This row is already pending deletion. Undo its deletion before editing or deleting it again.');
    }
  }
  async rowSchema(table: string): Promise<RowSchema> {
    this.writable(); this.busy = true;
    try { return await this.command<RowSchema>({ action: 'schema', table, ...(this.version === undefined ? {} : { version: this.version }) }); }
    finally { this.busy = false; }
  }
  async stageInsert(target: InsertTarget): Promise<void> {
    this.writable(); this.busy = true;
    try {
      const result = await this.command<{ version: string; operation: InsertEdit }>({ action: 'insert', target, ...(this.version === undefined ? {} : { version: this.version }) });
      this.busy = false; this.replace([...this.queue, result.operation]); this.version = result.version;
    } finally { this.busy = false; }
  }
  async stageDelete(target: DeleteTarget): Promise<void> {
    this.writable(); this.busy = true;
    try {
      const result = await this.command<{ version: string; operation: DeleteEdit; before: string | null }>({ action: 'delete', target, ...(this.version === undefined ? {} : { version: this.version }) });
      this.notDeleted(result.operation.table, result.operation.key);
      const previous = [...this.queue].reverse().find((operation): operation is CellEdit => operation.kind === 'cell'
        && operation.column === target.column && keyId(operation.table, operation.key) === keyId(result.operation.table, result.operation.key));
      if ((previous === undefined ? result.before : editDisplay(previous.value)) !== target.expected) { throw new Error('The selected cell changed. Refresh it before staging a deletion.'); }
      this.busy = false; this.replace([...this.queue, result.operation]); this.version = result.version;
    } finally { this.busy = false; }
  }
  async stageSql(sql: string): Promise<void> {
    this.writable(); const checked = checkWriteStatement(sql); this.busy = true;
    try {
      const version = await this.command<string>({ action: 'version' });
      if (this.version !== undefined && this.version !== version) { throw new Error('The source changed. Revert and reopen before staging more changes.'); }
      this.version = version; this.busy = false; this.replace([...this.queue, { kind: 'sql', sql: checked }]);
    } finally { this.busy = false; }
  }
  async page(table: string, grid: GridOptions, page: PageAddress, engine = this.engine): Promise<EnginePage> {
    const result = await this.command<EditRows>({ action: 'rows', table, grid, page, ...(this.dirty && this.version !== undefined ? { version: this.version } : {}) }, engine);
    for (const [index, key] of result.keys.entries()) {
      const row = result.page.rows[index]; if (row === undefined) { continue; }
      const id = keyId(table, key);
      for (const operation of this.queue) {
        if (operation.kind !== 'cell' || keyId(operation.table, operation.key) !== id) { continue; }
        const column = result.page.columns.indexOf(operation.column);
        if (column >= 0) {
          row[column] = editDisplay(operation.value); result.page.staged ??= [];
          if (!result.page.staged.some((cell) => cell.row === index && cell.column === column)) { result.page.staged.push({ row: index, column }); }
        }
      }
    }
    if (Buffer.byteLength(JSON.stringify(result.page)) > MAX_PAGE_BYTES) { throw new Error('The staged result page exceeds 4 MiB. Choose fewer rows. No value was truncated.'); }
    return result.page;
  }
  async save(destination?: string): Promise<void> {
    this.idle(); if (!this.dirty && destination === undefined) { return; }
    this.busy = true;
    try {
      const version = this.version ?? await this.command<string>({ action: 'version' });
      const result = await this.command<EditSaveResult>({ action: 'save', operations: this.queue, version, ...(destination === undefined ? {} : { destination }) });
      if (result !== true) { this.version = result.rollbackVersion; throw new Error(result.error); }
      if (destination === undefined) { this.queue = []; this.version = undefined; }
    } finally { this.busy = false; }
  }
  backup(): string {
    // VS Code can request a backup while a worker operation is in flight.
    // The immutable host queue and its version change together in one JS turn;
    // capture that accepted state synchronously without interrupting the worker.
    // A Save still in flight retains the original token, so recovery cannot
    // silently replay an operation that may already have committed.
    return JSON.stringify({ version: this.version, operations: this.queue });
  }
  restore(text: string): void {
    this.idle(); const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null || !('operations' in value) || !Array.isArray(value.operations)
      || 'version' in value && value.version !== undefined && typeof value.version !== 'string'
      || value.operations.length > 0 && (!('version' in value) || typeof value.version !== 'string')) { throw new Error('The staged-edit backup is invalid. Preserve it for recovery.'); }
    assertEditOperations(value.operations);
    this.replace(value.operations); this.version = 'version' in value && typeof value.version === 'string' ? value.version : undefined; this.writeMode = false;
  }
}
