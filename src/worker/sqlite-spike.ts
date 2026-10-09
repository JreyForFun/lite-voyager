import { fork, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import type { SpikeHelperRequest, SpikeOpened, SpikeParameter, SpikeRequest, SpikeResponse, SpikeResult } from './sqlite-spike-protocol';

interface SpikeOptions {
  fallbackDirectory: string;
  /** Spike-only injection: resolve a nonexistent built-in through the real module loader. */
  simulateUnavailable?: boolean;
}

interface PendingQuery {
  resolve: (result: SpikeResult) => void;
  reject: (error: Error) => void;
  started: (() => void) | undefined;
}

interface HelperSession {
  process: ChildProcess;
  closed: Promise<void>;
  rejectOpen: ((error: Error) => void) | undefined;
  pending: PendingQuery | undefined;
  ready: boolean;
  stopping: boolean;
}

/** T-002 experiment; the production Engine abstraction follows in T-009. */
export class SqliteSpike {
  private helper: HelperSession | undefined;
  private nextId = 0;

  constructor(private readonly workerPath: string, private readonly options: SpikeOptions) {}

  async open(path: string): Promise<SpikeOpened> {
    if (this.helper !== undefined) { throw new Error('Close the current spike worker before opening another file.'); }
    // Electron's documented run-as-Node mode reuses VS Code's bundled executable.
    // No system Node installation, shell, external CLI, or shipped binary is needed.
    const child = fork(join(this.options.fallbackDirectory, 'sqlite-spike-process.js'), [], {
      execPath: process.execPath, execArgv: [], windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      serialization: 'advanced', stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const session: HelperSession = {
      process: child, closed: Promise.resolve(), rejectOpen: undefined,
      pending: undefined, ready: false, stopping: false,
    };
    session.closed = new Promise((resolve) => {
      child.once('close', () => {
        if (this.helper === session) { this.helper = undefined; }
        session.ready = false;
        session.rejectOpen?.(new Error('The SQLite spike worker helper stopped before opening the file.'));
        this.failQuery(session, 'The SQLite spike worker helper stopped. Reopen the file to recover.');
        resolve();
      });
    });
    this.helper = session;
    child.on('error', () => {
      session.rejectOpen?.(new Error('The SQLite spike worker helper failed. Close it and reopen the file.'));
      this.failQuery(session, 'The SQLite spike worker helper failed. Reopen the file to recover.');
    });
    try {
      return await new Promise<SpikeOpened>((resolve, reject) => {
        session.rejectOpen = reject;
        child.on('message', (message: SpikeResponse) => {
          if (this.helper !== session || session.stopping) { return; }
          if (message.type === 'opened') { session.ready = true; resolve(message.value); }
          else if (message.type === 'failed') {
            session.ready = false;
            reject(new Error(message.message));
            this.failQuery(session, message.message);
          }
          else if (message.id === this.nextId && session.pending !== undefined) {
            if (message.type === 'started') { session.pending.started?.(); }
            else {
              const pending = session.pending;
              session.pending = undefined;
              if (message.type === 'result') { pending.resolve(message.value); }
              else { pending.reject(new Error(message.message)); }
            }
          }
        });
        const request: SpikeHelperRequest = { type: 'open', workerPath: this.workerPath, options: {
          path, fallbackDirectory: this.options.fallbackDirectory, simulateUnavailable: this.options.simulateUnavailable === true,
        } };
        child.send(request, (error) => { if (error !== null) { reject(new Error('The SQLite spike worker helper could not receive the open request.')); } });
      });
    } catch (error: unknown) {
      await this.stopSession(session, 'The SQLite spike worker was closed.');
      throw error;
    }
  }

  query(sql: string, parameters: SpikeParameter[] = [], started?: () => void): Promise<SpikeResult> {
    const session = this.helper;
    if (session === undefined || !session.ready || session.stopping) { return Promise.reject(new Error('First open a file in the SQLite spike.')); }
    if (session.pending !== undefined) { return Promise.reject(new Error('A spike query is already running. Cancel it or wait for it to finish.')); }
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      session.pending = { resolve, reject, started };
      const request: SpikeRequest = { id, sql, parameters };
      const message: SpikeHelperRequest = { type: 'query', value: request };
      session.process.send(message, (error) => {
        if (error !== null) { this.failQuery(session, 'The SQLite spike query could not reach the worker. Reopen the file.'); }
      });
    });
  }

  private failQuery(session: HelperSession, message: string): void {
    const pending = session.pending;
    session.pending = undefined;
    pending?.reject(new Error(message));
  }

  async cancel(): Promise<void> {
    await this.stop('The SQLite spike query was cancelled. Reopen the file to continue.');
  }

  async close(): Promise<void> {
    await this.stop('The SQLite spike worker was closed.');
  }

  private async stop(message: string): Promise<void> {
    const session = this.helper;
    if (session !== undefined) { await this.stopSession(session, message); }
  }

  private async stopSession(session: HelperSession, message: string): Promise<void> {
    if (!session.stopping) {
      session.stopping = true;
      session.ready = false;
      session.rejectOpen?.(new Error(message));
      this.failQuery(session, message);
      if (session.process.exitCode === null && session.process.signalCode === null && session.process.pid !== undefined) {
        session.process.kill('SIGKILL');
      }
    }
    // ChildProcess.killed only reports delivery. Waiting for close confirms exit.
    await session.closed;
  }
}
