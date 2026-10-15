import { parentPort, workerData } from 'node:worker_threads';
import { copyDatabaseBytes } from '../storage/copy-database';

const port = parentPort;
if (port === null) { throw new Error('SQLite save worker requires a parent.'); }
const signal = new AbortController(); let sending = false; let latest: { type: 'progress'; bytes: string; total: string } | undefined;
function progress(bytes: string, total: string): void {
  const message = { type: 'progress' as const, bytes, total };
  if (sending) { latest = message; } else { sending = true; port?.postMessage(message); }
}
port.on('message', (message: unknown) => {
  if (message === 'cancel') { signal.abort(); }
  else if (message === 'ack') { sending = false; const next = latest; latest = undefined; if (next !== undefined) { progress(next.bytes, next.total); } }
});
const data = workerData as { source: string; target: string };
void copyDatabaseBytes(data.source, data.target, signal.signal, progress).then(
  (bytes) => { port.postMessage({ type: 'done', bytes }); },
  (error: unknown) => { port.postMessage({ type: 'failure', message: error instanceof Error && !('code' in error) ? error.message : 'SQLite save could not copy the database. Check free disk space and permissions, then retry.' }); },
).finally(() => { latest = undefined; port.close(); });
