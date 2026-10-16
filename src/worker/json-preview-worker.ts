import { parentPort, workerData } from 'node:worker_threads';
import { jsonPreview } from '../loaders/json-preview';
import type { JsonFormat } from '../loaders/json-records';
const job = workerData as { path: string; format: JsonFormat };
try { parentPort?.postMessage({ type: 'jsonPreviewResult', result: jsonPreview(job.path, job.format) }); }
catch (error: unknown) { parentPort?.postMessage({ type: 'jsonPreviewFailure', message: (error instanceof Error ? error.message : 'JSON preview failed. Check the input and retry.').slice(0, 4096) }); }
