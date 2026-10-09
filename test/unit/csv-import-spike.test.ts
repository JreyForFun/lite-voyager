import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';
import { runCsvImportSpike } from '../../scripts/csv-import-spike.mts';

const execute = promisify(execFile);
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
async function setup(contents: string | Buffer): Promise<{ input: string; output: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-import-test-'));
  directories.push(directory);
  const input = join(directory, 'input.csv');
  await writeFile(input, contents);
  return { input, output: join(directory, 'result') };
}
function stored(output: string): Record<string, unknown>[] {
  const db = new DatabaseSync(join(output, 'import.sqlite'), { readOnly: true });
  try {
    const columns = db.prepare('PRAGMA table_info("records")').all();
    const quoted = (name: unknown): string => {
      if (typeof name !== 'string') { throw new Error('Missing SQLite column name.'); }
      return `"${name.replaceAll('"', '""')}"`;
    };
    const data = columns.filter((column) => column.pk === 0).map((column) => quoted(column.name));
    const key = columns.find((column) => column.pk === 1)?.name ?? 'rowid';
    return db.prepare(`SELECT ${data.join(',')} FROM "records" ORDER BY ${quoted(key)}`).all();
  }
  finally { db.close(); }
}

test('FR-004: Given BOM/CRLF, multiline quotes and exact numbers, When streamed in tiny chunks, Then every text value and source byte is preserved', async () => {
  const contents = '\ufeff"select","quote""name",emoji,value\r\n9007199254740993,"two\r\nlines",😀,\r\n9223372036854775807,"a ""quote""",é,NULL\r\n-9223372036854775808,"comma, value",終,1e-300\r\n';
  const paths = await setup(contents);
  const report = await runCsvImportSpike({ ...paths, batchRows: 2, chunkBytes: 7 });
  expect(stored(paths.output)).toEqual([
    { select: '9007199254740993', 'quote"name': 'two\r\nlines', emoji: '😀', value: '' },
    { select: '9223372036854775807', 'quote"name': 'a "quote"', emoji: 'é', value: 'NULL' },
    { select: '-9223372036854775808', 'quote"name': 'comma, value', emoji: '終', value: '1e-300' },
  ]);
  expect(report.rows).toBe(3);
  expect(report.transactions).toBe(2);
  expect(report.verifiedRows).toBe(3);
  expect(report.sourceSha256Before).toBe(report.sourceSha256After);
  expect(report.parsedValuesSha256).toBe(report.storedValuesSha256);
  expect(await readFile(paths.input, 'utf8')).toBe(contents);
});

test('FR-004: Given a header-only CSV, When imported, Then an empty table is verified and no data-preview latency is invented', async () => {
  const paths = await setup('id,name\n');
  const report = await runCsvImportSpike(paths);
  expect(stored(paths.output)).toEqual([]);
  expect(report.rows).toBe(0);
  expect(report.transactions).toBe(0);
  expect(report.previewRows).toBe(0);
  expect(report.previewParseMs).toBeNull();
});

test('FR-004: Given a single quoted empty field, When imported, Then it remains an empty string rather than a skipped blank record', async () => {
  const paths = await setup('value\n""\nNULL\n');
  await runCsvImportSpike({ ...paths, chunkBytes: 1 });
  expect(stored(paths.output)).toEqual([{ value: '' }, { value: 'NULL' }]);
});

test('FR-004: Given a header spanning the first chunk with embedded LF, When CRLF records are imported, Then line-ending detection preserves exact fields', async () => {
  const name = `start\n${'x'.repeat(70_000)}`;
  const paths = await setup(`"${name}",id\r\nexact,9007199254740993\r\n`);
  await runCsvImportSpike({ ...paths, chunkBytes: 7 });
  expect(stored(paths.output)).toEqual([{ [name]: 'exact', id: '9007199254740993' }]);
});

test('NFR-001: Given a source changed after import, When verified, Then the untrustworthy database is removed', async () => {
  const paths = await setup('id\n1\n');
  await expect(runCsvImportSpike(paths, {
    onProgress: (progress) => {
      if (progress.phase === 'verify') { writeFileSync(paths.input, 'id\n2\n'); }
    },
  })).rejects.toThrow('source changed');
  await expect(stat(paths.output)).rejects.toMatchObject({ code: 'ENOENT' });
});

test.each([
  ['', 'empty'],
  ['id,name\n1,"unfinished', 'CSV'],
  ['a,b,c\n1,2\n', 'fields'],
  ['a,b\n1,2,3\n', 'fields'],
  ['id,id\n1,2\n', 'header'],
  ['id,ID\n1,2\n', 'header'],
  ['id,\n1,2\n', 'header'],
  ['id\n\n', 'blank'],
  [Buffer.from([105, 100, 10, 0xff, 10]), 'UTF-8'],
  ['id\n\u0000\n', 'NUL'],
  ['id,name\n1,two\r\n', 'mixed'],
  ['id,name\r1,two\r', 'bare CR'],
])('FR-004: Given invalid CSV %j, When imported, Then it fails clearly and removes partial output', async (contents, message) => {
  const paths = await setup(contents);
  const before = await readFile(paths.input);
  await expect(runCsvImportSpike({ ...paths, chunkBytes: 3 })).rejects.toThrow(message);
  await expect(stat(paths.output)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readFile(paths.input)).toEqual(before);
});

test('FR-004: Given a cell over 1 MB and a 1000-column table, When streamed, Then no field is truncated or omitted', async () => {
  const cell = 'x'.repeat(1_048_577);
  const paths = await setup(`value\n${cell}\n`);
  const report = await runCsvImportSpike({ ...paths, chunkBytes: 65_536 });
  expect(stored(paths.output)).toEqual([{ value: cell }]);
  expect(report.verifiedRows).toBe(1);
  const names = Array.from({ length: 1000 }, (_, index) => `c${String(index)}`);
  const wide = await setup(`${names.join(',')}\n${names.join(',')}\n`);
  await runCsvImportSpike(wide);
  expect(stored(wide.output)).toEqual([Object.fromEntries(names.map((name) => [name, name]))]);
});

test('FR-004: Given a bad header before a large unread tail, When rejected, Then input handles close and partial output is removed', async () => {
  const paths = await setup(`id,id\n${'1,2\n'.repeat(100_000)}`);
  await expect(runCsvImportSpike(paths)).rejects.toThrow('header');
  await expect(stat(paths.output)).rejects.toMatchObject({ code: 'ENOENT' });
  await rm(paths.input);
  await writeFile(paths.input, 'id\n1\n');
  expect((await runCsvImportSpike(paths)).verifiedRows).toBe(1);
});

test('FR-004: Given SQL syntax in headers and values, When imported, Then quoted identifiers and bound values preserve it literally', async () => {
  const name = 'select"; DROP TABLE records; --';
  const value = "'); DROP TABLE records; --";
  const paths = await setup(`"${name.replaceAll('"', '""')}"\n${value}\n`);
  await runCsvImportSpike(paths);
  expect(stored(paths.output)).toEqual([{ [name]: value }]);
});

test('FR-004: Given headers shadowing all SQLite rowid aliases and the proposed metadata name, When imported, Then original record order and text fields survive', async () => {
  const paths = await setup('rowid,_rowid_,oid,__lite_voyager_row\nz,2,3,first\na,4,5,second\n');
  const report = await runCsvImportSpike(paths);
  expect(report.verifiedRows).toBe(2);
  expect(stored(paths.output)).toEqual([
    { rowid: 'z', _rowid_: '2', oid: '3', __lite_voyager_row: 'first' },
    { rowid: 'a', _rowid_: '4', oid: '5', __lite_voyager_row: 'second' },
  ]);
});

test('NFR-001: Given an existing destination or the input itself, When requested, Then existing bytes are never replaced', async () => {
  const paths = await setup('id\n1\n');
  await writeFile(paths.output, 'preserve me');
  await expect(runCsvImportSpike(paths)).rejects.toThrow('already exists');
  expect(await readFile(paths.output, 'utf8')).toBe('preserve me');
  await expect(runCsvImportSpike({ input: paths.input, output: paths.input })).rejects.toThrow('already exists');
  expect(await readFile(paths.input, 'utf8')).toBe('id\n1\n');
});

test('NFR-001: Given a read-only source, When imported, Then reading succeeds and source bytes stay unchanged', async () => {
  const paths = await setup('id\n9007199254740993\n');
  await chmod(paths.input, 0o444);
  try {
    expect((await runCsvImportSpike(paths)).verifiedRows).toBe(1);
    expect(await readFile(paths.input, 'utf8')).toBe('id\n9007199254740993\n');
  } finally { await chmod(paths.input, 0o666); }
});

test('NFR-001: Given an unrelated file in reserved output, When import fails, Then partial SQLite cleanup preserves the unrelated file', async () => {
  const paths = await setup('id\n1\n');
  await expect(runCsvImportSpike(paths, {
    onProgress: (progress) => {
      if (progress.phase === 'verify') {
        writeFileSync(join(paths.output, 'owner.txt'), 'preserve me');
        throw new Error('Stop this import.');
      }
    },
  })).rejects.toThrow('cleanup failed');
  expect(await readFile(join(paths.output, 'owner.txt'), 'utf8')).toBe('preserve me');
  await expect(stat(join(paths.output, 'import.sqlite'))).rejects.toMatchObject({ code: 'ENOENT' });
});

test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('FR-004: Given invalid batch size %s, When requested, Then it rejects before creating output', async (batchRows) => {
  const paths = await setup('id\n1\n');
  await expect(runCsvImportSpike({ ...paths, batchRows })).rejects.toThrow('positive safe integer');
  await expect(stat(paths.output)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('FR-004: Given cancellation after import progress, When cancelled, Then the worker exits and partial output is removed', async () => {
  const paths = await setup(`id,payload\n${'1,xxxxxxxxxxxxxxxx\n'.repeat(100_000)}`);
  const controller = new AbortController();
  await expect(runCsvImportSpike(paths, {
    signal: controller.signal,
    onProgress: () => controller.abort(),
  })).rejects.toThrow('cancelled');
  await expect(stat(paths.output)).rejects.toMatchObject({ code: 'ENOENT' });
  expect((await stat(paths.input)).size).toBeGreaterThan(0);
});

test('FR-004: Given a missing input, When requested, Then it fails without leaving output', async () => {
  const paths = await setup('id\n1\n');
  await rm(paths.input);
  await expect(runCsvImportSpike(paths)).rejects.toThrow();
  await expect(stat(paths.output)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('FR-004: Given a progress consumer failure, When the worker is stopped, Then cleanup permits a fresh retry', async () => {
  const paths = await setup('id\n1\n');
  await expect(runCsvImportSpike(paths, { onProgress: () => { throw new Error('Consumer failed.'); } }))
    .rejects.toThrow('Consumer failed');
  await expect(stat(paths.output)).rejects.toMatchObject({ code: 'ENOENT' });
  const report = await runCsvImportSpike(paths);
  expect(report.verifiedRows).toBe(1);
});

test('NFR-005: Given SQL inserts in the worker, When importing, Then the caller event loop continues ticking', async () => {
  const paths = await setup(`id,payload\n${'1,xxxxxxxxxxxxxxxx\n'.repeat(100_000)}`);
  let ticks = 0;
  let inserting = false;
  const timer = setInterval(() => { if (inserting) { ticks += 1; } }, 5);
  try {
    await runCsvImportSpike(paths, {
      onProgress: (progress) => { inserting = progress.phase === 'import'; },
    });
  }
  finally { clearInterval(timer); }
  expect(ticks).toBeGreaterThan(2);
});

test('NFR-003: Given a bounded streaming import, When measured, Then the report defines RSS scope and verifies every stored value', async () => {
  const paths = await setup(`id,payload\n${'9007199254740993,xxxxxxxxxxxxxxxx\n'.repeat(10_001)}`);
  const report = await runCsvImportSpike({ ...paths, batchRows: 1000 });
  expect(report.rows).toBe(10_001);
  expect(report.transactions).toBe(11);
  expect(report.peakRssBytes).toBeGreaterThan(0);
  expect(report.sampledPeakRssBytes).toBeGreaterThan(0);
  expect(report.memoryScope).toContain('standalone');
  expect(report.memoryScope).toContain('worker');
  expect(report.chunkBytes).toBe(65_536);
  expect(report.batchRows).toBe(1000);
  expect(report.verifiedRows).toBe(report.rows);
  expect(report.parsedValuesSha256).toBe(report.storedValuesSha256);
  expect(report.importMs).toBeGreaterThan(0);
});

test('NFR-004: Given data rows, When importing, Then parsed preview time is reported separately from visible first paint', async () => {
  const paths = await setup(`id\n${'1\n'.repeat(101)}`);
  const report = await runCsvImportSpike(paths);
  expect(report.previewRows).toBe(100);
  expect(report.previewParseMs).toBeGreaterThan(0);
  expect(report.previewScope).toContain('parsed');
  expect(report.previewScope).toContain('visible');
});

test('FR-004: Given CLI misuse, When invoked, Then it exits nonzero with a readable message and no stack trace', async () => {
  let failure: unknown;
  try { await execute(process.execPath, ['scripts/csv-import-spike.mts', '--bogus'], { cwd: resolve('.') }); }
  catch (error: unknown) { failure = error; }
  expect(failure).toMatchObject({ code: 1 });
  if (typeof failure !== 'object' || failure === null || !('stderr' in failure) || typeof failure.stderr !== 'string') {
    throw new Error('CLI failure did not provide stderr.');
  }
  expect(failure.stderr).toContain('Use --input');
  expect(failure.stderr).not.toMatch(/\n\s+at /);
});

test('FR-004: Given a valid CLI request, When invoked, Then stdout and the persistent report contain the verified result', async () => {
  const paths = await setup('id\n9007199254740993\n');
  const { stdout, stderr } = await execute(process.execPath, [
    'scripts/csv-import-spike.mts', '--input', paths.input, '--output', paths.output,
  ], { cwd: resolve('.') });
  const report: unknown = JSON.parse(stdout);
  expect(report).toMatchObject({ task: 'T-004', rows: 1, verifiedRows: 1, previewRows: 1 });
  const persistent: unknown = JSON.parse(await readFile(join(paths.output, 'report.json'), 'utf8'));
  expect(persistent).toEqual(report);
  expect(stderr).toContain('verify:');
  expect(stderr).not.toMatch(/\n\s+at /);
  expect(stored(paths.output)).toEqual([{ id: '9007199254740993' }]);
});
