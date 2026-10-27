import { lstatSync, realpathSync, statSync } from 'node:fs';
import { mkdtemp, open, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { EnginePage, PageAddress, Parameter, ReadBackend } from '../engine/engine';
import { collectPage, pageAddress, quoteIdentifier } from '../engine/read-engine';
import { gridPage, gridSql } from '../engine/grid-query';
import { inspectFile } from '../engine/file-snapshot';
import { NodeSqliteEngine } from '../engine/node-sqlite';
import { SqlJsEngine } from '../engine/sqljs';
import type { GridOptions } from '../protocol';
import { assertEditOperations, checkWriteStatement, editValue, keyId, MAX_STAGED_BYTES, MAX_STAGED_OPERATIONS, valueBinding, type CellEdit, type EditCommand, type EditOperation, type EditRows, type EditSaveResult, type EditValue, type RowKey } from './edit-types';

const changed = 'The SQLite source changed. Pending edits were preserved. Revert and reopen the file before saving.';
type Writer = NodeSqliteEngine | SqlJsEngine;
interface Identity { keys: string[]; columns: string[]; editable: Set<string>; }

/** Small metadata fingerprint; never read a database into host memory. Include
 * WAL because committed WAL changes need not alter the main database header. */
export function sourceVersion(path: string): string {
  const records = ['', '-wal'].map((suffix) => {
    try {
      const value = statSync(path + suffix, { bigint: true });
      return [value.dev, value.ino, value.size, value.mtimeNs, value.ctimeNs].map(String);
    } catch (error: unknown) {
      if (suffix !== '' && typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') { return null; }
      throw error;
    }
  });
  return JSON.stringify([realpathSync(path), records]);
}

/** Called only after a supervised, explicit in-place Save was interrupted and
 * its helper exited. Ordinary opens never authorize this recovery connection. */
export function recoverInterruptedSave(path: string, version: string, sqlite: typeof import('node:sqlite')): void {
  const canonical = realpathSync(path);
  try { statSync(canonical + '-journal'); }
  catch (error: unknown) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') { return; } throw error; }
  const original: unknown = JSON.parse(version); const current = statSync(canonical, { bigint: true });
  const records: unknown = Array.isArray(original) ? original[1] : undefined;
  const main: unknown = Array.isArray(records) ? records[0] : undefined;
  if (!Array.isArray(original) || original[0] !== canonical || !Array.isArray(main) || main[0] !== String(current.dev) || main[1] !== String(current.ino)) {
    throw new Error('The SQLite source identity changed. Journal recovery was refused. Preserve the source and its sidecars.');
  }
  const recovery = new NodeSqliteEngine(sqlite, canonical, true);
  try { read(recovery, 'SELECT name FROM main.sqlite_schema LIMIT 1', [], { limit: 1 }); }
  finally { recovery.close(); }
}

function read(backend: ReadBackend, sql: string, parameters: Parameter[] = [], page: PageAddress = { limit: 1000 }): EnginePage {
  return collectPage(backend.cursor(sql, parameters), page);
}
function identity(backend: ReadBackend, table: string): Identity {
  const object = read(backend, "SELECT type,sql FROM main.sqlite_schema WHERE name=? AND name NOT GLOB 'sqlite_*'", [table], { limit: 1 }).rows[0];
  if (object?.[0] !== 'table' || /^CREATE\s+VIRTUAL\s+TABLE/iu.test(object[1] ?? '')) { throw new Error('Only ordinary SQLite tables support inline editing. Views and virtual tables remain read-only.'); }
  const schema = read(backend, "SELECT name,pk,hidden FROM temp.pragma_table_xinfo(?, 'main') ORDER BY cid", [table]);
  if (schema.hasMore) { throw new Error('This table has more than 1,000 columns; inline editing is unavailable. No column was truncated.'); }
  const columns = schema.rows.map((row) => row[0] ?? '');
  const primary = schema.rows.filter((row) => row[1] !== '0').sort((a, b) => Number(a[1]) - Number(b[1])).map((row) => row[0] ?? '');
  const alias = ['rowid', '_rowid_', 'oid'].find((name) => !columns.some((column) => column.toLowerCase() === name));
  if (primary.length === 0 && alias === undefined) { throw new Error('This table has no primary key and shadows every rowid alias. A safe row identity is unavailable.'); }
  return { keys: primary.length > 0 ? primary : [alias ?? 'rowid'], columns,
    editable: new Set(schema.rows.filter((row) => row[2] === '0').map((row) => row[0] ?? '')) };
}
function keyProjection(keys: string[]): string {
  return keys.flatMap((key) => { const column = quoteIdentifier(key); return [`typeof(${column})`, `CASE WHEN typeof(${column})='blob' THEN hex(${column}) ELSE ${column} END`]; }).join(',');
}
function rowKey(keys: string[], row: (string | null)[]): RowKey[] {
  return keys.map((column, index) => {
    const kind = row[index * 2]; const text = row[index * 2 + 1];
    if (!['text', 'integer', 'real', 'null', 'blob'].includes(kind ?? '')) { throw new Error('Invalid SQLite row identity.'); }
    return { column, value: { kind: kind as EditValue['kind'], text: text ?? '' } };
  });
}
function predicate(keys: RowKey[]): { sql: string; parameters: Parameter[] } {
  const parameters: Parameter[] = [];
  const sql = keys.map((key) => {
    const binding = valueBinding(key.value); parameters.push(key.value.kind, binding.parameter);
    return `(typeof(${quoteIdentifier(key.column)})=? AND ${quoteIdentifier(key.column)} COLLATE BINARY IS ${binding.expression})`;
  }).join(' AND ');
  if (sql === '') { throw new Error('A complete row key is required.'); }
  return { sql, parameters };
}

/** Created with the read-only worker, so cancelling and reopening cannot approve
 * an old host queue against a newer source version. No write happens on prepare. */
export class SqliteEdits {
  constructor(private readonly path: string, private readonly directory: string,
    private readonly sqlite: typeof import('node:sqlite') | undefined, private version: string, private readonly requestedPath = path) {}

  async execute(backend: ReadBackend, command: EditCommand, replaceBackend: (replacement: ReadBackend | undefined) => void): Promise<EnginePage> {
    const expected = 'version' in command ? command.version : undefined;
    this.check(expected);
    let value: unknown;
    if (command.action === 'version') { value = this.version; }
    else if (command.action === 'prepare') {
      const target = command.target; pageAddress({ offset: target.offset, limit: 1 });
      if (target.value.kind === 'blob') { throw new Error('BLOB editing is unavailable.'); }
      const metadata = identity(backend, target.table);
      if (!metadata.editable.has(target.column)) { throw new Error('Generated or hidden columns cannot be edited.'); }
      // The user is editing an already displayed sorted row, so its sort was
      // already accepted. Do not turn that prior confirmation into missing keys.
      const result = this.rows(backend, target.table, { ...target.grid, allowSlowSort: true }, { offset: target.offset, limit: 1 }, metadata);
      const key = result.keys[0]; const row = result.page.rows[0];
      if (key === undefined || row === undefined) { throw new Error('The selected row is no longer available. Refresh the table.'); }
      const where = predicate(key);
      if (read(backend, `SELECT COUNT(*) FROM main.${quoteIdentifier(target.table)} WHERE ${where.sql}`, where.parameters, { limit: 1 }).rows[0]?.[0] !== '1') {
        throw new Error('The primary key does not identify exactly one row. Nullable duplicate keys cannot be edited safely.');
      }
      const column = quoteIdentifier(target.column);
      const stored = read(backend, `SELECT typeof(${column}),${column} FROM main.${quoteIdentifier(target.table)} WHERE ${where.sql}`, where.parameters, { limit: 1 }).rows[0];
      const kind = stored?.[0];
      if (kind === 'blob') { throw new Error('BLOB cells are placeholders and cannot be edited.'); }
      if (!['null', 'text', 'integer', 'real'].includes(kind ?? '')) { throw new Error('The cell storage type could not be confirmed.'); }
      const operation: CellEdit = { kind: 'cell', table: target.table, key, column: target.column,
        before: { kind: kind as EditValue['kind'], text: stored?.[1] ?? '' }, value: editValue(target.value.kind, target.value.text) };
      value = { version: this.version, operation };
    } else if (command.action === 'rows') {
      let metadata: Identity | undefined;
      try { metadata = identity(backend, command.table); } catch { /* Browsing remains available for uneditable objects. */ }
      value = metadata === undefined ? { page: gridPage(backend, { type: 'grid', id: 0, table: command.table, options: command.grid, page: command.page, kind: 'rows' }), keys: [] }
        : this.rows(backend, command.table, command.grid, command.page, metadata);
    } else { value = await this.save(backend, command, replaceBackend); }
    // Once a save committed, a later independent writer cannot turn that
    // success into an apparent failure and leave an already-applied queue dirty.
    if (command.action !== 'save') { this.check(expected); }
    const text = JSON.stringify(value);
    if (Buffer.byteLength(text) > 4 * 1024 * 1024) { throw new Error('The editing page exceeds 4 MiB. Choose fewer rows. Nothing was truncated.'); }
    return { columns: ['editing'], rows: [[text]], hasMore: false };
  }

  private check(expected?: string): void {
    if (realpathSync(this.requestedPath) !== this.path || sourceVersion(this.path) !== this.version || expected !== undefined && expected !== this.version) { throw new Error(changed); }
  }
  private rows(backend: ReadBackend, table: string, grid: GridOptions, page: PageAddress, metadata: Identity): EditRows {
    // Keep the ordinary indexed-sort warning and validation unchanged.
    const checked = gridPage(backend, { type: 'grid', id: 0, table, options: grid, page: { ...page, limit: 1 }, kind: 'rows' });
    if (checked.sortWarning !== undefined) { return { page: checked, keys: [] }; }
    const query = gridSql(table, grid);
    const sql = query.sql.replace('SELECT *', `SELECT *,${keyProjection(metadata.keys)}`);
    const result = read(backend, sql, query.parameters, page);
    const width = result.columns.length - metadata.keys.length * 2;
    const keys = result.rows.map((row) => rowKey(metadata.keys, row.slice(width)));
    return { page: { ...result, columns: result.columns.slice(0, width), rows: result.rows.map((row) => row.slice(0, width)) }, keys };
  }

  private validate(operations: readonly EditOperation[]): void {
    assertEditOperations(operations);
    if (!Array.isArray(operations) || operations.length > MAX_STAGED_OPERATIONS || Buffer.byteLength(JSON.stringify(operations)) > MAX_STAGED_BYTES) {
      throw new Error('Staging is limited to 1,000 operations and 16 MiB. Nothing was truncated.');
    }
    for (const operation of operations) {
      if (operation.kind === 'sql') { checkWriteStatement(operation.sql); }
      else if (operation.kind === 'cell' && typeof operation.table === 'string' && typeof operation.column === 'string' && Array.isArray(operation.key)) {
        quoteIdentifier(operation.table); quoteIdentifier(operation.column); predicate(operation.key);
        if (operation.value.kind === 'blob') { throw new Error('BLOB editing is unavailable.'); }
        editValue(operation.value.kind, operation.value.text);
      } else { throw new Error('Invalid staged operation. Preserve the backup and reopen the document.'); }
    }
  }
  private apply(writer: Writer, operations: readonly EditOperation[]): void {
    // Merge each contiguous group of inline operations by ORIGINAL row key.
    // One UPDATE per row means changing a PK cannot orphan its following cells.
    let group: CellEdit[] = [];
    const flush = (): void => {
      const rows = new Map<string, CellEdit[]>();
      for (const operation of group) { const id = keyId(operation.table, operation.key); rows.set(id, [...(rows.get(id) ?? []), operation]); }
      for (const changes of rows.values()) {
        const first = changes[0]; if (first === undefined) { continue; }
        const metadata = identity(writer, first.table);
        if (JSON.stringify(metadata.keys) !== JSON.stringify(first.key.map((key) => key.column))) { throw new Error('The table identity changed. Revert and reopen before saving.'); }
        const where = predicate(first.key);
        if (read(writer, `SELECT COUNT(*) FROM main.${quoteIdentifier(first.table)} WHERE ${where.sql}`, where.parameters, { limit: 1 }).rows[0]?.[0] !== '1') { throw new Error('The saved row key no longer identifies exactly one row.'); }
        const cells = new Map(changes.map((change) => [change.column, change.value]));
        const parameters: Parameter[] = [];
        const set = [...cells].map(([column, value]) => {
          if (!metadata.editable.has(column)) { throw new Error('A generated, hidden or missing column cannot be saved.'); }
          const binding = valueBinding(value); parameters.push(binding.parameter); return `${quoteIdentifier(column)}=${binding.expression}`;
        });
        writer.execute(`UPDATE main.${quoteIdentifier(first.table)} SET ${set.join(',')} WHERE ${where.sql}`, [...parameters, ...where.parameters]);
        if (read(writer, 'SELECT changes()', [], { limit: 1 }).rows[0]?.[0] !== '1') { throw new Error('The inline edit did not update exactly one row. All changes were rolled back.'); }
      }
      group = [];
    };
    for (const operation of operations) {
      if (operation.kind === 'cell') { group.push(operation); }
      else { flush(); writer.execute(checkWriteStatement(operation.sql)); }
    }
    flush();
  }

  private async save(backend: ReadBackend, command: Extract<EditCommand, { action: 'save' }>, replaceBackend: (replacement: ReadBackend | undefined) => void): Promise<EditSaveResult> {
    this.validate(command.operations); this.check(command.version);
    const destination = command.destination;
    if (destination === undefined && this.sqlite !== undefined) {
      const writer = new NodeSqliteEngine(this.sqlite, this.path, true);
      // Keep a connection alive across reader/writer handoffs so SQLite cannot
      // checkpoint/remove WAL metadata between the protected version snapshots.
      let committed = false; let transaction = false; let checked = false; let rolledBack = false; let failure: unknown;
      try {
        backend.close(); replaceBackend(undefined);
        writer.execute('PRAGMA locking_mode=EXCLUSIVE'); writer.execute('BEGIN EXCLUSIVE'); transaction = true;
        this.check(command.version); checked = true;
        this.apply(writer, command.operations); writer.execute('COMMIT'); transaction = false; committed = true;
        this.version = sourceVersion(this.path);
      } catch (error: unknown) {
        failure = error;
        if (transaction) {
          try {
            // OR ROLLBACK and RAISE(ROLLBACK) can already have ended the entire
            // transaction. The native autocommit state confirms that outcome.
            if (writer.inTransaction) { writer.execute('ROLLBACK'); }
            transaction = false;
            if (checked) { this.version = sourceVersion(this.path); rolledBack = true; }
          } catch { /* Without a confirmed protected rollback, retain the old conflict token. */ }
        }
      } finally {
        try {
          if (transaction) { try { writer.execute('ROLLBACK'); } catch { /* Preserve the original failure. */ } }
          writer.execute('PRAGMA locking_mode=NORMAL'); read(writer, 'SELECT name FROM main.sqlite_schema LIMIT 1', [], { limit: 1 });
          const replacement = new NodeSqliteEngine(this.sqlite, this.path);
          replaceBackend(replacement);
        } catch { /* The worker reports an unavailable reader after settling this save. */ }
        finally { writer.close(); }
      }
      if (committed) { return true; }
      if (rolledBack) { return { rollbackVersion: this.version, error: failure instanceof Error ? failure.message : 'Save failed. All changes were rolled back.' }; }
      throw failure instanceof Error ? failure : new Error('Save failed. Pending changes were preserved. Close other database programs before retrying.');
    }
    await this.replaceSave(command); return true;
  }

  private async copy(target: string): Promise<void> {
    const worker = new Worker(join(this.directory, 'sqlite-edit-copy-worker.js'), { workerData: { source: this.path, target } });
    try {
      await new Promise<void>((accept, reject) => {
        let done = false; let failure: Error | undefined;
        worker.on('message', (message: unknown) => {
          if (typeof message === 'object' && message !== null && 'done' in message && message.done === true) { done = true; }
          else { failure = new Error('SQLite Save As could not copy a consistent snapshot. Check permissions, free space and other database writers.'); }
        });
        worker.on('error', () => { failure = new Error('The SQLite copy worker failed. The source was not modified.'); });
        worker.once('exit', (code) => {
          if (failure !== undefined) { reject(failure); }
          else if (code !== 0 || !done) { reject(new Error('The SQLite copy worker stopped before finishing. The source was not modified.')); }
          else { accept(); }
        });
      });
    } finally { await worker.terminate(); }
  }

  private async replaceSave(command: Extract<EditCommand, { action: 'save' }>): Promise<void> {
    // Canonicalize the parent even for a new destination: a directory junction
    // must not turn a different-looking path into a source SQLite sidecar.
    const requestedTarget = command.destination === undefined ? this.path : resolve(command.destination);
    const target = join(realpathSync(dirname(requestedTarget)), basename(requestedTarget));
    const normalized = (path: string): string => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
    const sources = [this.path, realpathSync(this.path)];
    if (command.destination !== undefined && sources.some((source) => ['', '-wal', '-shm', '-journal'].some((suffix) => normalized(target) === normalized(source + suffix)))) {
      throw new Error('Save As cannot replace the original source or its SQLite sidecars.');
    }
    if (command.destination !== undefined && target === this.path) { throw new Error('Save As must choose a different local file. Use Save for this source.'); }
    let initial: string | undefined;
    try {
      const metadata = lstatSync(target, { bigint: true });
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1n) { throw new Error('Atomic Save requires a regular file with one link and no sidecars.'); }
      const original = statSync(this.path, { bigint: true });
      if (command.destination !== undefined && metadata.dev === original.dev && metadata.ino === original.ino) { throw new Error('Save As cannot replace an alias of the original source.'); }
      initial = sourceVersion(target);
    } catch (error: unknown) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) { throw error; }
    }
    for (const suffix of ['-wal', '-shm', '-journal']) {
      try { lstatSync(target + suffix); } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') { continue; } throw error;
      }
      throw new Error('Atomic Save refuses SQLite sidecars. Close other database programs and reopen the file.');
    }
    const directory = command.temporaryDirectory ?? await mkdtemp(join(dirname(target), '.lite-voyager-edit-'));
    if (normalized(realpathSync(dirname(directory))) !== normalized(realpathSync(dirname(target))) || lstatSync(directory).isSymbolicLink()
      || !lstatSync(directory).isDirectory() || !basename(directory).startsWith('.lite-voyager-edit-')) { throw new Error('Invalid owned save workspace.'); }
    const temporary = join(directory, basename(target)); let writer: Writer | undefined;
    try {
      if (this.sqlite !== undefined) {
        await this.copy(temporary);
        writer = new NodeSqliteEngine(this.sqlite, temporary, true);
      } else { writer = await SqlJsEngine.open(inspectFile(this.path), this.directory, true); }
      this.check(command.version); writer.execute('BEGIN');
      try { this.apply(writer, command.operations); writer.execute('COMMIT'); }
      catch (error: unknown) { try { writer.execute('ROLLBACK'); } catch { /* Preserve the original transaction failure. */ } throw error; }
      if (writer instanceof SqlJsEngine) {
        const file = await open(temporary, 'wx', 0o600);
        try { await file.writeFile(writer.export()); await file.sync(); } finally { await file.close(); }
      } else {
        writer.close(); writer = undefined;
        const file = await open(temporary, 'r+'); try { await file.sync(); } finally { await file.close(); }
      }
      this.check(command.version);
      let current: string | undefined;
      try { current = sourceVersion(target); } catch (error: unknown) {
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) { throw error; }
      }
      if (current !== initial) { throw new Error('The save destination changed. It was not replaced.'); }
      await rename(temporary, target);
      if (command.destination === undefined) { this.version = sourceVersion(this.path); }
    } finally { writer?.close(); if (command.temporaryDirectory === undefined) { await rm(directory, { recursive: true, force: true }); } }
  }
}
