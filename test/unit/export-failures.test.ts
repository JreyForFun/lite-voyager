import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { ExportService } from '../../src/editor/export-service';
import type { Engine } from '../../src/engine/engine';

vi.mock('node:fs/promises', async (importOriginal) => {
  const files = await importOriginal<typeof import('node:fs/promises')>();
  return { ...files, rename: vi.fn(files.rename), rm: vi.fn(files.rm) };
});
test('FR-014: Given atomic rename failure, When committing export, Then existing output survives and a clear retry instruction is returned', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t015-rename-'));
  try {
    const source = join(directory, 'source'); const destination = join(directory, 'output');
    await writeFile(source, 'original'); await writeFile(destination, 'old');
    const engine: Pick<Engine, 'exportResults'> = { exportResults: async (_sql, _format, path) => {
      await writeFile(path, 'complete'); return { rows: '1', bytes: '8', blobs: '0' };
    } };
    vi.mocked(rename).mockRejectedValueOnce(new Error('file busy'));
    await expect(new ExportService(source, engine, () => Promise.resolve(destination)).run('SELECT 1', 'csv', () => {})).rejects.toThrow(/Close programs|permissions/u);
    expect(await readFile(destination, 'utf8')).toBe('old'); expect(await readFile(source, 'utf8')).toBe('original');
    expect(await readdir(directory)).toEqual(['output', 'source']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('FR-014: Given cancelled export with cleanup failure, When awaiting recovery cleanup, Then the cleanup problem remains visible instead of being swallowed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t015-cleanup-'));
  try {
    const source = join(directory, 'source'); const destination = join(directory, 'output');
    await writeFile(source, 'original'); await writeFile(destination, 'old');
    const service = new ExportService(source, { exportResults: () => Promise.reject(new Error('cancelled')) }, () => Promise.resolve(destination));
    vi.mocked(rm).mockRejectedValueOnce(new Error('permission denied'));
    await expect(service.run('SELECT 1', 'csv', () => {})).rejects.toThrow(/temporary files could not be removed/u);
    await expect(service.settled()).rejects.toThrow(/temporary files could not be removed/u);
    expect(await readFile(destination, 'utf8')).toBe('old'); expect(await readFile(source, 'utf8')).toBe('original');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
