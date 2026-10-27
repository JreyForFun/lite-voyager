import { fork, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import type { DatabaseHelperRequest, DatabaseMetadata, DatabaseOperation, DatabaseResponse, DatabaseWorkerRequest } from '../protocol';
import type { Engine, EngineOpened, EnginePage, ExportFormat, ExportReport, OpenOptions, PageAddress, Parameter } from './engine';
import { checkParameters, pageAddress, quoteIdentifier } from './read-engine';
import { isGridOptions, type GridOptions } from '../protocol';
import { registerStorageHelper } from '../storage/temp-storage';
import { mkdtemp, realpath, rm, stat } from 'node:fs/promises';

interface ClientOptions { directory: string; workerPath?: string; forceFallback?: boolean; ownerDirectory?: string; }
interface Pending {
  id: number; resolve: (value: EnginePage) => void; reject: (error: Error) => void; started: (() => void) | undefined;
  editing?: boolean;
}
interface Session {
  process: ChildProcess; exited: Promise<void>; stopping: boolean; failed: boolean; ready: boolean;
  rejectOpen: ((error: Error) => void) | undefined; pending: Pending | undefined;
  shutdown?: Promise<void>;
  saveRecovery?: { path: string; version: string };
  exportPending?: { id: number; resolve: (value: ExportReport) => void; reject: (error: Error) => void; progress?: (report: ExportReport) => void } | undefined;
}
interface OpenedFile { path: string; options: OpenOptions; opened: EngineOpened; }

/** The production Engine boundary for both backends: all SQL executes in a worker. */
export class EngineClient implements Engine {
  private session: Session | undefined;
  private openedFile: OpenedFile | undefined;
  private nextId = 0;
  private lifecycle = 0;
  private cancellation: Promise<void> | undefined;
  private suspension: Promise<() => Promise<void>> | undefined;
  private readonly forceFallback: boolean;

  constructor(private readonly options: ClientOptions) {
    this.forceFallback = options.forceFallback ?? process.env['LITE_VOYAGER_FORCE_FALLBACK'] === '1';
  }

  open(path: string, options: OpenOptions = {}): Promise<EngineOpened> { return this.openFile(path, options); }

  private async openFile(path: string, options: OpenOptions, recoverEditVersion?: string): Promise<EngineOpened> {
    const lifecycle = this.lifecycle;
    if (this.session?.failed === true) { await this.stop(this.session, 'The failed database helper was closed.'); }
    if (lifecycle !== this.lifecycle) { throw new Error('The SQLite open was cancelled because the document closed or its lifecycle changed.'); }
    if (this.session !== undefined) { throw new Error('Close the current database before opening another file.'); }
    this.openedFile = undefined;
    const child = fork(join(this.options.directory, 'db-process.js'), [], {
      execPath: process.execPath, execArgv: [], windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      serialization: 'advanced', stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const session: Session = { process: child, exited: Promise.resolve(), stopping: false, failed: false, ready: false, rejectOpen: undefined, pending: undefined };
    this.session = session;
    session.exited = new Promise((resolve) => {
      child.once('close', () => {
        session.failed = true; session.ready = false;
        session.rejectOpen?.(new Error('The database helper stopped before opening. Reopen the file.'));
        this.failPending(session, 'The database helper stopped. Reopen the file to recover.');
        resolve();
        // Keep the session visible until its journal recovery also settles.
        // A concurrent Open/Cancel must await that same shutdown promise.
        void this.stop(session, 'The database helper stopped. Reopen the file to recover.').catch(() => {});
      });
    });
    child.on('error', () => {
      session.failed = true; session.ready = false;
      session.rejectOpen?.(new Error('The database helper failed. Reopen the file.'));
      this.failPending(session, 'The database helper failed. Reopen the file to recover.');
    });
    try {
      if (this.options.ownerDirectory !== undefined && child.pid !== undefined) { await registerStorageHelper(this.options.ownerDirectory, child.pid); }
      if (this.session !== session || session.failed || !child.connected) { throw new Error('The database helper stopped before opening. Reopen the file.'); }
      const opened = await new Promise<EngineOpened>((resolve, reject) => {
        session.rejectOpen = reject;
        child.on('message', (message: DatabaseResponse) => {
          if (this.session !== session || session.stopping) { return; }
          if (message.type === 'mode') {
            void this.handleMode(session, message, options).catch((error: unknown) => {
              reject(error instanceof Error ? error : new Error('Unable to obtain consent for memory-limited mode.'));
            });
          } else if (message.type === 'opened') { session.ready = true; session.rejectOpen = undefined; resolve(message.value); }
          else if (message.type === 'failed') {
            session.failed = true; session.ready = false;
            reject(new Error(message.message));
            this.failPending(session, message.message);
          } else if (message.id === session.exportPending?.id) {
            const pending = session.exportPending;
            if (message.type === 'exportProgress') { pending.progress?.(message.value); }
            else if (message.type === 'exported') { session.exportPending = undefined; pending.resolve(message.value); }
            else if (message.type === 'queryFailed') { session.exportPending = undefined; pending.reject(new Error(message.message)); }
          } else if (message.id === session.pending?.id) {
            const pending = session.pending;
            if (message.type === 'started') { pending.started?.(); }
            else {
              session.pending = undefined;
              if (message.type === 'result') { delete session.saveRecovery; pending.resolve(message.value); }
              else if (message.type === 'queryFailed') { pending.reject(new Error(message.message)); }
            }
          }
        });
        this.send(session, { type: 'open', workerPath: this.options.workerPath ?? join(this.options.directory, 'db-worker.js'),
          options: { path, directory: this.options.directory, forceFallback: this.forceFallback,
            ...(recoverEditVersion === undefined ? {} : { recoverEditVersion }) } });
      });
      this.openedFile = { path, options, opened };
      return opened;
    } catch (error: unknown) {
      await this.stop(session, 'The database helper was closed.');
      throw error;
    }
  }

  private async handleMode(session: Session, message: Extract<DatabaseResponse, { type: 'mode' }>, options: OpenOptions): Promise<void> {
    options.onMode?.(message.value);
    if (!message.value.needsConsent) { return; }
    if (options.confirmLargeFile === undefined) { throw new Error('Unable to open: memory-limited files above 200 MB require explicit consent before loading.'); }
    const approved = await options.confirmLargeFile(message.value);
    if (this.session !== session || session.stopping) { return; }
    this.request(session, { type: 'consent', approved: approved === true });
  }

  schema(page: PageAddress = {}): Promise<EnginePage> {
    return this.query("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT GLOB 'sqlite_*' ORDER BY name", [], page);
  }

  async columns(table: string, page: PageAddress = {}): Promise<EnginePage> {
    return this.metadata({ type: 'metadata', id: 0, kind: 'columns', table, page });
  }

  async indexes(table: string, page: PageAddress = {}): Promise<EnginePage> {
    return this.metadata({ type: 'metadata', id: 0, kind: 'indexes', table, page });
  }

  async indexColumns(table: string, index: string, page: PageAddress = {}): Promise<EnginePage> {
    quoteIdentifier(index);
    return this.metadata({ type: 'metadata', id: 0, kind: 'indexColumns', table, index, page });
  }

  private async metadata(request: DatabaseMetadata): Promise<EnginePage> {
    quoteIdentifier(request.table); pageAddress(request.page);
    return this.execute(request);
  }

  async page(table: string, page: PageAddress = {}): Promise<EnginePage> {
    return this.query(`SELECT * FROM ${quoteIdentifier(table)}`, [], page);
  }

  async grid(table: string, options: GridOptions, page: PageAddress = {}, kind: 'rows' | 'count' = 'rows'): Promise<EnginePage> {
    quoteIdentifier(table); pageAddress(page);
    if (!isGridOptions(options) || !['rows', 'count'].includes(kind)) { throw new Error('Invalid grid controls. Filter text is limited to 65,536 characters across at most 1,000 columns. Nothing was truncated.'); }
    return this.execute({ type: 'grid', id: 0, table, options, page, kind });
  }

  async query(sql: string, parameters: Parameter[] = [], page: PageAddress = {}, started?: () => void): Promise<EnginePage> {
    pageAddress(page); checkParameters(parameters);
    return this.execute({ type: 'query', id: 0, sql, parameters, page }, started);
  }

  async edit(command: import('../staging/edit-types').EditCommand, started?: () => void): Promise<EnginePage> {
    if (command.action !== 'save') { return this.execute({ type: 'edit', id: 0, command }, started); }
    const session = this.session; const lifecycle = this.lifecycle; const source = this.openedFile?.path;
    if (source === undefined) { throw new Error('Open the SQLite source before saving.'); }
    // Host ownership allows cleanup after a killed worker. Only the directory
    // created by this exact call is removed, after helper exit on cancellation.
    const canonicalSource = await realpath(source);
    const parent = command.destination === undefined ? dirname(canonicalSource) : await realpath(dirname(command.destination));
    const temporaryDirectory = await mkdtemp(join(parent, '.lite-voyager-edit-'));
    try {
      if (this.session !== session || this.lifecycle !== lifecycle) { throw new Error('Save cancelled before writing. Pending changes were preserved.'); }
      return await this.execute({ type: 'edit', id: 0, command: { ...command, temporaryDirectory } }, started, canonicalSource);
    } finally { await rm(temporaryDirectory, { recursive: true, force: true }); }
  }

  private async execute(request: DatabaseOperation, started?: () => void, canonicalSavePath?: string): Promise<EnginePage> {
    const session = this.session;
    if (session === undefined || !session.ready || session.stopping || session.failed) { throw new Error('First open a SQLite file. Reopen it if the database worker stopped.'); }
    if (session.pending !== undefined || session.exportPending !== undefined) { throw new Error('A database query is already running. Wait or cancel it.'); }
    const id = ++this.nextId;
    if (request.type === 'edit' && request.command.action === 'save' && request.command.destination === undefined && this.openedFile?.opened.engine === 'node:sqlite') {
      session.saveRecovery = { path: canonicalSavePath ?? this.openedFile.path, version: request.command.version };
    }
    return new Promise((resolve, reject) => {
      session.pending = { id, resolve, reject, started, ...(request.type === 'edit' ? { editing: true } : {}) };
      this.request(session, { ...request, id });
    });
  }

  async exportResults(sql: string, format: ExportFormat, path: string, progress?: (report: ExportReport) => void): Promise<ExportReport> {
    const session = this.session;
    if (session === undefined || !session.ready || session.stopping || session.failed) { throw new Error('First open a SQLite file. Reopen it if the database worker stopped.'); }
    if (session.pending !== undefined || session.exportPending !== undefined) { throw new Error('A database query is already running. Wait or cancel it.'); }
    if ((format !== 'csv' && format !== 'json') || typeof path !== 'string' || path.length === 0 || path.includes('\0')) { throw new Error('Invalid export destination or format. Choose a local CSV or JSON file.'); }
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      session.exportPending = { id, resolve, reject, ...(progress === undefined ? {} : { progress }) };
      this.request(session, { type: 'export', id, sql, format, path });
    });
  }

  cancel(): Promise<void> {
    if (this.cancellation !== undefined) { return this.cancellation; }
    // A paused reader has no operation to interrupt. Keep its saved reopen
    // state intact until the Save owner releases the suspension.
    if (this.suspension !== undefined) { return this.suspension.then(() => {}); }
    const task = this.cancelAndReopen();
    this.cancellation = task;
    const clear = (): void => { if (this.cancellation === task) { this.cancellation = undefined; } };
    void task.then(clear, clear);
    return task;
  }

  suspendReads(): Promise<() => Promise<void>> {
    if (this.suspension !== undefined) { return this.suspension; }
    const task = this.pauseReader().then((resume) => async () => {
      if (this.suspension !== task) { return; }
      try { await resume(); } finally { if (this.suspension === task) { this.suspension = undefined; } }
    });
    this.suspension = task;
    void task.catch(() => { if (this.suspension === task) { this.suspension = undefined; } });
    return task;
  }

  private async pauseReader(): Promise<() => Promise<void>> {
    // Recovery temporarily clears openedFile. Let it settle before capturing
    // the resumable reader, rather than invalidating its lifecycle mid-reopen.
    while (this.cancellation !== undefined) { await this.cancellation; }
    const version = ++this.lifecycle; const previous = this.openedFile; this.openedFile = undefined;
    if (this.session !== undefined) { await this.stop(this.session, 'The reader was paused for an explicit SQLite save.'); }
    return async () => {
      if (previous === undefined || version !== this.lifecycle || this.session !== undefined) { return; }
      await this.open(previous.path, previous.options);
    };
  }

  private async cancelAndReopen(): Promise<void> {
    const version = ++this.lifecycle;
    const previous = this.openedFile;
    this.openedFile = undefined;
    if (this.session !== undefined) { await this.stop(this.session, 'The database operation was cancelled.'); }
    if (previous === undefined || version !== this.lifecycle) { return; }
    // Consent is for memory cost. Recovery may reuse it for a file no larger
    // than the one already approved; growth requires fresh consent.
    await this.open(previous.path, {
      ...previous.options,
      confirmLargeFile: async (mode) => BigInt(mode.bytes) <= BigInt(previous.opened.bytes)
        || await previous.options.confirmLargeFile?.(mode) === true,
    });
  }

  async close(): Promise<void> {
    ++this.lifecycle;
    this.openedFile = undefined;
    if (this.session !== undefined) { await this.stop(this.session, 'The database was closed.'); }
  }

  private request(session: Session, value: DatabaseWorkerRequest): void { this.send(session, { type: 'request', value }); }
  private send(session: Session, message: DatabaseHelperRequest): void {
    try {
      session.process.send(message, (error) => {
        if (error === null || session.stopping) { return; }
        session.failed = true; session.ready = false;
        session.rejectOpen?.(new Error('The database helper could not receive the request. Reopen the file.'));
        this.failPending(session, 'The database helper could not receive the query. Reopen the file.');
      });
    } catch {
      session.failed = true; session.ready = false;
      session.rejectOpen?.(new Error('The database helper is unavailable. Reopen the file.'));
      this.failPending(session, 'The database helper is unavailable. Reopen the file.');
    }
  }

  private failPending(session: Session, message: string): void {
    const query = session.pending;
    session.pending = undefined;
    if (query?.editing === true) { void this.stop(session, message).then(() => { query.reject(new Error(message)); }, () => { query.reject(new Error(`${message} SQLite journal recovery failed; preserve the source and its sidecars.`)); }); }
    else { query?.reject(new Error(message)); }
    const pending = session.exportPending; session.exportPending = undefined;
    // Output cleanup must not race a worker that still holds the temporary file.
    if (pending !== undefined) { void this.stop(session, message).then(() => { pending.reject(new Error(message)); }, () => { pending.reject(new Error(`${message} SQLite journal recovery failed; preserve the source and its sidecars.`)); }); }
  }

  private stop(session: Session, message: string): Promise<void> {
    if (session.shutdown !== undefined) { return session.shutdown; }
    session.stopping = true; session.ready = false;
    session.shutdown = (async () => {
      await session.exited;
      const recovery = session.saveRecovery;
      if (recovery === undefined) { return; }
      try { await stat(recovery.path + '-journal'); }
      catch (error: unknown) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') { return; } throw error; }
      // Only a previously explicit native Save can authorize recovery writes.
      // The old helper has exited; a fresh worker checks source identity and
      // lets SQLite recover its own journal. Never delete that journal by hand.
      const recovering = new EngineClient({ directory: this.options.directory, forceFallback: false });
      try { await recovering.openFile(recovery.path, {}, recovery.version); }
      finally { await recovering.close(); }
    })().finally(() => { if (this.session === session) { this.session = undefined; } });
    session.rejectOpen?.(new Error(message)); this.failPending(session, message);
    if (session.process.exitCode === null && session.process.signalCode === null && session.process.pid !== undefined) { session.process.kill('SIGKILL'); }
    return session.shutdown;
  }
}
