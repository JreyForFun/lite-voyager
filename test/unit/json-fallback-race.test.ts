import { mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import * as adapter from '../../src/loaders/csv-import';
import { importJson } from '../../src/loaders/json-import';

test('FR-005: Given a source grown during fallback initialization, When streaming begins, Then the source cap is rechecked before reading any complete data', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lv-json-race-')); const source = join(directory, 'source.json'); writeFileSync(source, '[]');
  const original = adapter.openImportDatabase;
  const open = vi.spyOn(adapter, 'openImportDatabase').mockImplementation(async (job) => {
    const result = await original(job); truncateSync(source, 20_000_001); return result;
  });
  try { await expect(importJson({ source, path: join(directory, 'output.sqlite'), directory: resolve('dist'), engine: 'sql.js', format: 'json', options: {} }, () => {})).rejects.toThrow(/Memory-limited.*20,000,000/); }
  finally { open.mockRestore(); rmSync(directory, { recursive: true, force: true }); }
});
