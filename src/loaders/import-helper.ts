import { EventEmitter } from 'node:events';
import type { Serializable } from 'node:child_process';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

export type LauncherRequest = { type: 'stop'; signal: 'SIGKILL' } | { type: 'send'; id: number; value: Serializable };
export type LauncherReply = { type: 'ready'; pid: number } | { type: 'message'; value: unknown }
  | { type: 'sent'; id: number; error: string | null } | { type: 'failure'; message: string }
  | { type: 'closed'; code: number | null; signal: NodeJS.Signals | null };

export class UnconfirmedImportExitError extends Error {
  constructor() { super('CSV import launcher exited without confirmed helper closure. Private import storage was retained.'); }
}

/** Process creation can block in the OS. Only the launcher worker performs it. */
export class ImportHelper extends EventEmitter {
  readonly ready: Promise<void>;
  readonly closed: Promise<void>;
  pid: number | undefined;
  connected = false;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  private readonly worker: Worker;
  private readonly pending = new Map<number, (error: Error | null) => void>();
  private sequence = 0;
  private stopping = false;
  private finished = false;

  constructor(directory: string) {
    super();
    // Startup failures must remain observable while the caller awaits registration.
    // ready/closed also retain failures when no external error listener is installed.
    this.on('error', () => {});
    let acceptReady!: () => void; let rejectReady!: (error: Error) => void;
    let acceptClosed!: () => void; let rejectClosed!: (error: Error) => void;
    this.ready = new Promise<void>((accept, reject) => { acceptReady = accept; rejectReady = reject; });
    this.closed = new Promise<void>((accept, reject) => { acceptClosed = accept; rejectClosed = reject; });
    void this.ready.catch(() => {}); void this.closed.catch(() => {});
    this.worker = new Worker(join(directory, 'csv-import-launch-worker.js'), { workerData: { directory } });
    let confirmed = false;
    const failure = (error: Error): void => { rejectReady(error); this.emit('error', error); };
    this.worker.on('message', (reply: LauncherReply) => {
      switch (reply.type) {
        case 'ready':
          this.pid = reply.pid; this.connected = !this.stopping;
          if (this.stopping) { rejectReady(new Error('CSV import helper launch cancelled.')); }
          else { acceptReady(); }
          break;
        case 'message': if (!this.stopping) { this.emit('message', reply.value); } break;
        case 'sent': {
          const callback = this.pending.get(reply.id); this.pending.delete(reply.id);
          callback?.(reply.error === null ? null : new Error(reply.error)); break;
        }
        case 'failure': failure(new Error(reply.message)); break;
        case 'closed':
          confirmed = true; this.connected = false; this.exitCode = reply.code; this.signalCode = reply.signal;
          rejectReady(new Error('CSV import helper stopped before starting. Reopen the file.')); break;
      }
    });
    this.worker.on('error', failure);
    this.worker.once('exit', () => {
      this.finished = true; this.connected = false;
      const error = new UnconfirmedImportExitError();
      for (const callback of this.pending.values()) { callback(new Error('CSV import helper stopped before receiving the request.')); }
      this.pending.clear();
      if (confirmed) { acceptClosed(); this.emit('close', this.exitCode, this.signalCode); }
      else { rejectReady(error); rejectClosed(error); this.emit('error', error); }
    });
  }

  send(value: Serializable, callback: (error: Error | null) => void): void {
    if (!this.connected) { callback(new Error('CSV import helper is disconnected.')); return; }
    const id = ++this.sequence; this.pending.set(id, callback);
    try { this.post({ type: 'send', id, value }); }
    catch (error: unknown) { this.pending.delete(id); callback(error instanceof Error ? error : new Error('CSV import request could not be sent.')); }
  }

  kill(signal: 'SIGKILL'): boolean {
    if (this.finished || this.stopping) { return false; }
    this.stopping = true; this.connected = false; this.post({ type: 'stop', signal }); return true;
  }

  private post(request: LauncherRequest): void { this.worker.postMessage(request); }
}
