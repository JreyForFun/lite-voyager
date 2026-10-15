import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type { CsvImportJob } from '../loaders/csv-import';
import { CsvImportRelay } from './csv-import-relay';

let worker: Worker | undefined;
function stop(): void { process.kill(process.pid, 'SIGKILL'); }
const relay = new CsvImportRelay((value) => new Promise<void>((accept, reject) => {
  if (!process.connected || process.send === undefined) { reject(new Error('CSV helper disconnected.')); return; }
  process.send(value, (error) => { if (error !== null) { reject(error); } else { accept(); } });
}), stop);
process.on('disconnect', stop);
process.once('message', (job: CsvImportJob) => {
  try {
    // Collect transient parser objects promptly. Large objects/old-generation
    // limits remain the runtime defaults; this sets no file or record size cap.
    worker = new Worker(join(job.directory, 'csv-import-worker.js'), { workerData: job, resourceLimits: { maxYoungGenerationSizeMb: 8 } });
    worker.on('message', (value: unknown) => { relay.accept(value); });
    worker.on('error', () => { relay.accept({ type: 'failure', message: 'CSV import worker failed. Rebuild and reopen the file.' }); });
    worker.on('exit', () => { relay.accept({ type: 'failure', message: 'CSV import worker exited. Reopen the file.' }); });
  } catch { relay.accept({ type: 'failure', message: 'Unable to start CSV import worker. Rebuild and reopen the file.' }); }
});
