import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import { runCsvImport } from '../../src/loaders/csv-import-client';
import type { DatabaseHelperRequest } from '../../src/protocol';

const mocks = vi.hoisted(() => ({ fork: vi.fn(), register: vi.fn() }));
vi.mock('node:child_process', () => ({ fork: mocks.fork }));
vi.mock('../../src/storage/temp-storage', () => ({ registerStorageHelper: mocks.register }));
class Helper extends EventEmitter {
  pid = 42; connected = true; exitCode: number | null = null; signalCode: NodeJS.Signals | null = null;
  send = vi.fn();
  kill(): boolean { this.stop(); return true; }
  stop(): void { this.connected = false; this.exitCode = 1; this.emit('close', 1, null); }
}
const directories: string[] = [];
beforeEach(() => { mocks.fork.mockReset(); mocks.register.mockReset(); });
afterEach(async () => { for (const path of directories.splice(0)) { await rm(path, { recursive: true, force: true }); } });

test.each(['cancel', 'open', 'open-then-close'] as const)('FR-020: Given a crashed Save awaiting worker recovery, When %s requests a reader, Then recovery and disposal finish before any reader can reopen', async (action) => {
  const root = await mkdtemp(join(tmpdir(), 'lv-t030-recovery-order-')); directories.push(root); const source = join(root, 'source.sqlite');
  await writeFile(source, 'owned transport fixture'); await writeFile(source + '-journal', 'owned journal marker');
  const writer = new Helper(); const recovery = new Helper(); const reader = new Helper();
  mocks.fork.mockReturnValueOnce(writer).mockReturnValueOnce(recovery).mockReturnValueOnce(reader);
  const opened = { type: 'opened', value: { engine: 'node:sqlite', memoryLimited: false, bytes: '23', needsConsent: false, notice: '', threadId: 1, processId: 42, sqlite: 'fixture' } };
  reader.send.mockImplementation((message: DatabaseHelperRequest) => { if (message.type === 'open') { queueMicrotask(() => { reader.emit('message', opened); }); } });
  const client = new EngineClient({ directory: '/dist' }); const opening = client.open(source); writer.emit('message', opened); await opening;
  const saving = client.edit({ action: 'save', version: 'original', operations: [] }).then(() => 'saved', (error: unknown) => error instanceof Error ? error.message : 'failed');
  let restarting: Promise<string> | undefined;
  let closing: Promise<void> | undefined;
  try {
    await vi.waitFor(() => { expect(writer.send.mock.calls.some(([value]) => (value as DatabaseHelperRequest).type === 'request')).toBe(true); });
    writer.stop(); await vi.waitFor(() => { expect(recovery.send).toHaveBeenCalled(); });
    restarting = (action === 'cancel' ? client.cancel() : client.open(source)).then(() => 'opened', (error: unknown) => error instanceof Error ? error.message : 'failed');
    if (action === 'open-then-close') { closing = client.close(); }
    expect(mocks.fork).toHaveBeenCalledTimes(2);
    recovery.emit('message', opened);
    if (closing === undefined) { expect(await restarting).toBe('opened'); expect(mocks.fork).toHaveBeenCalledTimes(3); }
    else { expect(await restarting).toMatch(/closed|cancelled/iu); await closing; expect(mocks.fork).toHaveBeenCalledTimes(2); }
    expect(await saving).toMatch(/stopped/iu);
  } finally { recovery.emit('message', opened); await client.close(); await closing; await saving; await restarting; }
});
test.each(['import', 'database'] as const)('FR-007: Given a %s helper exiting during owner registration, When its marker finishes, Then no storage work starts and the operation fails promptly', async (kind) => {
  const root = await mkdtemp(join(tmpdir(), 'lv-t022-register-')); directories.push(root); await writeFile(join(root, 'source.csv'), 'a\n1\n');
  const child = new Helper(); mocks.fork.mockReturnValue(child); let registered!: () => void;
  mocks.register.mockImplementation(() => new Promise<void>((accept) => { registered = accept; }));
  const client = new EngineClient({ directory: '/dist', ownerDirectory: root });
  const task = kind === 'database' ? client.open(join(root, 'table.sqlite')) : runCsvImport('/dist', join(root, 'source.csv'),
    { path: join(root, 'table.sqlite'), engine: 'node:sqlite', ownerDirectory: root }, {}, () => {}, new AbortController().signal);
  const rejected = expect(task).rejects.toThrow(/helper.*stopped|helper.*failed/iu);
  await vi.waitFor(() => { expect(mocks.register).toHaveBeenCalledOnce(); });
  child.stop(); registered(); await rejected; expect(child.send).not.toHaveBeenCalled();
});
test('FR-007: Given a spawn error during import helper registration, When it arrives before registration finishes, Then it has a handler and becomes an actionable failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lv-t022-register-')); directories.push(root); const child = new Helper();
  mocks.fork.mockReturnValue(child); let registered!: () => void;
  mocks.register.mockImplementation(() => new Promise<void>((accept) => { registered = accept; }));
  const task = runCsvImport('/dist', 'source', { path: join(root, 'table.sqlite'), engine: 'node:sqlite', ownerDirectory: root }, {}, () => {}, new AbortController().signal);
  const rejected = expect(task).rejects.toThrow(/helper.*stopped|helper.*failed/iu);
  await vi.waitFor(() => { expect(mocks.register).toHaveBeenCalledOnce(); });
  const handlers = child.listenerCount('error');
  if (handlers > 0) { child.emit('error', new Error('spawn failed')); }
  child.stop(); registered(); await rejected;
  expect(handlers).toBeGreaterThan(0);
});
