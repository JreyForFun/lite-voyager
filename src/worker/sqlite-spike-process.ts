import { Worker } from 'node:worker_threads';
import type { SpikeHelperRequest, SpikeResponse } from './sqlite-spike-protocol';

let worker: Worker | undefined;

function reply(message: SpikeResponse, stopAfterReply = false): void {
  if (process.connected && process.send !== undefined) {
    process.send(message, (error) => { if (error !== null || stopAfterReply) { stop(); } });
  }
}

function stop(): void {
  // Killing this helper stops all its threads, including a synchronous native call.
  process.kill(process.pid, 'SIGKILL');
}

process.on('disconnect', stop);
process.on('message', (request: SpikeHelperRequest) => {
  if (request.type === 'open' && worker === undefined) {
    try {
      worker = new Worker(request.workerPath, { workerData: request.options });
      worker.on('message', (message: SpikeResponse) => reply(message));
      worker.on('error', () => reply({ type: 'failed', message: 'The SQLite spike worker failed. Reopen the file to recover.' }, true));
      worker.on('exit', () => reply({ type: 'failed', message: 'The SQLite spike worker stopped. Reopen the file to recover.' }, true));
    } catch {
      reply({ type: 'failed', message: 'The SQLite spike worker could not start. Rebuild the extension and retry.' });
    }
  } else if (request.type === 'query' && worker !== undefined) {
    worker.postMessage(request.value);
  } else {
    reply({ type: 'failed', message: 'The SQLite spike worker received an invalid request. Reopen the file.' });
  }
});
