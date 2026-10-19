import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { isCellRequest, isCellWorkerResponse, type CellRequest, type CellResponse } from '../protocol';
export interface TransformWorker {
  postMessage(message: CellRequest): void;
  on(event: 'message', listener: (value: unknown) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  terminate(): Promise<number>;
}
export class CellService {
  private readonly details: Lane = {};
  private readonly copy: Lane = {};
  private disposed = false;
  private context: string | undefined;
  private lastId = 0;
  constructor(private readonly directory: string, private readonly clipboard: (text: string) => PromiseLike<void>, private readonly send: (reply: CellResponse) => void,
    private readonly createWorker: (path: string) => TransformWorker = (path) => new Worker(path)) {}

  handle(message: CellRequest): void {
    if (this.disposed || !isCellRequest(message)) { return; }
    if (this.context === undefined) { this.activate(message.contextId); }
    if (this.context !== message.contextId || message.id <= this.lastId) { return; }
    this.lastId = message.id;
    if (message.type === 'cellCancel') {
      this.stop(this.details); this.stop(this.copy);
      this.send({ type: 'cellFailed', contextId: message.contextId, id: message.id, operation: 'cancel', message: 'Cell operation cancelled. Select a cell or retry copying.' }); return;
    }
    const lane = message.type === 'cellDetails' ? this.details : this.copy;
    if (lane.current !== undefined) {
      if (message.type === 'cellDetails') { lane.queued = message; }
      else { this.failed(message, 'A copy is already in progress. Wait or cancel, then Retry.'); }
      return;
    }
    this.start(lane, message);
  }

  activate(contextId: string): void {
    if (this.disposed || this.context === contextId) { return; }
    this.stop(this.details); this.stop(this.copy); this.context = contextId; this.lastId = 0;
  }

  private start(lane: Lane, message: Work): void {
    lane.current = message; lane.received = false;
    try {
      if (lane.worker === undefined) {
        const worker = this.createWorker(join(this.directory, 'cell-worker.js')); lane.worker = worker;
        worker.on('message', (value) => { void this.receive(lane, worker, value); });
        worker.on('error', () => { if (lane.worker === worker) { this.broken(lane, 'Cell worker failed. Select a cell or Retry copying.'); } });
        worker.on('exit', () => { if (lane.worker === worker) { this.broken(lane, 'Cell worker exited. Select a cell or Retry copying.'); } });
      }
      lane.timer = setTimeout(() => { this.broken(lane, 'Cell preparation timed out. Select a cell or Retry with fewer cells.'); }, 10000);
      lane.worker.postMessage(message);
    } catch { this.broken(lane, 'Unable to start the cell worker. Rebuild the extension and reopen the file, then Retry.'); }
  }

  private async receive(lane: Lane, worker: TransformWorker, value: unknown): Promise<void> {
    const request = lane.current;
    if (this.disposed || lane.worker !== worker || request === undefined || lane.received) { return; }
    if (!isCellWorkerResponse(value) || value.contextId !== request.contextId || value.id !== request.id
      || (request.type === 'cellDetails' ? value.type !== 'cellDetailsResult' && value.type !== 'cellFailed' : value.type !== 'cellCopyPrepared' && value.type !== 'cellFailed')) {
      this.broken(lane, 'Cell worker returned an invalid response. Select a cell or Retry copying.'); return;
    }
    lane.received = true; clearTimeout(lane.timer); delete lane.timer;
    if (value.type === 'cellCopyPrepared') {
      // The preparation is complete before entering the platform clipboard API.
      // A clipboard write already invoked cannot be retracted by cancellation.
      try {
        await this.clipboard(value.text);
        if (!this.disposed && lane.current === request) { this.send({ type: 'cellCopyResult', contextId: request.contextId, id: request.id, message: 'Copied as TSV.' }); }
      } catch {
        if (!this.disposed && lane.current === request) { this.failed(request, 'Clipboard copy could not be verified. Retry copying, or select fewer cells.'); }
      }
    } else { this.send(value); }
    if (!this.disposed && lane.current === request) {
      delete lane.current; const next = lane.queued; delete lane.queued;
      if (next !== undefined) { this.start(lane, next); }
    }
  }

  private failed(request: Work, message: string): void {
    this.send({ type: 'cellFailed', contextId: request.contextId, id: request.id, operation: request.type === 'cellDetails' ? 'details' : 'copy', message });
  }
  private broken(lane: Lane, message: string): void {
    const request = lane.current; const next = lane.queued;
    this.stop(lane);
    if (!this.disposed && request !== undefined) { this.failed(request, message); }
    if (!this.disposed && next !== undefined) { this.start(lane, next); }
  }
  private stop(lane: Lane): void {
    const worker = lane.worker;
    clearTimeout(lane.timer); delete lane.timer; delete lane.worker; delete lane.current; delete lane.queued; delete lane.received;
    if (worker !== undefined) { void worker.terminate().catch(() => { /* No file handles or source data belong to this transform worker. */ }); }
  }
  dispose(): void { this.disposed = true; this.stop(this.details); this.stop(this.copy); }
}

type Work = Exclude<CellRequest, { type: 'cellCancel' }>;
interface Lane { worker?: TransformWorker; current?: Work; queued?: Work; timer?: ReturnType<typeof setTimeout>; received?: boolean; }
