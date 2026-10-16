import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

test.each(['json', 'jsonl'])('NFR-003: Given populated %s stress data, When generating, Then every record and reported byte/hash count is real and existing files survive', async (format) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-json-fixture-')); const path = join(directory, `input.${format}`);
  try {
    const args = [resolve('scripts/json-memory-fixture.mts'), path, '100000', format];
    const result = await promisify(execFile)(process.execPath, args); expect(result.stderr).toBe(''); const report: unknown = JSON.parse(result.stdout);
    const bytes = await readFile(path); const text = bytes.toString('utf8'); const data: unknown = format === 'json' ? JSON.parse(text) : text.trimEnd().split('\n').map((line) => JSON.parse(line) as unknown);
    expect(Array.isArray(data)).toBe(true); if (!Array.isArray(data)) { throw new Error('Missing records'); }
    expect(data.every((record: unknown) => typeof record === 'object' && record !== null && 'payload' in record && record.payload === 'x'.repeat(4095))).toBe(true);
    expect(bytes.length).toBeGreaterThanOrEqual(100000); expect(report).toMatchObject({ bytes: bytes.length, rows: data.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    await expect(promisify(execFile)(process.execPath, args)).rejects.toThrow(); expect(await readFile(path)).toEqual(bytes);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
