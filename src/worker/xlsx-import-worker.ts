import { parentPort, workerData } from 'node:worker_threads';
import type { CsvImportJob } from '../loaders/csv-import';
import { importXlsx } from '../loaders/xlsx-import';
void importXlsx(workerData as CsvImportJob, (value) => { parentPort?.postMessage({ type: 'progress', value }); })
  .then((tables) => { parentPort?.postMessage({ type: 'imported', tables }); }, (error: unknown) => {
    parentPort?.postMessage({ type: 'failure', message: `XLSX import failed: ${error instanceof Error ? error.message : 'Check the workbook and retry.'} Source file was not modified.`.slice(0, 4096) });
  });
