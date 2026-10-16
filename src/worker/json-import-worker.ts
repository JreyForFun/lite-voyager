import { parentPort, workerData } from 'node:worker_threads';
import type { CsvImportJob } from '../loaders/csv-import';
import { importJson } from '../loaders/json-import';
void importJson(workerData as CsvImportJob, (value) => { parentPort?.postMessage({ type: 'progress', value }); })
  .then((tables) => { parentPort?.postMessage({ type: 'imported', tables }); }, (error: unknown) => {
    parentPort?.postMessage({ type: 'failure', message: `${error instanceof Error ? error.message : 'JSON import failed. Check the input and retry.'} Source file was not modified.`.slice(0, 4096) });
  });
