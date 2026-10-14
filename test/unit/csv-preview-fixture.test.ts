import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { createSparseCsv } from '../../src/test/csv-preview-fixture';

test('NFR-004: Given a disposable CSV prefix, When its logical length grows, Then the fixture is genuinely sparse and preserves its prefix', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-sparse-regression-'));
  const path = join(directory, 'source.csv'); const contents = 'id,name\n1,exact\n';
  try {
    await createSparseCsv(path, contents, 16 * 1024 * 1024);
    const metadata = await stat(path, { bigint: true }); expect(metadata.size).toBe(16n * 1024n * 1024n);
    const file = await readFile(path); expect(file.subarray(0, Buffer.byteLength(contents)).toString()).toBe(contents);
    if (process.platform === 'win32') {
      // The .NET sparse attribute is locale-independent. Pass the path through
      // a temporary script argument rather than interpolating it into code.
      const script = join(directory, 'sparse-attribute.ps1');
      await writeFile(script, 'param([string]$Path)\n[System.IO.File]::GetAttributes($Path).HasFlag([System.IO.FileAttributes]::SparseFile)\n');
      const output = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script, path], { windowsHide: true });
      expect(output.stderr).toBe(''); expect(output.stdout.trim()).toBe('True');
    } else { expect(metadata.blocks * 512n).toBeLessThan(metadata.size); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
