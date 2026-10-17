import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { isXlsxPreviewResult, type XlsxPreviewResult } from '../protocol';
import { runCsvImport } from './csv-import-client';
import { FALLBACK_IMPORT_SOURCE_BYTES } from './csv-import';
import type { FileLoader, ImportedTable, ImportTarget, LoadOptions, Progress } from './file-loader';
import { XlsxReadConsent, xlsxSnapshot, type XlsxApproval } from './xlsx-consent';

export class XlsxLoader implements FileLoader {
  readonly extensions = ['xlsx'] as const;
  private readonly consent: XlsxReadConsent;
  constructor(private readonly directory: string, approve?: XlsxApproval) { this.consent = new XlsxReadConsent(approve); }
  private async approved(path: string, options: LoadOptions, signal?: AbortSignal, fallback = false) {
    if (Object.keys(options).length !== 0) { throw new Error('XLSX uses row 1 as headers and has no CSV options.'); }
    if ((fallback || process.env['LITE_VOYAGER_FORCE_FALLBACK'] === '1') && BigInt((await xlsxSnapshot(path)).size) > BigInt(FALLBACK_IMPORT_SOURCE_BYTES)) {
      throw new Error('Memory-limited XLSX source exceeds 20,000,000 bytes. Update VS Code for disk-backed imports.');
    }
    return this.consent.approve(path, signal);
  }
  async preview(path: string, options: LoadOptions = {}, signal?: AbortSignal): Promise<XlsxPreviewResult> {
    const snapshot = await this.approved(path, options, signal);
    const worker = new Worker(join(this.directory, 'xlsx-preview-worker.js'), { workerData: { path, snapshot, fallback: process.env['LITE_VOYAGER_FORCE_FALLBACK'] === '1' } });
    let abort: () => void = () => {};
    try {
      return await new Promise<XlsxPreviewResult>((accept, reject) => {
        abort = () => { reject(new Error('XLSX preview cancelled. Reopen to retry.')); }; signal?.addEventListener('abort', abort, { once: true });
        worker.once('message', (reply: unknown) => {
          if (signal?.aborted === true) { abort(); return; }
          if (typeof reply === 'object' && reply !== null && 'type' in reply) {
            if (reply.type === 'xlsxPreviewResult' && 'result' in reply && isXlsxPreviewResult(reply.result)) { accept(reply.result); return; }
            if (reply.type === 'failure' && 'message' in reply && typeof reply.message === 'string') { reject(new Error(reply.message.slice(0, 4096))); return; }
          }
          reject(new Error('Invalid XLSX preview response. Rebuild and reopen.'));
        });
        worker.once('error', () => { reject(new Error('XLSX preview worker failed. Rebuild and reopen.')); });
        worker.once('exit', () => { reject(new Error('XLSX preview worker exited. Reopen to retry.')); });
        if (signal?.aborted === true) { abort(); }
      });
    } finally { signal?.removeEventListener('abort', abort); await worker.terminate(); }
  }
  async import(path: string, target: ImportTarget, options: LoadOptions, progress: (value: Progress) => void, signal: AbortSignal): Promise<ImportedTable[]> {
    const snapshot = await this.approved(path, options, signal, target.engine === 'sql.js');
    return runCsvImport(this.directory, path, target, {}, progress, signal, 'xlsx', snapshot);
  }
}
