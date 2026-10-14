import { parentPort, workerData } from 'node:worker_threads';
import { previewOptions } from '../loaders/file-loader';
import { readCsvPreview } from '../loaders/csv-preview-reader';

try {
  const job: unknown = workerData;
  if (typeof job !== 'object' || job === null || !('path' in job) || typeof job.path !== 'string' || !('options' in job)) { throw new Error('Invalid preview worker request.'); }
  parentPort?.postMessage({ type: 'csvPreviewResult', result: readCsvPreview(job.path, previewOptions(job.options)) });
} catch (error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  const message = code === 'ENOENT' ? 'The CSV/TSV file is missing or was deleted. Choose an existing local file and reopen the preview.'
    : code === 'EACCES' || code === 'EPERM' ? 'The CSV/TSV file cannot be read. Check permissions and close programs locking it, then reopen the preview.'
    : `${error instanceof Error ? error.message : 'CSV preview failed.'} Check the file and reopen the preview.`;
  parentPort?.postMessage({ type: 'csvPreviewFailure', message });
}
