import { link, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { SqliteSaveService, type SqliteSaveOptions } from '../../src/editor/sqlite-save';

const directories: string[] = [];
afterEach(async () => { for (const root of directories.splice(0)) { await rm(root, { recursive: true, force: true }); } });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lv-t022-save-')); directories.push(root);
  const storageRoot = join(root, 'storage'); await mkdir(storageRoot); const source = join(storageRoot, 'table.sqlite'); const original = join(root, 'input.csv');
  await writeFile(source, 'complete database'); await writeFile(original, 'original CSV'); const destination = join(root, 'saved.sqlite');
  const copy = vi.fn<NonNullable<SqliteSaveOptions['copy']>>().mockImplementation(async (_source, target, _signal, progress) => {
    await writeFile(target, 'complete database'); progress('17', '17'); return '17';
  });
  const confirmReplace = vi.fn().mockResolvedValue(true);
  const options: SqliteSaveOptions = { source, original, storageRoot, workerDirectory: '/dist', choose: () => Promise.resolve(destination), confirmReplace, copy,
    available: () => Promise.resolve(100_000_000n) };
  return { root, storageRoot, source, original, destination, copy, confirmReplace, options };
}
test('FR-007: Given a complete immutable import, When saving to a new file, Then all bytes are atomically published and the source remains unchanged', async () => {
  const f = await fixture(); const progress = vi.fn();
  expect(await new SqliteSaveService(f.options).run(progress)).toEqual({ bytes: '17' });
  expect(await readFile(f.destination, 'utf8')).toBe('complete database');
  expect(await readFile(f.original, 'utf8')).toBe('original CSV'); expect(await readFile(f.source, 'utf8')).toBe('complete database');
  expect(f.confirmReplace).not.toHaveBeenCalled(); expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'saving' }));
  expect((await readdir(f.root)).filter((name) => name.startsWith('.lite-voyager-save-'))).toEqual([]);
});
test('FR-007: Given existing output, When replacement is declined or approved, Then only explicit consent replaces it', async () => {
  const f = await fixture(); await writeFile(f.destination, 'old'); f.confirmReplace.mockResolvedValueOnce(false);
  expect(await new SqliteSaveService(f.options).run(() => {})).toBeUndefined(); expect(f.copy).not.toHaveBeenCalled();
  expect(await readFile(f.destination, 'utf8')).toBe('old');
  await new SqliteSaveService(f.options).run(() => {}); expect(await readFile(f.destination, 'utf8')).toBe('complete database');
  expect(f.confirmReplace).toHaveBeenCalledTimes(2);
});
test('FR-007: Given protected paths, hard-link aliases and private storage, When saving, Then the worker never writes', async () => {
  const f = await fixture(); const alias = join(f.root, 'alias'); await link(f.original, alias);
  const databaseAlias = join(f.root, 'db-alias'); await link(f.source, databaseAlias);
  for (const path of [f.original, f.source, alias, databaseAlias, f.source + '-wal', f.original + '-journal', join(f.storageRoot, 'other.sqlite')]) {
    await expect(new SqliteSaveService({ ...f.options, choose: () => Promise.resolve(path) }).run(() => {})).rejects.toThrow(/source|storage|alias/iu);
  }
  expect(f.copy).not.toHaveBeenCalled();
});
test('FR-007: Given directory links and SQLite sidecars, When saving, Then protected aliases and active database outputs are refused', async () => {
  const f = await fixture(); const alias = join(f.root, 'linked'); await symlink(f.storageRoot, alias, 'junction');
  try {
    await expect(new SqliteSaveService({ ...f.options, choose: () => Promise.resolve(join(alias, 'table.sqlite')) }).run(() => {})).rejects.toThrow(/source|storage/iu);
    await writeFile(f.destination + '-wal', 'live WAL');
    await expect(new SqliteSaveService(f.options).run(() => {})).rejects.toThrow(/sidecar/iu); expect(f.copy).not.toHaveBeenCalled();
  } finally { await rm(alias); }
});
test('FR-007: Given low output space or a partial copy failure, When saving, Then old output survives and owned temporary files disappear', async () => {
  const f = await fixture(); await writeFile(f.destination, 'old');
  await expect(new SqliteSaveService({ ...f.options, available: () => Promise.resolve(0n) }).run(() => {})).rejects.toThrow(/space/iu); expect(f.copy).not.toHaveBeenCalled();
  f.copy.mockImplementationOnce(async (_source, target) => { await writeFile(target, 'partial'); throw new Error('Disk full. Free space and retry.'); });
  await expect(new SqliteSaveService(f.options).run(() => {})).rejects.toThrow(/Disk full/u);
  expect(await readFile(f.destination, 'utf8')).toBe('old'); expect((await readdir(f.root)).some((name) => name.startsWith('.lite-voyager-save-'))).toBe(false);
  await new SqliteSaveService(f.options).run(() => {}); expect(await readFile(f.destination, 'utf8')).toBe('complete database');
});
test('FR-007: Given a pending destination or replacement dialog, When closing, Then late answers cannot publish', async () => {
  for (const stage of ['choose', 'replace'] as const) {
    const f = await fixture(); await writeFile(f.destination, 'old'); let answer!: (value: never) => void;
    const options = { ...f.options, ...(stage === 'choose' ? { choose: () => new Promise<string>((accept) => { answer = accept; }) }
      : { confirmReplace: () => new Promise<boolean>((accept) => { answer = accept; }) }) };
    const service = new SqliteSaveService(options); const task = service.run(() => {}); const rejection = expect(task).rejects.toThrow(/cancelled/iu);
    await vi.waitFor(() => { expect(answer).toBeTypeOf('function'); }); service.abort(); await rejection; await service.settled();
    if (stage === 'choose') { (answer as (value: string) => void)(f.destination); } else { (answer as (value: boolean) => void)(true); }
    await Promise.resolve(); expect(f.copy).not.toHaveBeenCalled(); expect(await readFile(f.destination, 'utf8')).toBe('old');
  }
});
test('FR-007: Given copying in progress, When cancellation and another Save occur, Then closure waits and no partial output is published', async () => {
  const f = await fixture(); await writeFile(f.destination, 'old'); let finish!: () => void; let started!: () => void;
  const began = new Promise<void>((accept) => { started = accept; });
  f.copy.mockImplementationOnce(async (_source, target) => { await writeFile(target, 'partial'); started(); await new Promise<void>((accept) => { finish = accept; }); return '17'; });
  const service = new SqliteSaveService(f.options); const task = service.run(() => {}); const rejection = expect(task).rejects.toThrow(/cancelled/iu); await began;
  await expect(service.run(() => {})).rejects.toThrow(/already/iu); service.abort(); let settled = false;
  const closing = service.settled().then(() => { settled = true; }); await Promise.resolve(); expect(settled).toBe(false);
  finish(); await rejection; await closing; expect(await readFile(f.destination, 'utf8')).toBe('old');
});
test('FR-007: Given a destination changed during copying, When publishing, Then the new external file is preserved', async () => {
  const f = await fixture(); await writeFile(f.destination, 'old');
  f.copy.mockImplementationOnce(async (_source, target) => { await writeFile(target, 'complete database'); await writeFile(f.destination, 'external replacement'); return '17'; });
  await expect(new SqliteSaveService(f.options).run(() => {})).rejects.toThrow(/changed/iu);
  expect(await readFile(f.destination, 'utf8')).toBe('external replacement');
});
test('FR-007: Given cancellation after Saving begins, When publication completes, Then a complete database remains and settlement succeeds', async () => {
  const f = await fixture(); const service = new SqliteSaveService(f.options);
  await service.run((progress) => { if (progress.phase === 'saving') { service.abort(); } }); await service.settled();
  expect(await readFile(f.destination, 'utf8')).toBe('complete database');
});

test('FR-007: Given an original CSV removed after import, When saving the intact database, Then the independent imported snapshot can still be saved', async () => {
  const f = await fixture(); const originalSnapshot = { path: f.original, metadata: await stat(f.original, { bigint: true }) };
  await rm(f.original);
  await new SqliteSaveService({ ...f.options, originalSnapshot }).run(() => {});
  expect(await readFile(f.destination, 'utf8')).toBe('complete database');
});
test('NFR-001: Given an original CSV renamed and replaced after import, When saving to its moved inode or alias, Then the original bytes cannot be overwritten', async () => {
  const f = await fixture(); const originalSnapshot = { path: f.original, metadata: await stat(f.original, { bigint: true }) };
  const moved = join(f.root, 'moved.csv'); const alias = join(f.root, 'moved-alias.csv');
  await rename(f.original, moved); await link(moved, alias); await writeFile(f.original, 'external new CSV');
  for (const destination of [moved, alias]) {
    const service = new SqliteSaveService({ ...f.options, originalSnapshot, choose: () => Promise.resolve(destination) });
    await expect(service.run(() => {})).rejects.toThrow(/original|source|alias/iu);
  }
  expect(f.copy).not.toHaveBeenCalled(); expect(await readFile(moved, 'utf8')).toBe('original CSV');
  expect(await readFile(alias, 'utf8')).toBe('original CSV'); expect(await readFile(f.original, 'utf8')).toBe('external new CSV');
});
