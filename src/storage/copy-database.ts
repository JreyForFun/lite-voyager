import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

export type CopyDatabase = (source: string, target: string, signal: AbortSignal, progress: (bytes: string, total: string) => void) => Promise<string>;
function cancelled(): Error { return new Error('SQLite save cancelled. Existing output was not replaced.'); }

/** Worker-only: immutable committed imports need a byte copy, not row serialization. */
export const copyDatabaseBytes: CopyDatabase = async (source, target, signal, progress) => {
  if (signal.aborted) { throw cancelled(); }
  const input = await open(source, 'r');
  try {
    const before = await input.stat({ bigint: true });
    if (!before.isFile()) { throw new Error('Imported database is no longer available. Reopen the import.'); }
    const output = await open(target, 'wx', 0o600);
    try {
      const buffer = Buffer.allocUnsafe(1024 * 1024); let copied = 0n; let reported = -Infinity;
      for (;;) {
        if (signal.aborted) { throw cancelled(); }
        const { bytesRead } = await input.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0) { break; }
        let offset = 0;
        while (offset < bytesRead) {
          if (signal.aborted) { throw cancelled(); }
          const { bytesWritten } = await output.write(buffer, offset, bytesRead - offset, null);
          if (bytesWritten === 0) { throw new Error('SQLite save could not write output. Check free disk space and retry.'); }
          offset += bytesWritten;
        }
        copied += BigInt(bytesRead);
        if (performance.now() - reported >= 100) { reported = performance.now(); progress(String(copied), String(before.size)); }
      }
      const after = await input.stat({ bigint: true });
      if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || copied !== before.size) {
        throw new Error('Imported database changed while saving. Reopen it and retry.');
      }
      if (signal.aborted) { throw cancelled(); }
      await output.sync(); progress(String(copied), String(before.size)); return String(copied);
    } finally { await output.close(); }
  } finally { await input.close(); }
};

export function databaseCopier(directory: string): CopyDatabase {
  return async (source, target, signal, progress) => {
    if (signal.aborted) { throw cancelled(); }
    const worker = new Worker(join(directory, 'sqlite-save-worker.js'), { workerData: { source, target } });
    let abort: () => void = () => {};
    try {
      return await new Promise<string>((accept, reject) => {
        let bytes: string | undefined; let failure: Error | undefined;
        abort = () => { worker.postMessage('cancel'); }; signal.addEventListener('abort', abort, { once: true });
        worker.on('message', (message: unknown) => {
          if (typeof message !== 'object' || message === null) { failure = new Error('Invalid SQLite save worker response.'); return; }
          const value = message as Record<string, unknown>;
          if (value['type'] === 'done' && typeof value['bytes'] === 'string' && /^\d+$/u.test(value['bytes'])) { bytes = value['bytes']; }
          else if (value['type'] === 'progress' && typeof value['bytes'] === 'string' && typeof value['total'] === 'string') {
            if (!signal.aborted) { try { progress(value['bytes'], value['total']); } catch { failure = new Error('SQLite save progress could not be displayed. Retry saving.'); abort(); } }
            worker.postMessage('ack');
          } else if (value['type'] === 'failure' && typeof value['message'] === 'string') { failure = new Error(value['message']); }
          else { failure = new Error('Invalid SQLite save worker response.'); abort(); }
        });
        worker.on('error', () => { failure = new Error('SQLite save worker failed. Check disk space and permissions, then retry.'); });
        worker.once('exit', (code) => {
          if (signal.aborted) { reject(cancelled()); }
          else if (failure !== undefined) { reject(failure); }
          else if (code !== 0 || bytes === undefined) { reject(new Error('SQLite save worker stopped before completion. Retry saving.')); }
          else { accept(bytes); }
        });
        if (signal.aborted) { abort(); }
      });
    } finally { signal.removeEventListener('abort', abort); await worker.terminate(); }
  };
}
