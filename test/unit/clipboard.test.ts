import { EventEmitter } from 'node:events';
import type { Clipboard } from 'vscode';
import { expect, test, vi } from 'vitest';
import { writeClipboard } from '../../src/editor/clipboard';
import { CellService } from '../../src/editor/cell-service';
import type { CellRequest, CellResponse } from '../../src/protocol';

const contextId = '12345678-1234-1234-1234-123456789abc';

test('FR-018: Given a pending clipboard write and read, When copying, Then completion waits for both in order and exact text verification', async () => {
  let finishWrite: () => void = () => {};
  let finishRead: (text: string) => void = () => {};
  const clipboard = {
    writeText: vi.fn(() => new Promise<void>((resolve) => { finishWrite = resolve; })),
    readText: vi.fn(() => new Promise<string>((resolve) => { finishRead = resolve; })),
  } satisfies Clipboard;
  let complete = false;
  const copied = writeClipboard(clipboard, 'exact\t🚀').then(() => { complete = true; });
  expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith('exact\t🚀');
  expect(clipboard.readText).not.toHaveBeenCalled(); expect(complete).toBe(false);
  finishWrite(); await Promise.resolve();
  expect(clipboard.readText).toHaveBeenCalledOnce(); expect(complete).toBe(false);
  finishRead('exact\t🚀'); await copied; expect(complete).toBe(true);
});

test.each(['empty', 'changed tail'] as const)('FR-018: Given a fulfilled clipboard write with %s readback, When verifying a large value, Then copying fails without retries or exposing its contents', async (mode) => {
  const text = 'x'.repeat(1_100_000);
  const clipboard = { writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(mode === 'empty' ? '' : text.slice(0, -1) + 'y') } satisfies Clipboard;
  await expect(writeClipboard(clipboard, text)).rejects.toThrow(/^Clipboard copy could not be verified\.$/u);
  expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(text);
  expect(clipboard.readText).toHaveBeenCalledOnce();
});

test('FR-018: Given clipboard read or write rejection, When copying, Then the failure propagates without another write or a read after a failed write', async () => {
  const failure = new Error('native clipboard unavailable');
  const clipboard = { writeText: vi.fn().mockResolvedValue(undefined), readText: vi.fn().mockRejectedValue(failure) } satisfies Clipboard;
  await expect(writeClipboard(clipboard, 'exact')).rejects.toBe(failure);
  expect(clipboard.writeText).toHaveBeenCalledOnce(); expect(clipboard.readText).toHaveBeenCalledOnce();
  clipboard.writeText.mockRejectedValueOnce(failure); clipboard.readText.mockClear();
  await expect(writeClipboard(clipboard, 'next')).rejects.toBe(failure);
  expect(clipboard.writeText).toHaveBeenCalledTimes(2); expect(clipboard.readText).not.toHaveBeenCalled();
});

class TestWorker extends EventEmitter {
  postMessage = vi.fn<(message: CellRequest) => void>();
  terminate = vi.fn(() => Promise.resolve(0));
}

test('FR-018: Given a clipboard that silently loses a write, When prepared TSV arrives, Then the user receives failure instead of success and can explicitly retry', async () => {
  let stored = '';
  const clipboard = { writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined),
    readText: vi.fn(() => Promise.resolve(stored)) } satisfies Clipboard;
  const worker = new TestWorker(); const replies: CellResponse[] = [];
  const service = new CellService('/dist', (text) => writeClipboard(clipboard, text), (reply) => { replies.push(reply); }, () => worker);
  try {
    service.handle({ type: 'cellCopy', contextId, id: 1, rows: [['exact']] });
    worker.emit('message', { type: 'cellCopyPrepared', contextId, id: 1, text: 'exact' });
    await vi.waitFor(() => { expect(replies).toHaveLength(1); });
    expect(replies[0]).toMatchObject({ type: 'cellFailed', operation: 'copy' });
    const reply = replies[0]; expect(reply?.type === 'cellFailed' ? reply.message : '').toMatch(/could not be verified.*Retry/u);
    expect(clipboard.writeText).toHaveBeenCalledOnce(); expect(clipboard.readText).toHaveBeenCalledOnce();
    clipboard.writeText.mockImplementation((text) => { stored = text; return Promise.resolve(); });
    service.handle({ type: 'cellCopy', contextId, id: 2, rows: [['retry']] });
    worker.emit('message', { type: 'cellCopyPrepared', contextId, id: 2, text: 'retry' });
    await vi.waitFor(() => { expect(replies.at(-1)).toMatchObject({ type: 'cellCopyResult', id: 2 }); });
    expect(clipboard.writeText).toHaveBeenCalledTimes(2); expect(stored).toBe('retry');
  } finally { service.dispose(); }
});

test.each(['cancel', 'dispose', 'new context'] as const)('FR-018: Given pending clipboard verification, When %s occurs, Then late verification cannot acknowledge a stale copy or rewrite the clipboard', async (operation) => {
  let finishRead: (text: string) => void = () => {};
  const clipboard = { writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn(() => new Promise<string>((resolve) => { finishRead = resolve; })) } satisfies Clipboard;
  const worker = new TestWorker(); const replies: CellResponse[] = [];
  let verification: Promise<void> | undefined;
  const service = new CellService('/dist', (text) => { verification = writeClipboard(clipboard, text); return verification; }, (reply) => { replies.push(reply); }, () => worker);
  try {
    service.handle({ type: 'cellCopy', contextId, id: 1, rows: [['exact']] });
    worker.emit('message', { type: 'cellCopyPrepared', contextId, id: 1, text: 'exact' });
    await vi.waitFor(() => { expect(clipboard.readText).toHaveBeenCalledOnce(); });
    if (operation === 'cancel') { service.handle({ type: 'cellCancel', contextId, id: 2 }); }
    else if (operation === 'dispose') { service.dispose(); }
    else { service.activate('abcdef12-1234-1234-1234-123456789abc'); }
    const before = [...replies];
    finishRead('exact'); await verification;
    expect(replies).toEqual(before); expect(replies.some((reply) => reply.type === 'cellCopyResult')).toBe(false);
    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith('exact');
  } finally { service.dispose(); }
});
