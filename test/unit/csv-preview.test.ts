import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, open, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { CsvPreviewLoader } from '../../src/loaders/csv-loader';
import { readCsvPreview } from '../../src/loaders/csv-preview-reader';
import { createSparseCsv } from '../../src/test/csv-preview-fixture';
import { MAX_PREVIEW_CHARACTERS, MAX_PREVIEW_RECORD_CHARACTERS } from '../../src/protocol';

let directory: string;
let sequence = 0;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'lite-voyager-preview-'));
  const result = await build({ entryPoints: [resolve('src/worker/csv-preview-worker.ts')], outfile: join(directory, 'csv-preview-worker.js'), bundle: true, platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent' });
  expect(result.warnings).toEqual([]);
});
afterAll(async () => { if (directory !== undefined) { await rm(directory, { recursive: true, force: true }); } });
async function source(contents: string | Buffer, extension = 'csv'): Promise<string> {
  const path = join(directory, `source-${String(sequence++)}.${extension}`);
  await writeFile(path, contents);
  return path;
}
const loader = (): CsvPreviewLoader => new CsvPreviewLoader(directory);

test('FR-004: Given a nonregular CSV source without a producer, When previewed, Then it rejects promptly and its worker exits without waiting for external input', async () => {
  const path = join(directory, `nonregular-${String(sequence++)}.csv`);
  // Windows has no POSIX FIFO. Exercise the same regular-file requirement
  // using a directory there; POSIX hosts also reproduce the blocking open.
  if (process.platform === 'win32') { await mkdir(path); }
  else { await promisify(execFile)('mkfifo', [path]); }
  const pending = loader().preview(path).then(() => undefined, (error: unknown) => error);
  const deadline = new AbortController();
  let expired = false;
  try {
    const result = await Promise.race([
      pending,
      delay(1000, undefined, { signal: deadline.signal }).then(() => { expired = true; return undefined; }),
    ]);
    expect(expired).toBe(false);
    expect(result).toBeInstanceOf(Error);
    expect(result instanceof Error ? result.message : '').toMatch(/regular local CSV/i);
  } finally {
    deadline.abort();
    // Unblock a regressed POSIX reader so a failing test leaves no worker.
    if (expired && process.platform !== 'win32') { const producer = await open(path, 'r+'); await producer.close(); }
    await pending;
  }
});

test.each(['direct', 'directory alias'] as const)('FR-004: Given a regular source replaced by a nonregular file between stat and open using a %s path, When previewed, Then descriptor validation rejects it without a blocking open', async (pathKind) => {
  const path = await source('value\noriginal\n');
  let inputPath = path;
  if (pathKind === 'directory alias') {
    const alias = join(directory, `alias-${String(sequence++)}`);
    await symlink(dirname(path), alias, process.platform === 'win32' ? 'junction' : 'dir');
    inputPath = join(alias, basename(path));
  }
  const raceDirectory = join(directory, `race-${String(sequence++)}`); await mkdir(raceDirectory);
  const result = await build({ entryPoints: [resolve('src/worker/csv-preview-worker.ts')], outfile: join(raceDirectory, 'csv-preview-worker.js'),
    bundle: true, platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent', banner: { js: `
const raceFs = require('node:fs');
// The reader stats its canonical path; macOS temp paths and directory aliases
// need the same resolution so the injected replacement actually occurs.
const racePath = raceFs.realpathSync(require('node:worker_threads').workerData.path);
const raceStat = raceFs.statSync;
let raceChanged = false;
raceFs.statSync = (...args) => {
  const result = raceStat(...args);
  if (!raceChanged && args[0] === racePath) {
    raceChanged = true; raceFs.unlinkSync(racePath);
    if (process.platform === 'win32') raceFs.mkdirSync(racePath);
    else require('node:child_process').execFileSync('mkfifo', [racePath]);
  }
  return result;
};
` } });
  expect(result.warnings).toEqual([]);
  const pending = new CsvPreviewLoader(raceDirectory).preview(inputPath).then(() => undefined, (error: unknown) => error);
  const deadline = new AbortController(); let expired = false;
  try {
    const error = await Promise.race([pending, delay(1000, undefined, { signal: deadline.signal }).then(() => { expired = true; return undefined; })]);
    expect(expired).toBe(false); expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').toMatch(/regular local CSV/i);
    expect((await stat(path)).isFile()).toBe(false);
  } finally {
    deadline.abort();
    if (expired && process.platform !== 'win32') { const producer = await open(path, 'r+'); await producer.close(); }
    await pending;
  }
});

test('FR-004: Given BOM, quoted multiline records and exact numbers, When previewed in a real worker, Then text is exact and the source is unchanged', async () => {
  const contents = '\ufeffselect,"quote""name",value\r\n9007199254740993,"two\r\nlines",\r\n-9223372036854775808,"😀 comma, quote """,NULL\r\n1e-300,2026-10-14T08:00:00+08:00,001\r\n';
  const path = await source(contents);
  const before = createHash('sha256').update(await readFile(path)).digest('hex');
  const result = await loader().preview(path);
  expect(result.columns).toEqual(['select', 'quote"name', 'value']);
  expect(result.rows).toEqual([
    ['9007199254740993', 'two\r\nlines', ''],
    ['-9223372036854775808', '😀 comma, quote "', 'NULL'],
    ['1e-300', '2026-10-14T08:00:00+08:00', '001'],
  ]);
  expect(result.reachedEnd).toBe(true);
  expect(result.threadId).toBeGreaterThan(0);
  expect(createHash('sha256').update(await readFile(path)).digest('hex')).toBe(before);
});

test('NFR-003: Given a sparse 3 GB CSV, When previewed, Then only the start is read and at most 100 complete rows are returned', async () => {
  const path = join(directory, `source-${String(sequence++)}.csv`);
  await createSparseCsv(path, `id,name\n${Array.from({ length: 101 }, (_, index) => `${String(index)},name`).join('\n')}\n`, 3_000_000_000);
  const result = await loader().preview(path);
  expect(result.rows).toHaveLength(100);
  expect(result.rows[99]).toEqual(['99', 'name']);
  expect(result.totalBytes).toBe('3000000000');
  expect(BigInt(result.bytesRead)).toBeLessThanOrEqual(65_536n);
  expect(result.reachedEnd).toBe(false);
  expect(result.notice).toMatch(/100|first/i);
});

test.each([1, 2, 7, 65_536])('FR-004: Given invalid UTF-8 after the first 100 complete rows, When reads use %i bytes, Then unscanned bytes cannot reject the exact preview', async (chunkBytes) => {
  const contents = Buffer.concat([Buffer.from(`value\n${'ok\n'.repeat(100)}`), Buffer.from([0xff])]);
  const path = await source(contents);
  const result = readCsvPreview(path, {}, chunkBytes);
  expect(result.rows).toEqual(Array.from({ length: 100 }, () => ['ok']));
  expect(result.reachedEnd).toBe(false);
  expect(result.notice).toMatch(/rest.*not been validated/i);
  expect(await readFile(path)).toEqual(contents);
});

test.each(['payload', 'columns', 'record'] as const)('FR-004: Given invalid UTF-8 after the %s preview limit, When previewing, Then only prior complete values survive and the unscanned tail is ignored', async (limit) => {
  const cell = 'x'.repeat(Math.floor(MAX_PREVIEW_CHARACTERS / 2));
  const prefix = limit === 'payload' ? `value\n${cell}\n${cell}\n`
    : limit === 'columns' ? `${Array.from({ length: 1001 }, (_, index) => `c${String(index)}`).join(',')}\n`
      : `value\n${'x'.repeat(MAX_PREVIEW_RECORD_CHARACTERS + 2)}`;
  const result = readCsvPreview(await source(Buffer.concat([Buffer.from(prefix), Buffer.from([0xff])])));
  expect(result.rows).toEqual(limit === 'payload' ? [[cell]] : []);
  expect(result.reachedEnd).toBe(false);
  expect(result.notice).toMatch(/preview.*limit/i);
  expect(result.notice).toMatch(/not truncated/i);
});

test('FR-004: Given invalid UTF-8 within the 100th data row, When previewing, Then the sampled corruption still fails clearly', async () => {
  const contents = Buffer.concat([Buffer.from(`value\n${'ok\n'.repeat(99)}`), Buffer.from([0xff]), Buffer.from('\n')]);
  await expect(loader().preview(await source(contents))).rejects.toThrow(/valid UTF-8/i);
});

test('FR-004: Given a split astral code point that crosses the raw record limit, When invalid UTF-8 follows it, Then the limit stops before validating that tail', async () => {
  // The six-byte header plus these extra UTF-8 bytes places the four-byte
  // code point across a 64 KiB boundary, with three bytes in the first read.
  const prefix = 'é'.repeat(65_536 - 8);
  const contents = Buffer.concat([
    Buffer.from(`value\n${prefix}${'x'.repeat(MAX_PREVIEW_RECORD_CHARACTERS - 1 - prefix.length)}😀`),
    Buffer.from([0xff]),
  ]);
  const result = readCsvPreview(await source(contents));
  expect(result.rows).toEqual([]);
  expect(result.reachedEnd).toBe(false);
  expect(result.notice).toMatch(/preview.*limit/i);
  expect(result.notice).toMatch(/not truncated/i);
});

test.each([1, 2, 7, 65_536])('FR-004: Given split UTF-8, BOM, CRLF and escaped quotes, When reads use %i bytes, Then all complete records match', async (chunkBytes) => {
  const path = await source('\ufeff"é","b"\r\n"😀\r\nline","x""y"\r\n"last",""');
  expect(readCsvPreview(path, {}, chunkBytes).rows).toEqual([['😀\r\nline', 'x"y'], ['last', '']]);
});

test.each(['', '\ufeff', 'a,b\n', 'a,b'])('FR-004: Given an empty or header-only file %j, When previewed, Then no data row is invented', async (contents) => {
  const result = await loader().preview(await source(contents));
  expect(result.rows).toEqual([]);
  expect(result.columns).toEqual(contents.includes('a,b') ? ['a', 'b'] : []);
  expect(result.reachedEnd).toBe(true);
});

test('FR-004: Given duplicate/blank headers and ragged records, When previewed, Then all fields remain addressable with an explanation', async () => {
  const result = await loader().preview(await source('a,,A,column_2\n1,,NULL\n2,three,four,five,extra\n\n'));
  expect(new Set(result.columns.map((name) => name.toLowerCase())).size).toBe(5);
  expect(result.rows).toEqual([['1', '', 'NULL', null, null], ['2', 'three', 'four', 'five', 'extra'], ['', null, null, null, null]]);
  expect(result.notice).toMatch(/header/i);
  expect(result.notice).toMatch(/missing/i);
});

test('FR-004: Given TSV or explicit delimiter/header options, When previewed, Then the first data record and significant whitespace are preserved', async () => {
  expect((await loader().preview(await source('a\tb\n1\t2\n', 'tsv'))).rows).toEqual([['1', '2']]);
  const result = await loader().preview(await source('001; hello \n2;world\n'), { delimiter: ';', header: false });
  expect(result.columns).toEqual(['column_1', 'column_2']);
  expect(result.rows).toEqual([['001', ' hello '], ['2', 'world']]);
});

test('FR-004: Given a cell larger than 1 MB and 1000 columns, When previewed, Then complete values remain available', async () => {
  const cell = 'x'.repeat(1_048_577);
  expect((await loader().preview(await source(`value\n${cell}\n`))).rows).toEqual([[cell]]);
  const names = Array.from({ length: 1000 }, (_, index) => `c${String(index)}`);
  const result = await loader().preview(await source(`${names.join(',')}\n${names.join(',')}\n`));
  expect(result.columns).toEqual(names);
  expect(result.rows).toEqual([names]);
});

test('FR-004: Given an oversized record, When previewed, Then it stops with an explicit preview limit instead of sending a truncated cell', async () => {
  // Exceed the budget by more than one read chunk so early-stop I/O is
  // measurable even when the reader has already fetched the current chunk.
  const path = await source(`value\n${'x'.repeat(MAX_PREVIEW_RECORD_CHARACTERS * 2)}\n`);
  const result = await loader().preview(path);
  expect(result.rows).toEqual([]);
  expect(result.reachedEnd).toBe(false);
  expect(result.notice).toMatch(/preview.*limit/i);
  expect(result.notice).toMatch(/not truncated/i);
  expect(BigInt(result.bytesRead)).toBeLessThan(BigInt((await readFile(path)).length));
});

test('FR-004: Given several large records, When the preview payload budget is reached, Then only whole rows fit and the limit is explained', async () => {
  const cell = 'x'.repeat(Math.floor(MAX_PREVIEW_CHARACTERS / 2));
  const result = await loader().preview(await source(`value\n${cell}\n${cell}\n${cell}\n`));
  expect(result.rows).toEqual([[cell]]);
  expect(result.notice).toMatch(/preview.*limit/i);
  expect(result.reachedEnd).toBe(false);
});

test.each([
  ['a,b\n"unclosed,b', /quote|malformed/i],
  ['a,b\n"foo" ,bar\n', /quote|malformed/i],
  ['a\nx\u0000y\n', /binary|NUL/i],
  [Buffer.from([0x61, 0x0a, 0xff]), /UTF-8|encoding/i],
  [Buffer.from([0x61, 0x0a, 0xc3]), /UTF-8|encoding/i],
] as const)('FR-004: Given malformed or binary input %j, When previewed, Then the error explains the failure without altering the source', async (contents, message) => {
  const path = await source(contents);
  const before = await readFile(path);
  await expect(loader().preview(path)).rejects.toThrow(message);
  expect(await readFile(path)).toEqual(before);
});

test('FR-004: Given a cancelled preview or missing file, When opening, Then it settles with actionable errors and can be reopened', async () => {
  const path = await source('a\n1\n');
  const controller = new AbortController(); controller.abort();
  await expect(loader().preview(path, {}, controller.signal)).rejects.toThrow(/cancel/i);
  const running = new AbortController();
  const pending = loader().preview(path, {}, running.signal); running.abort();
  await expect(pending).rejects.toThrow(/cancel/i);
  await expect(loader().preview(join(directory, 'missing.csv'))).rejects.toThrow(/open|exist|missing/i);
  await expect(loader().preview(join(directory, 'missing.csv'))).rejects.toThrow('Choose an existing local file');
  await expect(loader().preview(directory)).rejects.toThrow(/regular.*file/i);
  expect((await loader().preview(path)).rows).toEqual([['1']]);
});

test.each(['crash', 'invalid'])('FR-004: Given a %s worker, When previewed, Then the error is actionable and termination settles even if the worker keeps running', async (fault) => {
  const broken = join(directory, `broken-${fault}`);
  const { mkdir } = await import('node:fs/promises'); await mkdir(broken);
  await writeFile(join(broken, 'csv-preview-worker.js'), fault === 'crash' ? 'throw new Error("private source text");'
    : 'require("node:worker_threads").parentPort.postMessage({type:"csvPreviewResult",result:{rows:[]}}); setInterval(() => {}, 10000);');
  const path = await source('value\n1\n');
  await expect(new CsvPreviewLoader(broken).preview(path)).rejects.toThrow(/worker|preview/i);
  await expect(new CsvPreviewLoader(broken).preview(path)).rejects.not.toThrow(/private source text/i);
  expect((await loader().preview(path)).rows).toEqual([['1']]);
});

test('FR-004: Given a bare CR at the last preview row, When the sample fills, Then the incomplete record ending is still rejected', async () => {
  const path = await source(`value\n${'x\n'.repeat(99)}last\rBAD`);
  await expect(loader().preview(path)).rejects.toThrow(/bare CR/i);
});

test('FR-004: Given 1001 columns, When previewed, Then column limits are explained without dropping individual fields', async () => {
  const names = Array.from({ length: 1001 }, (_, index) => `c${String(index)}`);
  const result = await loader().preview(await source(`${names.join(',')}\n${names.join(',')}\n`));
  expect(result.columns).toEqual([]); expect(result.rows).toEqual([]);
  expect(result.notice).toMatch(/preview.*limit/i); expect(result.reachedEnd).toBe(false);
});
