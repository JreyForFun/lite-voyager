import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import { runCsvImport } from '../../src/loaders/csv-import-client';

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
