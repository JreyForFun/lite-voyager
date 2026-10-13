import { link, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { ExportService } from '../../src/editor/export-service';
import type { Engine } from '../../src/engine/engine';

async function fixture(task: (directory: string, source: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t015-service-')); const source = join(directory, 'source.sqlite');
  await writeFile(source, 'original');
  try { await task(directory, source); expect(await readFile(source, 'utf8')).toBe('original'); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
function engine() {
  return { exportResults: vi.fn<Engine['exportResults']>().mockImplementation(async (_sql, _format, path, progress) => {
    await writeFile(path, 'complete'); const result = { rows: '205', bytes: '8', blobs: '0' }; progress?.(result); return result;
  }) };
}
test('FR-014: Given an authorized output destination, When export succeeds, Then output replaces atomically and temporary siblings are removed', async () => {
  await fixture(async (directory, source) => {
    const destination = join(directory, 'result.csv'); await writeFile(destination, 'old'); const worker = engine();
    const service = new ExportService(source, worker, () => Promise.resolve(destination)); const progress = vi.fn();
    expect(await service.run('SELECT 1', 'csv', progress)).toMatchObject({ rows: '205' });
    expect(await readFile(destination, 'utf8')).toBe('complete'); expect(await readdir(directory)).toEqual(['result.csv', 'source.sqlite']);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'saving' }));
  });
});
test('FR-014: Given source, hard-link alias and sidecar destinations, When exporting, Then each is refused before the worker writes', async () => {
  await fixture(async (directory, source) => {
    const alias = join(directory, 'alias.sqlite'); await link(source, alias);
    for (const path of [source, alias, source + '-wal', source + '-shm', source + '-journal']) {
      const worker = engine(); const service = new ExportService(source, worker, () => Promise.resolve(path));
      await expect(service.run('SELECT 1', 'csv', () => {})).rejects.toThrow(/source|sidecar/iu); expect(worker.exportResults).not.toHaveBeenCalled();
    }
  });
});
test('FR-014: Given write failure or late source alias replacement, When saving, Then existing destinations survive and temporary files are cleaned', async () => {
  await fixture(async (directory, source) => {
    const path = join(directory, 'result'); await writeFile(path, 'old'); const worker = engine();
    worker.exportResults.mockRejectedValueOnce(new Error('disk full'));
    await expect(new ExportService(source, worker, () => Promise.resolve(path)).run('SELECT 1', 'json', () => {})).rejects.toThrow('disk full');
    expect(await readFile(path, 'utf8')).toBe('old'); expect(await readdir(directory)).toEqual(['result', 'source.sqlite']);
    worker.exportResults.mockImplementationOnce(async (_sql, _format, temp) => {
      await writeFile(temp, 'partial'); await rm(path); await link(source, path); return { rows: '1', bytes: '7', blobs: '0' };
    });
    await expect(new ExportService(source, worker, () => Promise.resolve(path)).run('SELECT 1', 'csv', () => {})).rejects.toThrow(/source/iu);
    expect(await readFile(path, 'utf8')).toBe('original'); expect(await readdir(directory)).toEqual(['result', 'source.sqlite']);
  });
});
test('FR-014: Given a dismissed or pending Save dialog, When cancelled/disposed, Then no worker runs and late dialog approval cannot save', async () => {
  await fixture(async (directory, source) => {
    const worker = engine(); expect(await new ExportService(source, worker, () => Promise.resolve(undefined)).run('SELECT 1', 'csv', () => {})).toBeUndefined();
    let approve!: (path: string) => void;
    const service = new ExportService(source, worker, () => new Promise((resolve) => { approve = resolve; }));
    const pending = service.run('SELECT 1', 'csv', () => {}); const rejected = expect(pending).rejects.toThrow(/cancelled/u);
    service.abort(); await rejected; await service.settled(); approve(join(directory, 'late.csv')); await Promise.resolve();
    expect(worker.exportResults).not.toHaveBeenCalled(); expect(await readdir(directory)).toEqual(['source.sqlite']);
  });
});
test('FR-014: Given a worker finishing after cancellation, When cleanup completes, Then a partial file cannot replace existing output', async () => {
  await fixture(async (directory, source) => {
    const destination = join(directory, 'result'); await writeFile(destination, 'old'); const worker = engine();
    let finish!: () => void; let began!: () => void; const started = new Promise<void>((resolve) => { began = resolve; });
    worker.exportResults.mockImplementationOnce(async (_sql, _format, temp) => {
      await writeFile(temp, 'partial'); began(); await new Promise<void>((resolve) => { finish = resolve; }); return { rows: '1', bytes: '7', blobs: '0' };
    });
    const service = new ExportService(source, worker, () => Promise.resolve(destination));
    const task = service.run('SELECT 1', 'csv', () => {}); const rejected = expect(task).rejects.toThrow(/cancelled/u);
    await started; service.abort(); finish(); await rejected; await service.settled();
    expect(await readFile(destination, 'utf8')).toBe('old'); expect(await readdir(directory)).toEqual(['result', 'source.sqlite']);
  });
});
test('FR-014: Given a linked parent directory, sidecar hard link or missing source, When exporting, Then no protected output is replaced and failures are actionable', async () => {
  await fixture(async (directory, source) => {
    const parentAlias = join(directory, 'linked'); await symlink(directory, parentAlias, 'junction');
    const worker = engine();
    await expect(new ExportService(source, worker, () => Promise.resolve(join(parentAlias, 'source.sqlite'))).run('SELECT 1', 'csv', () => {})).rejects.toThrow(/source/iu);
    await writeFile(source + '-wal', 'committed WAL'); const alias = join(directory, 'wal-alias'); await link(source + '-wal', alias);
    await expect(new ExportService(source, worker, () => Promise.resolve(alias)).run('SELECT 1', 'csv', () => {})).rejects.toThrow(/sidecar/iu);
    const absent = new ExportService(join(directory, 'missing.sqlite'), worker, () => Promise.resolve(join(directory, 'output')));
    await expect(absent.run('SELECT 1', 'json', () => {})).rejects.toThrow(/available|permissions|destination/iu);
    expect(worker.exportResults).not.toHaveBeenCalled();
    await rm(parentAlias); expect(await readFile(alias, 'utf8')).toBe('committed WAL');
  });
});
