import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { SqliteSaveService } from '../../src/editor/sqlite-save';

const fault = vi.hoisted(() => ({ publish: false, cleanup: false }));
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>();
  return { ...fs, rename: async (...args: Parameters<typeof fs.rename>) => {
    if (fault.publish) { throw Object.assign(new Error('locked'), { code: 'EPERM' }); } return fs.rename(...args);
  }, rm: async (...args: Parameters<typeof fs.rm>) => {
    if (fault.cleanup && String(args[0]).includes('.lite-voyager-save-')) { throw Object.assign(new Error('locked'), { code: 'EPERM' }); }
    return fs.rm(...args);
  } };
});
const directories: string[] = [];
afterEach(async () => { fault.publish = false; fault.cleanup = false; for (const root of directories.splice(0)) { await rm(root, { recursive: true, force: true }); } });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lv-t022-fault-')); directories.push(root); const storageRoot = join(root, 'storage'); await mkdir(storageRoot);
  const source = join(storageRoot, 'table.sqlite'); const original = join(root, 'source.csv'); const destination = join(root, 'result.sqlite');
  await writeFile(source, 'complete'); await writeFile(original, 'original'); await writeFile(destination, 'old');
  return { root, destination, options: { source, original, storageRoot, workerDirectory: '/dist', choose: () => Promise.resolve(destination),
    confirmReplace: () => Promise.resolve(true), copy: async (_source: string, target: string) => { await writeFile(target, 'complete'); return '8'; }, available: () => Promise.resolve(1_000_000_000n) } };
}
test('FR-007: Given a locked destination at the atomic commit point, When Saving fails, Then old output remains and settlement retains the actionable failure', async () => {
  const f = await fixture(); fault.publish = true; const service = new SqliteSaveService(f.options);
  await expect(service.run(() => {})).rejects.toThrow(/publish.*permissions/iu); await expect(service.settled()).rejects.toThrow(/publish/iu);
  expect(await readFile(f.destination, 'utf8')).toBe('old'); expect((await readdir(f.root)).some((name) => name.startsWith('.lite-voyager-save-'))).toBe(false);
  fault.publish = false; await service.run(() => {}); await service.settled(); expect(await readFile(f.destination, 'utf8')).toBe('complete');
});
test('FR-007: Given cleanup failure after successful publication, When the tab closes, Then settlement reports remaining temporary files and preserves the complete saved output', async () => {
  const f = await fixture(); fault.cleanup = true; const service = new SqliteSaveService(f.options);
  await expect(service.run(() => {})).rejects.toThrow(/temporary files.*If Saving began/iu);
  await expect(service.settled()).rejects.toThrow(/temporary files/iu); expect(await readFile(f.destination, 'utf8')).toBe('complete');
});
test('FR-007: Given a missing destination created during the copy, When new-file publication runs, Then external output cannot be overwritten', async () => {
  const f = await fixture(); await rm(f.destination);
  const service = new SqliteSaveService({ ...f.options, copy: async (_source, target) => {
    await writeFile(target, 'complete'); await writeFile(f.destination, 'external'); return '8';
  } });
  await expect(service.run(() => {})).rejects.toThrow(/changed/iu); expect(await readFile(f.destination, 'utf8')).toBe('external');
});
