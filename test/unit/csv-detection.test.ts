import { openSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { detectedPreview } from '../../src/loaders/csv-detection';
import type { LoadOptions } from '../../src/loaders/file-loader';

vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, openSync: vi.fn(fs.openSync) };
});
let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'lv-csv-detection-')); vi.mocked(openSync).mockClear(); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

test.each(['csv', 'tsv'])('NFR-004: Given a complete one-column %s sample with no alternate delimiter, When detecting, Then one source open preserves all 100 exact preview rows', async (extension) => {
  const path = join(directory, `source.${extension}`); const payload = 'x'.repeat(4095);
  const contents = 'payload\n' + (`"${payload}"\n`).repeat(150); await writeFile(path, contents);
  const preview = detectedPreview(path, {});
  expect(preview.rows).toEqual(Array.from({ length: 100 }, () => [payload])); expect(preview.columns).toEqual(['payload']);
  expect(preview.delimiter).toBe(extension === 'tsv' ? '\t' : ','); expect(preview.reachedEnd).toBe(false);
  expect(Number(preview.bytesRead)).toBeLessThan(Buffer.byteLength(contents)); expect(preview.notice).toContain('Delimiter detected');
  expect(openSync).toHaveBeenCalledTimes(1); expect(await readFile(path, 'utf8')).toBe(contents);
});

test.each([
  { text: '', columns: [], rows: [] },
  { text: 'payload\n', columns: ['payload'], rows: [] },
  { text: 'a,b\n1,2\n', columns: ['a', 'b'], rows: [['1', '2']] },
  { text: '\ufeffvalue\r\n"line one\r\nline two"\r\n"quote""value"\r\n', columns: ['value'], rows: [['line one\r\nline two'], ['quote"value']] },
])('FR-004: Given a complete delimiter-unambiguous input $text, When detecting, Then EOF, headers and exact quoted values require only one read snapshot', async ({ text, columns, rows }) => {
  const path = join(directory, 'source.csv'); await writeFile(path, text); const result = detectedPreview(path, {});
  expect(result).toMatchObject({ columns, rows, reachedEnd: true, delimiter: ',' }); expect(openSync).toHaveBeenCalledTimes(1);
});

test.each([
  { text: '\t\nonly\n', delimiter: '\t', columns: ['column_1', 'column_2'], rows: [['only', null]] },
  { text: 'left;right\n"a,b";value\n', delimiter: ';', columns: ['left', 'right'], rows: [['a,b', 'value']] },
  { text: 'value\n"a;b"\n', delimiter: ',', columns: ['value'], rows: [['a;b']] },
])('FR-004: Given alternative delimiters in raw headers or values $text, When detecting, Then normal candidate scoring remains available', async ({ text, delimiter, columns, rows }) => {
  const path = join(directory, 'source.csv'); await writeFile(path, text);
  expect(detectedPreview(path, {})).toMatchObject({ delimiter, columns, rows }); expect(vi.mocked(openSync).mock.calls.length).toBeGreaterThan(1);
});

test.each([2_200_000, 4_300_000])('FR-004: Given a %i-character record beyond a preview budget, When detecting, Then a partial sample cannot suppress other candidates', async (size) => {
  const path = join(directory, 'source.csv'); await writeFile(path, 'value\n' + 'x'.repeat(size) + '\n');
  const result = detectedPreview(path, {}); expect(result.rows).toEqual([]); expect(result.reachedEnd).toBe(false);
  expect(result.notice).toContain('Preview limit'); expect(openSync).toHaveBeenCalledTimes(4);
});

test('FR-004: Given explicit delimiter/header-off and invalid UTF-8, When previewing, Then explicit options and visible encoding failure remain intact', async () => {
  const path = join(directory, 'source.csv'); await writeFile(path, 'left;right\n'); const options: LoadOptions = { delimiter: ';', header: false };
  expect(detectedPreview(path, options)).toMatchObject({ delimiter: ';', columns: ['column_1', 'column_2'], rows: [['left', 'right']] });
  expect(openSync).toHaveBeenCalledTimes(1); await writeFile(path, Buffer.from([97, 10, 255]));
  expect(() => detectedPreview(path, {})).toThrow(/UTF-8/);
});
