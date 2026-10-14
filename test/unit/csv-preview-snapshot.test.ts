import { closeSync, readSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readCsvPreview } from '../../src/loaders/csv-preview-reader';

const fault = vi.hoisted(() => ({ kind: undefined as 'replace' | 'delete' | undefined }));
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  const reads = vi.fn(fs.readSync);
  return { ...fs, readSync: reads, closeSync: vi.fn(fs.closeSync),
    statSync(path: import('node:fs').PathLike, options: { bigint: true }) {
      // Reproduce an external change at the post-read pathname check while
      // exercising real descriptors, reads and metadata on disposable files.
      if (reads.mock.calls.length > 0 && fault.kind !== undefined) {
        if (fault.kind === 'replace') { fs.writeFileSync(path, 'value\nchanged\n'); }
        else { fs.unlinkSync(path); }
        fault.kind = undefined;
      }
      return fs.statSync(path, options);
    } };
});
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'lite-voyager-preview-snapshot-'));
  fault.kind = undefined; vi.mocked(readSync).mockClear(); vi.mocked(closeSync).mockClear();
});
afterEach(async () => { fault.kind = undefined; await rm(directory, { recursive: true, force: true }); });
test.each(['replace', 'delete'] as const)('FR-004: Given a file that is externally %s during preview, When returning rows, Then stale data is rejected and the source handle closes', async (kind) => {
  const path = join(directory, 'input.csv'); await writeFile(path, 'value\noriginal\n'); fault.kind = kind;
  expect(() => readCsvPreview(path)).toThrow(kind === 'replace' ? /changed/i : /ENOENT/i);
  expect(closeSync).toHaveBeenCalledTimes(1);
});
