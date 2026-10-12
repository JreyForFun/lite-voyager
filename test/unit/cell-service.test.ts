import { EventEmitter } from 'node:events';
import { afterEach, expect, test, vi } from 'vitest';
import { CellService } from '../../src/editor/cell-service';
import type { CellRequest, CellResponse } from '../../src/protocol';

const contextId = '12345678-1234-1234-1234-123456789abc';
class TestWorker extends EventEmitter {
  postMessage = vi.fn<(value: CellRequest) => void>();
  terminate = vi.fn(() => Promise.resolve(0));
}
const workers: TestWorker[] = [];
const replies: CellResponse[] = [];
const clipboard = vi.fn<(text: string) => Promise<void>>();
let service: CellService | undefined;
function setup(): CellService {
  clipboard.mockResolvedValue(undefined);
  service = new CellService('/dist', clipboard, (reply) => { replies.push(reply); }, () => {
    const worker = new TestWorker(); workers.push(worker); return worker;
  });
  return service;
}
afterEach(() => { service?.dispose(); workers.length = 0; replies.length = 0; vi.clearAllMocks(); vi.useRealTimers(); });

test('FR-018: Given rapidly changing details, When the worker is busy, Then only the newest queued value runs and copy remains independent', () => {
  const service = setup();
  for (let id = 1; id <= 100; id++) { service.handle({ type: 'cellDetails', contextId, id, value: String(id) }); }
  expect(workers).toHaveLength(1); expect(workers[0]?.postMessage).toHaveBeenCalledTimes(1);
  workers[0]?.emit('message', { type: 'cellDetailsResult', contextId, id: 1, detail: { text: '1', kind: 'JSON', notice: '' } });
  expect(workers[0]?.postMessage).toHaveBeenLastCalledWith({ type: 'cellDetails', contextId, id: 100, value: '100' });
  service.handle({ type: 'cellCopy', contextId, id: 101, rows: [['exact']] });
  expect(workers).toHaveLength(2);
});

test('FR-018: Given the first status and a recreated webview context, When activated, Then the service remains usable and old preparation cannot write the clipboard', () => {
  const service = setup(); service.activate(contextId);
  service.handle({ type: 'cellDetails', contextId, id: 1, value: '{}' });
  expect(workers).toHaveLength(1);
  const nextContext = 'abcdef12-1234-1234-1234-123456789abc';
  service.activate(nextContext);
  workers[0]?.emit('message', { type: 'cellDetailsResult', contextId, id: 1, detail: { text: '{}', kind: 'JSON', notice: '' } });
  expect(replies).toHaveLength(0);
  service.handle({ type: 'cellCopy', contextId, id: 2, rows: [['old']] });
  expect(workers).toHaveLength(1);
  service.handle({ type: 'cellCopy', contextId: nextContext, id: 1, rows: [['new']] });
  expect(workers).toHaveLength(2);
  expect(clipboard).not.toHaveBeenCalled();
});

test('FR-018: Given prepared TSV, When clipboard succeeds or fails, Then only explicit copies write and actionable results reach the user', async () => {
  const service = setup();
  service.handle({ type: 'cellCopy', contextId, id: 1, rows: [['exact']] });
  workers[0]?.emit('message', { type: 'cellCopyPrepared', contextId, id: 1, text: 'exact' });
  await vi.waitFor(() => { expect(replies.at(-1)?.type).toBe('cellCopyResult'); });
  expect(clipboard).toHaveBeenCalledWith('exact');
  clipboard.mockRejectedValueOnce(new Error('clipboard unavailable'));
  service.handle({ type: 'cellCopy', contextId, id: 2, rows: [['next']] });
  workers[0]?.emit('message', { type: 'cellCopyPrepared', contextId, id: 2, text: 'next' });
  await vi.waitFor(() => {
    expect(replies.at(-1)).toMatchObject({ type: 'cellFailed', operation: 'copy' });
    const reply = replies.at(-1); expect(reply?.type === 'cellFailed' ? reply.message : '').toContain('Retry');
  });
});

test('FR-018: Given cancellation, disposal and a stale worker, When late preparation arrives, Then no clipboard write occurs and retry starts a fresh worker', () => {
  const service = setup();
  service.handle({ type: 'cellCopy', contextId, id: 1, rows: [['secret']] });
  const old = workers[0];
  service.handle({ type: 'cellCancel', contextId, id: 2 });
  old?.emit('message', { type: 'cellCopyPrepared', contextId, id: 1, text: 'secret' });
  expect(clipboard).not.toHaveBeenCalled(); expect(old?.terminate).toHaveBeenCalledTimes(1);
  expect(replies.at(-1)).toMatchObject({ type: 'cellFailed', operation: 'cancel' });
  const cancelled = replies.at(-1); expect(cancelled?.type === 'cellFailed' ? cancelled.message : '').toContain('cancelled');
  service.handle({ type: 'cellCopy', contextId, id: 3, rows: [['retry']] });
  expect(workers).toHaveLength(2); service.dispose();
  workers[1]?.emit('message', { type: 'cellCopyPrepared', contextId, id: 3, text: 'retry' });
  expect(clipboard).not.toHaveBeenCalled();
});

test('FR-018: Given a worker error, malformed reply or timeout, When it fails, Then the operation reports failure and can recover', () => {
  vi.useFakeTimers(); const service = setup();
  service.handle({ type: 'cellDetails', contextId, id: 1, value: '{}' });
  workers[0]?.emit('error', new Error('crashed'));
  expect(replies.at(-1)).toMatchObject({ type: 'cellFailed', operation: 'details' });
  service.handle({ type: 'cellCopy', contextId, id: 2, rows: [['test']] });
  workers[1]?.emit('message', { type: 'cellCopyPrepared', contextId, id: 2, text: 42 });
  expect(clipboard).not.toHaveBeenCalled(); expect(replies.at(-1)).toMatchObject({ type: 'cellFailed', operation: 'copy' });
  service.handle({ type: 'cellDetails', contextId, id: 3, value: '{}' });
  vi.advanceTimersByTime(10000);
  expect(replies.at(-1)?.type).toBe('cellFailed');
  const timeout = replies.at(-1); expect(timeout?.type === 'cellFailed' ? timeout.message : '').toContain('timed out');
});
