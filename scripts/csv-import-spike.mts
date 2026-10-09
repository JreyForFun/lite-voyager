import { randomUUID } from 'node:crypto';
import { mkdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

export interface ImportOptions {
  input: string;
  output: string;
  batchRows?: number;
  chunkBytes?: number;
}
export interface ImportProgress {
  phase: 'import' | 'verify';
  stage?: 'source' | 'rows' | 'integrity';
  bytes: number;
  totalBytes: number;
  rows: number;
}
export interface ImportReport {
  task: 'T-004';
  input: string;
  output: string;
  inputBytes: number;
  sqliteBytes: number;
  rowOrderColumn: string;
  rows: number;
  verifiedRows: number;
  transactions: number;
  batchRows: number;
  chunkBytes: number;
  importMs: number;
  verificationMs: number;
  totalMs: number;
  previewRows: number;
  previewParseMs: number | null;
  previewScope: string;
  peakRssBytes: number;
  sampledPeakRssBytes: number;
  memoryScope: string;
  sourceSha256Before: string;
  sourceSha256After: string;
  parsedValuesSha256: string;
  storedValuesSha256: string;
  runtime: string;
  sqliteVersion: string;
  platform: string;
}
export type ImportMessage = { kind: 'progress'; progress: ImportProgress; acknowledge?: true }
  | { kind: 'result'; report: ImportReport } | { kind: 'failure'; message: string };
interface RunOptions { signal?: AbortSignal; onProgress?: (progress: ImportProgress) => void }

function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) { throw new Error(`${name} must be a positive safe integer.`); }
  return value;
}

// Only known files in the newly reserved directory are removed, after worker exit.
// Unknown files are preserved; rmdir refuses a nonempty directory.
async function cleanPartial(output: string): Promise<void> {
  for (const name of ['import.sqlite', 'import.sqlite-journal', 'import.sqlite-wal', 'import.sqlite-shm']) {
    try { await unlink(join(output, name)); }
    catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) { throw error; }
    }
  }
  await rmdir(output);
}

export async function runCsvImportSpike(options: ImportOptions, run: RunOptions = {}): Promise<ImportReport> {
  const job = {
    input: resolve(options.input), output: resolve(options.output),
    batchRows: positive(options.batchRows ?? 1000, 'batchRows'),
    chunkBytes: positive(options.chunkBytes ?? 65_536, 'chunkBytes'),
  };
  if (run.signal?.aborted === true) { throw new Error('CSV import cancelled.'); }
  await mkdir(dirname(job.output), { recursive: true });
  try { await mkdir(job.output); }
  catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error('Import output already exists. Choose a fresh directory; existing data is never replaced.');
    }
    throw error;
  }
  const start = performance.now();
  let sampledPeakRssBytes = process.memoryUsage.rss();
  const sample = (): void => { sampledPeakRssBytes = Math.max(sampledPeakRssBytes, process.memoryUsage.rss()); };
  const sampler = setInterval(sample, 10);
  try {
    const report = await new Promise<ImportReport>((accept, reject) => {
      const worker = new Worker(new URL('./csv-import-spike-worker.mts', import.meta.url), { workerData: job });
      let result: ImportReport | undefined;
      let failure: Error | undefined;
      const stop = (error: Error): void => {
        failure ??= error;
        void worker.terminate().catch((reason: unknown) => { failure = new Error(`Worker termination failed: ${String(reason)}`); });
      };
      const cancel = (): void => stop(new Error('CSV import cancelled.'));
      run.signal?.addEventListener('abort', cancel, { once: true });
      if (run.signal?.aborted === true) { cancel(); }
      worker.on('message', (message: ImportMessage) => {
        sample();
        if (message.kind === 'result') { result = message.report; }
        else if (message.kind === 'failure') { failure = new Error(message.message); }
        else {
          try {
            run.onProgress?.(message.progress);
            if (message.acknowledge === true) { worker.postMessage('verify'); }
          }
          catch (error: unknown) { stop(error instanceof Error ? error : new Error(String(error))); }
        }
      });
      worker.once('error', (error: Error) => { failure = error; });
      worker.once('exit', (code) => {
        run.signal?.removeEventListener('abort', cancel);
        if (failure !== undefined) { reject(failure); }
        else if (code !== 0 || result === undefined) { reject(new Error(`CSV worker exited without a verified result (code ${String(code)}).`)); }
        else { accept(result); }
      });
    });
    sample();
    report.sampledPeakRssBytes = sampledPeakRssBytes;
    report.peakRssBytes = Math.max(process.resourceUsage().maxRSS * 1024, sampledPeakRssBytes);
    report.totalMs = performance.now() - start;
    await writeFile(join(job.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    return report;
  } catch (error: unknown) {
    try { await cleanPartial(job.output); }
    catch (cleanup: unknown) {
      throw new Error(`${error instanceof Error ? error.message : String(error)} Partial output cleanup failed in ${job.output}: ${cleanup instanceof Error ? cleanup.message : String(cleanup)}`);
    }
    throw error;
  } finally { clearInterval(sampler); }
}

async function main(): Promise<void> {
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  process.on('SIGINT', cancel);
  process.on('SIGTERM', cancel);
  try {
    const values = new Map<string, string>();
    const allowed = new Set(['--input', '--output', '--batch-rows', '--chunk-bytes']);
    for (let index = 2; index < process.argv.length; index += 2) {
      const key = process.argv[index];
      const value = process.argv[index + 1];
      if (key === undefined || !allowed.has(key) || value === undefined || value.startsWith('--') || values.has(key)) {
        throw new Error('Use --input CSV [--output FRESH_DIRECTORY] [--batch-rows N] [--chunk-bytes N].');
      }
      values.set(key, value);
    }
    const input = values.get('--input');
    if (input === undefined) { throw new Error('Use --input CSV [--output FRESH_DIRECTORY] [--batch-rows N] [--chunk-bytes N].'); }
    const report = await runCsvImportSpike({
      input, output: values.get('--output') ?? `test/fixtures/generated/t004-${randomUUID()}`,
      ...(values.has('--batch-rows') ? { batchRows: Number(values.get('--batch-rows')) } : {}),
      ...(values.has('--chunk-bytes') ? { chunkBytes: Number(values.get('--chunk-bytes')) } : {}),
    }, {
      signal: controller.signal,
      onProgress: (progress) => process.stderr.write(`${progress.phase}: ${progress.stage ?? ''} ${String(progress.bytes)}/${String(progress.totalBytes)} bytes; ${String(progress.rows)} rows\n`),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error: unknown) {
    process.stderr.write(`CSV import spike failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) { await main(); }
