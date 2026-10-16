import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { isJsonPreviewResult, type JsonPreviewResult } from '../protocol';
import type { FileLoader, ImportedTable, ImportTarget, LoadOptions, Progress } from './file-loader';
import { runCsvImport } from './csv-import-client';

export class JsonLoader implements FileLoader {
  readonly extensions = ['json', 'jsonl'] as const;
  constructor(private readonly directory: string) {}
  async preview(path: string, options: LoadOptions = {}, signal?: AbortSignal): Promise<JsonPreviewResult> {
    this.options(options); if (signal?.aborted === true) { throw new Error('JSON preview cancelled. Reopen to retry.'); }
    const worker = new Worker(join(this.directory, 'json-preview-worker.js'), { workerData: { path, format: this.format(path) } });
    let abort: () => void = () => {};
    try {
      return await new Promise<JsonPreviewResult>((accept, reject) => {
        abort = () => { reject(new Error('JSON preview cancelled. Reopen to retry.')); }; signal?.addEventListener('abort', abort, { once: true });
        worker.once('message', (reply: unknown) => {
          if (signal?.aborted === true) { abort(); return; }
          if (typeof reply === 'object' && reply !== null && 'type' in reply) {
            if (reply.type === 'jsonPreviewResult' && 'result' in reply && isJsonPreviewResult(reply.result)) { accept(reply.result); return; }
            if (reply.type === 'jsonPreviewFailure' && 'message' in reply && typeof reply.message === 'string') { reject(new Error(reply.message.slice(0, 4096))); return; }
          }
          reject(new Error('Invalid JSON preview response. Rebuild and reopen.'));
        });
        worker.once('error', () => { reject(new Error('JSON preview worker failed. Rebuild and reopen.')); });
        worker.once('exit', () => { reject(new Error('JSON preview worker exited. Reopen to retry.')); });
        if (signal?.aborted === true) { abort(); }
      });
    } finally { signal?.removeEventListener('abort', abort); await worker.terminate(); }
  }
  import(path: string, target: ImportTarget, options: LoadOptions, progress: (value: Progress) => void, signal: AbortSignal): Promise<ImportedTable[]> {
    this.options(options); return runCsvImport(this.directory, path, target, {}, progress, signal, this.format(path));
  }
  private format(path: string): 'json' | 'jsonl' { return extname(path).toLowerCase() === '.jsonl' ? 'jsonl' : 'json'; }
  private options(options: LoadOptions): void { if (Object.keys(options).length !== 0) { throw new Error('JSON import has no delimiter, header or CSV type options.'); } }
}
