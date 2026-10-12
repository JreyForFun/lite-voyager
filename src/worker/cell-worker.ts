import { parentPort } from 'node:worker_threads';
import { isCellRequest, type CellWorkerResponse } from '../protocol';
import { cellDetails, selectionTsv } from './cell-transform';

if (parentPort === null) { throw new Error('Cell transforms require a worker thread.'); }
const port = parentPort;
port.on('message', (value: unknown) => {
  if (!isCellRequest(value) || value.type === 'cellCancel') { return; }
  let reply: CellWorkerResponse;
  try {
    reply = value.type === 'cellDetails' ? { type: 'cellDetailsResult', contextId: value.contextId, id: value.id, detail: cellDetails(value.value) }
      : { type: 'cellCopyPrepared', contextId: value.contextId, id: value.id, text: selectionTsv(value.rows) };
  } catch (error: unknown) {
    reply = { type: 'cellFailed', contextId: value.contextId, id: value.id, operation: value.type === 'cellDetails' ? 'details' : 'copy',
      message: error instanceof Error ? error.message : 'Unable to prepare these cells. Retry with fewer cells.' };
  }
  port.postMessage(reply);
});
