import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { readCsvPreview } from '../../src/loaders/csv-preview-reader';
import { streamRecords } from '../../src/loaders/csv-records';

const contents = '\ufeffa,b\n\ufefffirst,\ufeffsecond\nnormal,\ufeffthird\n';
const rows = [['\ufefffirst', '\ufeffsecond'], ['normal', '\ufeffthird']];
test.each([1, 2, 65536])('FR-004: Given a file BOM and data BOMs with %i-byte preview reads, When previewing, Then only the file-start BOM is removed', async (chunk) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-bom-preview-')); const path = join(directory, 'source.csv');
  try {
    await writeFile(path, contents); expect(readCsvPreview(path, {}, chunk).rows).toEqual(rows);
    expect(await readFile(path, 'utf8')).toBe(contents);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('FR-004: Given BOM characters at record and field starts, When streaming full import records, Then all data BOMs remain exact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-bom-import-')); const path = join(directory, 'source.csv');
  try {
    await writeFile(path, contents); const records: string[][] = [];
    streamRecords(path, ',', (row) => { records.push(row); }, () => {});
    expect(records).toEqual([['a', 'b'], ...rows]); expect(await readFile(path, 'utf8')).toBe(contents);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
