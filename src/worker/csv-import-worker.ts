import { parentPort, workerData } from 'node:worker_threads';
import { importCsv, type CsvImportJob } from '../loaders/csv-import';

const job = workerData as CsvImportJob;
void importCsv(job, (progress) => { parentPort?.postMessage({ type: 'progress', value: progress }); })
  .then((tables) => { parentPort?.postMessage({ type: 'imported', tables }); }, (error: unknown) => {
    const message = error instanceof Error ? error.message : 'CSV import failed. Reopen a regular UTF-8 file.';
    parentPort?.postMessage({ type: 'failure', message: `${message} Source file was not modified; reopen to retry.`.slice(0, 4096) });
  });
