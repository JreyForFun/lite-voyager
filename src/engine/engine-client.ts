import { fork, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import type { DatabaseHelperRequest, DatabaseResponse, DatabaseWorkerRequest } from '../protocol';
import type { Engine, EngineOpened, EnginePage, OpenOptions, PageAddress, Parameter } from './engine';
import { checkParameters, pageAddress, quoteIdentifier } from './read-engine';

interface ClientOptions { directory: string; workerPath?: string; forceFallback?: boolean; }
interface Pending {
  id: number; resolve: (value: EnginePage) => void; reject: (error: Error) => void; started: (() => void) | undefined;
}
interface Session {
  process: ChildProcess; exited: Promise<void>; stopping: boolean; failed: boolean; ready: boolean;
  rejectOpen: ((error: Error) => void) | undefined; pending: Pending | undefined;
}
interface OpenedFile { path: string; options: OpenOptions; opened: EngineOpened; }

/** The production Engine boundary for both backends: all SQL executes in a worker. */
export class EngineClient implements Engine {
  private session: Session | undefined;
  private openedFile: OpenedFile | undefined;
  private nextId = 0;
  private lifecycle = 0;
  private cancellation: Promise<void> | undefined;
  private readonly forceFallback: boolean;

  constructor(private readonly options: ClientOptions) {
    this.forceFallback = options.forceFallback ?? process.env['LITE_VOYAGER_FORCE_FALLBACK'] === '1';
  }

  async open(path: string, options: OpenOptions = {}): Promise<EngineOpened> {
    if (this.session?.failed === true) { await this.stop(this.session, 'The failed database helper was closed.'); }
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
        if (this.session === session) { this.session = undefined; }
        session.ready = false;
        session.rejectOpen?.(new Error('The database helper stopped before opening. Reopen the file.'));
        this.failPending(session, 'The database helper stopped. Reopen the file to recover.');
        resolve();
      });
    });
    child.on('error', () => {
      session.failed = true; session.ready = false;
      session.rejectOpen?.(new Error('The database helper failed. Reopen the file.'));
      this.failPending(session, 'The database helper failed. Reopen the file to recover.');
    });
    try {
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
          } else if (message.id === session.pending?.id) {
            const pending = session.pending;
            if (message.type === 'started') { pending.started?.(); }
            else {
              session.pending = undefined;
              if (message.type === 'result') { pending.resolve(message.value); }
              else { pending.reject(new Error(message.message)); }
            }
          }
        });
        this.send(session, { type: 'open', workerPath: this.options.workerPath ?? join(this.options.directory, 'db-worker.js'),
          options: { path, directory: this.options.directory, forceFallback: this.forceFallback } });
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

  async page(table: string, page: PageAddress = {}): Promise<EnginePage> {
    return this.query(`SELECT * FROM ${quoteIdentifier(table)}`, [], page);
  }

  async query(sql: string, parameters: Parameter[] = [], page: PageAddress = {}, started?: () => void): Promise<EnginePage> {
    pageAddress(page); checkParameters(parameters);
    const session = this.session;
    if (session === undefined || !session.ready || session.stopping || session.failed) { throw new Error('First open a SQLite file. Reopen it if the database worker stopped.'); }
    if (session.pending !== undefined) { throw new Error('A database query is already running. Wait or cancel it.'); }
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      session.pending = { id, resolve, reject, started };
      this.request(session, { type: 'query', id, sql, parameters, page });
    });
  }

  cancel(): Promise<void> {
    if (this.cancellation !== undefined) { return this.cancellation; }
    const task = this.cancelAndReopen();
    this.cancellation = task;
    const clear = (): void => { if (this.cancellation === task) { this.cancellation = undefined; } };
    void task.then(clear, clear);
    return task;
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
    session.pending?.reject(new Error(message));
    session.pending = undefined;
  }

  private async stop(session: Session, message: string): Promise<void> {
    if (!session.stopping) {
      session.stopping = true; session.ready = false;
      session.rejectOpen?.(new Error(message));
      this.failPending(session, message);
      if (session.process.exitCode === null && session.process.signalCode === null && session.process.pid !== undefined) { session.process.kill('SIGKILL'); }
    }
    await session.exited;
  }
}
