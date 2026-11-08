import { fork, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import type { LauncherReply, LauncherRequest } from '../loaders/import-helper';

const port = parentPort;
if (port === null) { throw new Error('CSV import launcher requires a worker port.'); }
const directory = (workerData as { directory: string }).directory;
function reply(value: LauncherReply): void { port!.postMessage(value); }
function launch(): void {
  let child: ChildProcess;
  try {
    child = fork(join(directory, 'csv-import-process.js'), [], {
      execPath: process.execPath, execArgv: [], windowsHide: true, serialization: 'advanced',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
  } catch (error: unknown) {
    reply({ type: 'failure', message: error instanceof Error ? error.message : 'CSV import helper could not start.' });
    // Only a fork that returned no child can confirm closure without a close event.
    reply({ type: 'closed', code: null, signal: null }); port!.close(); return;
  }
  let stopping = false;
  child.once('spawn', () => { if (child.pid !== undefined) { reply({ type: 'ready', pid: child.pid }); } });
  child.on('error', (error: Error) => { reply({ type: 'failure', message: `CSV import helper failed: ${error.message}` }); });
  child.on('message', (value: unknown) => { reply({ type: 'message', value }); });
  child.once('close', (code, signal) => { reply({ type: 'closed', code, signal }); port!.close(); });
  port!.on('message', (request: LauncherRequest) => {
    if (request.type === 'stop') { stopping = true; child.kill(request.signal); return; }
    if (stopping || !child.connected) { reply({ type: 'sent', id: request.id, error: 'CSV import helper is disconnected.' }); return; }
    try { child.send(request.value, (error: Error | null) => { reply({ type: 'sent', id: request.id, error: error?.message ?? null }); }); }
    catch (error: unknown) { reply({ type: 'sent', id: request.id, error: error instanceof Error ? error.message : 'CSV import request could not be sent.' }); }
  });
}
launch();
