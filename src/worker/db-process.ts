import { Worker } from 'node:worker_threads';
import type { DatabaseHelperRequest, DatabaseResponse } from '../protocol';

let worker: Worker | undefined;
let failed = false;
function stop(): void { process.kill(process.pid, 'SIGKILL'); }
function reply(message: DatabaseResponse, stopAfterReply = false): void {
  if (!process.connected || process.send === undefined) { stop(); return; }
  process.send(message, (error) => { if (error !== null || stopAfterReply) { stop(); } });
}
function fail(message: string): void {
  if (failed) { return; }
  failed = true;
  reply({ type: 'failed', message }, true);
}
process.on('disconnect', stop);
process.on('message', (request: DatabaseHelperRequest) => {
  if (failed) { return; }
  try {
    if (request.type === 'open' && worker === undefined) {
      worker = new Worker(request.workerPath, { workerData: request.options });
      worker.on('message', (message: DatabaseResponse) => reply(message));
      worker.on('error', () => fail('The database worker failed. Reopen the file to recover.'));
      worker.on('exit', () => fail('The database worker stopped. Reopen the file to recover.'));
    } else if (request.type === 'request' && worker !== undefined) { worker.postMessage(request.value); }
    else { fail('The database helper received an invalid request. Reopen the file.'); }
  } catch { fail('The database worker could not start or receive a request. Rebuild the extension and retry.'); }
});
