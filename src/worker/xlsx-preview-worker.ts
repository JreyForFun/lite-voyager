import { createRequire } from 'node:module';
import { parentPort, workerData } from 'node:worker_threads';
import type { XlsxSnapshot } from '../loaders/xlsx-consent';
import { previewXlsx } from '../loaders/xlsx-preview';
const job = workerData as { path: string; snapshot: XlsxSnapshot; fallback: boolean };
try {
  let fallback = job.fallback;
  if (!fallback) { try { createRequire(__filename)('node:sqlite'); } catch { fallback = true; } }
  if (fallback && BigInt(job.snapshot.size) > 20_000_000n) { throw new Error('Memory-limited XLSX source exceeds 20,000,000 bytes. Update VS Code.'); }
  parentPort?.postMessage({ type: 'xlsxPreviewResult', result: previewXlsx(job.path, job.snapshot) });
} catch (error: unknown) { parentPort?.postMessage({ type: 'failure', message: `XLSX preview failed: ${error instanceof Error ? error.message : 'Check the workbook and retry.'}`.slice(0, 4096) }); }
