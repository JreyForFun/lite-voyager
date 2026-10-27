import { backup, DatabaseSync } from 'node:sqlite';
import { parentPort, workerData } from 'node:worker_threads';

const port = parentPort;
if (port === null) { throw new Error('SQLite snapshot copying requires a worker.'); }
const data = workerData as { source: string; target: string };

/** A fresh read-only connection has no active browser cursors. SQLite's backup
 * API preserves hidden rowids and includes committed WAL pages. No source SQL
 * writes or source checkpoint is permitted. The enclosing helper owns lifetime. */
async function copy(): Promise<void> {
  const source = new DatabaseSync(data.source, { readOnly: true, allowExtension: false });
  try {
    source.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON');
    await backup(source, data.target);
  } finally { source.close(); }
}
void copy().then(() => { port.postMessage({ done: true }); }, () => {
  port.postMessage({ error: 'SQLite Save As could not copy a consistent snapshot. Check permissions, free space and other database writers.' });
}).finally(() => { port.close(); });
