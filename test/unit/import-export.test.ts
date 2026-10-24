import { link, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { ExportService } from '../../src/editor/export-service';
import { captureOriginalSource } from '../../src/editor/sqlite-save';
import type { Engine } from '../../src/engine/engine';

test.each(['original', 'renamed', 'alias', 'sidecar', 'sidecar alias', 'late alias', 'unrelated'])(
  'NFR-001: Given an imported source snapshot and %s destination, When exporting, Then original bytes and aliases stay protected through publication while unrelated output succeeds', async (kind) => {
    const root = await mkdtemp(join(tmpdir(), 'lv-import-export-'));
    const source = join(root, 'private.sqlite'); const original = join(root, 'source.csv'); const moved = join(root, 'moved.csv'); const alias = join(root, 'alias.csv');
    await writeFile(source, 'database'); await writeFile(original, 'all original rows'); const snapshot = await captureOriginalSource(original);
    await writeFile(original + '-wal', 'sidecar'); await link(original + '-wal', alias);
    let destination = kind === 'original' ? original : kind === 'sidecar' ? original + '-wal' : kind === 'sidecar alias' ? alias : join(root, 'result.csv');
    if (kind === 'renamed' || kind === 'alias') {
      await rm(alias); await rename(original, moved); await link(moved, alias); destination = kind === 'renamed' ? moved : alias;
    } else if (kind === 'unrelated') { await rename(original, moved); }
    const worker = { exportResults: vi.fn<Engine['exportResults']>(async (_sql, _format, temporary) => {
      await writeFile(temporary, 'query result');
      if (kind === 'late alias') { await link(original, destination); }
      return { rows: '1', bytes: '12', blobs: '0' };
    }) };
    try {
      const service = new ExportService(source, worker, () => Promise.resolve(destination), { path: original, snapshot });
      if (kind === 'unrelated') {
        await expect(service.run('SELECT 1', 'csv', () => {})).resolves.toMatchObject({ rows: '1' });
        expect(await readFile(destination, 'utf8')).toBe('query result');
      } else {
        await expect(service.run('SELECT 1', 'csv', () => {})).rejects.toThrow(/source|sidecar/iu);
        if (kind !== 'late alias') { expect(worker.exportResults).not.toHaveBeenCalled(); }
      }
      expect(await readFile(kind === 'renamed' || kind === 'alias' || kind === 'unrelated' ? moved : original, 'utf8')).toBe('all original rows');
      expect(await readFile(source, 'utf8')).toBe('database'); expect((await readdir(root)).some((name) => name.startsWith('.lite-voyager-export-'))).toBe(false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
