import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { isCsvPreviewResult, type CsvPreviewResult } from '../protocol';
import { importOptions, previewOptions, type FileLoader, type ImportTarget, type ImportedTable, type LoadOptions, type PreviewLoader, type Progress } from './file-loader';
import { runCsvImport } from './csv-import-client';

export class CsvPreviewLoader implements PreviewLoader<CsvPreviewResult> {
  readonly extensions = ['csv', 'tsv'] as const;
  constructor(private readonly directory: string, private readonly detect = false) {}
  async preview(path: string, input: LoadOptions = {}, signal?: AbortSignal): Promise<CsvPreviewResult> {
    const options = previewOptions(input);
    if (signal?.aborted === true) { throw new Error('CSV preview cancelled. Reopen the preview to try again.'); }
    let worker: Worker;
    try { worker = new Worker(join(this.directory, 'csv-preview-worker.js'), { workerData: { path, options, detect: this.detect } }); }
    catch { throw new Error('Unable to start CSV preview worker. Rebuild the extension and reopen the file.'); }
    let abort: () => void = () => {};
    try {
      return await new Promise<CsvPreviewResult>((accept, reject) => {
        abort = () => { reject(new Error('CSV preview cancelled. Reopen the preview to try again.')); };
        signal?.addEventListener('abort', abort, { once: true });
        worker.once('message', (reply: unknown) => {
          if (signal?.aborted === true) { abort(); return; }
          if (typeof reply === 'object' && reply !== null && 'type' in reply) {
            if (reply.type === 'csvPreviewResult' && 'result' in reply && isCsvPreviewResult(reply.result)) { accept(reply.result); return; }
            if (reply.type === 'csvPreviewFailure' && 'message' in reply && typeof reply.message === 'string' && reply.message.length <= 4096) { reject(new Error(reply.message)); return; }
          }
          reject(new Error('CSV worker returned an invalid preview. Rebuild and reopen the file.'));
        });
        worker.once('error', () => { reject(new Error('CSV preview worker failed. Rebuild and reopen the file.')); });
        worker.once('exit', () => { reject(new Error('CSV preview worker exited before returning data. Reopen the file.')); });
        if (signal?.aborted === true) { abort(); }
      });
    } finally {
      signal?.removeEventListener('abort', abort);
      await worker.terminate();
    }
  }
}

export class CsvLoader extends CsvPreviewLoader implements FileLoader {
  constructor(private readonly importDirectory: string) { super(importDirectory, true); }
  override preview(path: string, options: LoadOptions = {}, signal?: AbortSignal): Promise<CsvPreviewResult> {
    const clean = importOptions(options);
    return super.preview(path, { ...(clean.delimiter === undefined ? {} : { delimiter: clean.delimiter }),
      ...(clean.header === undefined ? {} : { header: clean.header }) }, signal);
  }
  import(path: string, target: ImportTarget, options: LoadOptions, progress: (value: Progress) => void, signal: AbortSignal): Promise<ImportedTable[]> {
    return runCsvImport(this.importDirectory, path, target, importOptions(options), progress, signal);
  }
}
