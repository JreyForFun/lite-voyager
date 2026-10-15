import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';

test('NFR-003: Given a small fixture request, When generating populated CSV chunks, Then every record is real and the reported size/hash match physical bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-csv-memory-fixture-')); const path = join(directory, 'fixture.csv');
  try {
    const result = await promisify(execFile)(process.execPath, [resolve('scripts/csv-memory-fixture.mts'), path, '100000']);
    expect(result.stderr).toBe(''); const report: unknown = JSON.parse(result.stdout);
    const data = await readFile(path); const lines = data.toString('utf8').split('\n');
    expect(data.length).toBeGreaterThanOrEqual(100000); expect(lines[0]).toBe('payload'); expect(lines.at(-1)).toBe('');
    expect(lines.slice(1, -1).every((line) => line === 'x'.repeat(4095))).toBe(true);
    expect(report).toMatchObject({ bytes: (await stat(path)).size, rows: lines.length - 2, sha256: createHash('sha256').update(data).digest('hex') });
    await expect(promisify(execFile)(process.execPath, [resolve('scripts/csv-memory-fixture.mts'), path, '100000'])).rejects.toThrow();
    expect(await readFile(path)).toEqual(data);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
