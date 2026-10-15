import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { checkImportSpace, importSpaceEstimate, registerStorageHelper, TempStorage } from '../../src/storage/temp-storage';

const directories: string[] = [];
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'lv-t022-storage-')); directories.push(root); return root; }
afterEach(async () => { vi.restoreAllMocks(); for (const root of directories.splice(0)) { await rm(root, { recursive: true, force: true }); } });

test('FR-007: Given a source beyond safe number range, When estimating import space, Then the three-copy estimate remains exact', () => {
  expect(importSpaceEstimate(9007199254740993n)).toBe(27021597831331843n);
});
test('FR-007: Given insufficient estimated space, When checking before import, Then cancel refuses and explicit override allows import', async () => {
  const root = await fixture(); const confirm = vi.fn().mockResolvedValue(false);
  await expect(checkImportSpace(root, 10n, confirm, () => Promise.resolve(1n))).rejects.toThrow(/space.*cancelled/iu);
  expect(confirm).toHaveBeenCalledWith({ available: 1n, required: importSpaceEstimate(10n) });
  confirm.mockResolvedValue(true);
  await expect(checkImportSpace(root, 10n, confirm, () => Promise.resolve(1n))).resolves.toBeUndefined();
  confirm.mockClear(); await checkImportSpace(root, 10n, confirm, () => Promise.resolve(importSpaceEstimate(10n)));
  expect(confirm).not.toHaveBeenCalled();
});
test('FR-007: Given an unavailable filesystem check, When checking import space, Then an actionable error prevents import', async () => {
  await expect(checkImportSpace(await fixture(), 0n, () => Promise.resolve(true), () => Promise.reject(new Error('unavailable')))).rejects.toThrow(/check.*space.*permissions/iu);
});
test('FR-007: Given live hosts, live helpers, unknown storage and dead owners, When startup cleanup runs, Then only proven orphan storage is removed', async () => {
  const root = await fixture(); const storage = new TempStorage(root, (pid) => pid === 22 || pid === 44);
  const names = ['session-v1-11-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'session-v1-22-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'session-v1-33-cccccccccccccccccccccccccccccccc', 'csv-session-legacy', 'unrelated'];
  for (const name of names) { await mkdir(join(root, name)); await writeFile(join(root, name, 'table.sqlite'), 'keep or owned'); }
  await registerStorageHelper(join(root, names[2]!), 44);
  await storage.cleanupOrphans();
  expect(await readdir(root)).toEqual(names.slice(1).sort());
  expect(await readFile(join(root, names[2]!, 'table.sqlite'), 'utf8')).toBe('keep or owned');
});
test('FR-007: Given linked session directories and malformed helper markers, When cleanup runs, Then external and uncertain data survives', async () => {
  const root = await fixture(); const external = await fixture(); await writeFile(join(external, 'keep'), 'external');
  const linked = join(root, 'session-v1-11-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'); await symlink(external, linked, 'junction');
  const uncertain = join(root, 'session-v1-12-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'); await mkdir(uncertain); await writeFile(join(uncertain, '.helper-invalid'), '');
  try {
    await new TempStorage(root, () => false).cleanupOrphans();
    expect(await readFile(join(external, 'keep'), 'utf8')).toBe('external'); expect(await readdir(root)).toHaveLength(2);
  } finally { await rm(linked); }
});
test('FR-007: Given a new owned session, When registering helpers and closing, Then names prove ownership and removal cannot escape the root', async () => {
  const root = await fixture(); const storage = new TempStorage(root); const session = await storage.create();
  expect(basename(session)).toMatch(new RegExp(`^session-v1-${String(process.pid)}-[a-f0-9]{32}$`, 'u'));
  await registerStorageHelper(session, process.pid); await registerStorageHelper(session, process.pid);
  await expect(storage.remove(root)).rejects.toThrow(/owned/iu);
  await expect(storage.remove(join(root, '..', 'outside'))).rejects.toThrow(/owned/iu);
  await storage.remove(session); expect(await readdir(root)).toEqual([]);
});
test('FR-007: Given uncertain PID permissions, When startup cleanup runs, Then unknown liveness retains storage', async () => {
  const root = await fixture(); const path = join(root, `session-v1-${String(process.pid)}-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`); await mkdir(path);
  const kill = vi.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(new Error('denied'), { code: 'EPERM' }); });
  await new TempStorage(root).cleanupOrphans(); expect(await readdir(root)).toHaveLength(1); kill.mockRestore();
});

test('FR-007: Given a pending low-space decision, When the session closes, Then cancellation completes without waiting for the dialog', async () => {
  const root = await fixture(); const signal = new AbortController(); let answer!: (value: boolean) => void;
  const task = checkImportSpace(root, 10n, () => new Promise<boolean>((accept) => { answer = accept; }), () => Promise.resolve(0n), signal.signal);
  const rejection = expect(task).rejects.toThrow(/cancelled/iu); await vi.waitFor(() => { expect(answer).toBeTypeOf('function'); });
  signal.abort(); await rejection; answer(true);
});
