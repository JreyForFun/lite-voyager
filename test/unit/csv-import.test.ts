import { chmod, mkdtemp, readFile, readdir, rm, truncate, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { CsvLoader } from '../../src/loaders/csv-loader';
import { EngineClient } from '../../src/engine/engine-client';
import type { EngineName } from '../../src/engine/engine';
import type { LoadOptions, Progress } from '../../src/loaders/file-loader';

const directories: string[] = [];
beforeAll(async () => {
  const built = await promisify(execFile)(process.execPath, ['esbuild.js', '--production'], { cwd: resolve('.') });
  expect(built.stderr).toBe('');
}, 20000);
afterEach(async () => { for (const path of directories.splice(0)) { await rm(path, { recursive: true, force: true }); } });
async function fixture(contents: string | Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), 'lv-import-unit-')); directories.push(directory);
  const source = join(directory, 'source.csv'); const target = join(directory, 'table.sqlite');
  await writeFile(source, contents); return { directory, source, target };
}
async function imported(contents: string, engine: EngineName, options: LoadOptions = {}) {
  const files = await fixture(contents); const progress: Progress[] = [];
  const loader = new CsvLoader(resolve('dist'));
  const tables = await loader.import(files.source, { path: files.target, engine }, options, (value) => { progress.push(value); }, new AbortController().signal);
  const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
  await client.open(files.target);
  return { ...files, tables, progress, client };
}

test.each(['node:sqlite', 'sql.js'] as const)('FR-004: Given %s and exact mixed CSV, When importing, Then original text, NULL, int64 and multiline values survive', async (engine) => {
  const contents = '\ufeffid,text,empty,real\r\n9007199254740993,"a\r\nb",,1.5\r\n-9223372036854775808,"<script>x</script>",NULL,2.5\r\n9223372036854775807,"quote""here",,3.5\r\n';
  const run = await imported(contents, engine);
  try {
    expect((await run.client.query('SELECT * FROM records ORDER BY rowid')).rows).toEqual([
      ['9007199254740993', 'a\r\nb', '', '1.5'], ['-9223372036854775808', '<script>x</script>', 'NULL', '2.5'],
      ['9223372036854775807', 'quote"here', '', '3.5'],
    ]);
    expect((await run.client.columns('records')).rows.map((row) => row[2])).toEqual(['INTEGER', 'TEXT', 'TEXT', 'REAL']);
    expect(run.tables[0]?.rowCount).toBe('3');
    expect(run.progress.at(-1)).toMatchObject({ bytes: String(Buffer.byteLength(contents)), totalBytes: String(Buffer.byteLength(contents)), rows: '3' });
    expect(await readFile(run.source, 'utf8')).toBe(contents);
  } finally { await run.client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-004: Given %s and tiny/large canonical REALs, When inferring/importing, Then SQLite round-trips their exact displayed spellings', async (engine) => {
  const values = ['5e-324', '-5e-324', '1e+308', '1.7976931348623157e+308', '1.2345678901234567'];
  const run = await imported(`value\n${values.join('\n')}\n`, engine);
  try {
    expect((await run.client.page('records')).rows).toEqual(values.map((value) => [value]));
    expect((await run.client.query('SELECT typeof(value) FROM records')).rows).toEqual(values.map(() => ['real']));
  } finally { await run.client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-004: Given %s and a conflict after sample row 100, When importing, Then the entire column widens using original strings', async (engine) => {
  const contents = `id,real\n${Array.from({ length: 100 }, (_, i) => `${String(i)},1.5`).join('\n')}\nlate,1.50\n`;
  const run = await imported(contents, engine);
  try {
    expect((await run.client.columns('records')).rows.map((row) => row[2])).toEqual(['TEXT', 'TEXT']);
    expect((await run.client.query('SELECT id,real,typeof(id) FROM records ORDER BY rowid DESC', [], { limit: 1 })).rows).toEqual([['late', '1.50', 'text']]);
    expect((await run.client.query('SELECT id FROM records WHERE rowid=2')).rows).toEqual([['1']]);
  } finally { await run.client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-004: Given %s and duplicate headers/ragged rows, When importing, Then no field is dropped and missing differs from empty', async (engine) => {
  const run = await imported('a,A,,select\n1,2,,x,extra\n3\n\n', engine, { allText: true });
  try {
    expect(run.tables[0]?.columns).toEqual(['a', 'A_2', 'column_3', 'select', 'column_5']);
    expect((await run.client.page('records')).rows).toEqual([['1', '2', '', 'x', 'extra'], ['3', null, null, null, null], ['', null, null, null, null]]);
  } finally { await run.client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-004: Given %s and header-off/all-text, When importing, Then the first row is data and numeric spellings remain text', async (engine) => {
  const run = await imported('001;9007199254740993;1e3\n002;9223372036854775808;1.00\n', engine, { delimiter: ';', header: false, allText: true });
  try {
    expect(run.tables[0]?.columns).toEqual(['column_1', 'column_2', 'column_3']);
    expect((await run.client.query('SELECT *, typeof(column_2) FROM records')).rows).toEqual([['001', '9007199254740993', '1e3', 'text'], ['002', '9223372036854775808', '1.00', 'text']]);
  } finally { await run.client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-004: Given %s and headers shadowing all rowid aliases, When finalizing, Then input order and every source column survive', async (engine) => {
  const run = await imported('rowid,_rowid_,oid,__lv_order\n20,3,4,first\n10,1,2,second\n', engine);
  try { expect((await run.client.page('records')).rows).toEqual([['20', '3', '4', 'first'], ['10', '1', '2', 'second']]); }
  finally { await run.client.close(); }
});

test.each(['', 'a,b\n'])('FR-004: Given empty or header-only input %j, When importing, Then there are no invented data rows', async (contents) => {
  const run = await imported(contents, 'node:sqlite');
  try { expect(run.tables[0]?.rowCount ?? '0').toBe('0'); expect((await run.client.schema()).rows.length).toBe(contents === '' ? 0 : 1); }
  finally { await run.client.close(); }
});

test.each(['a\n"bad', 'a\nx"y\n', 'a\n"x" \n', 'a\nx\ry', 'a\nx\0y', Buffer.from([97, 10, 255])])('FR-004: Given malformed input %j, When full parsing fails, Then source remains unchanged and no destination/partial file is published', async (contents) => {
  const files = await fixture(contents); const before = await readFile(files.source);
  await expect(new CsvLoader(resolve('dist')).import(files.source, { path: files.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow();
  expect(await readdir(files.directory)).toEqual(['source.csv']); expect(await readFile(files.source)).toEqual(before);
});

test('NFR-001: Given an existing destination or source alias, When importing, Then neither file is overwritten', async () => {
  const files = await fixture('a\n1\n'); await writeFile(files.target, 'keep'); const loader = new CsvLoader(resolve('dist'));
  for (const path of [files.source, files.target]) {
    await expect(loader.import(files.source, { path, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow();
  }
  expect(await readFile(files.target, 'utf8')).toBe('keep'); expect(await readFile(files.source, 'utf8')).toBe('a\n1\n');
});

test('FR-004: Given cancellation at progress, When the helper stops, Then partial storage is removed and a new import succeeds', async () => {
  const files = await fixture(`a\n${'123\n'.repeat(30000)}`); const signal = new AbortController(); const loader = new CsvLoader(resolve('dist'));
  await expect(loader.import(files.source, { path: files.target, engine: 'node:sqlite' }, {}, () => { signal.abort(); }, signal.signal)).rejects.toThrow(/cancel/i);
  expect(await readdir(files.directory)).toEqual(['source.csv']);
  expect((await loader.import(files.source, { path: files.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal))[0]?.rowCount).toBe('30000');
}, 15000);

test('FR-004: Given a source changed after the first progress, When importing, Then publication fails and owned storage is cleaned', async () => {
  const files = await fixture(`a\n${'123\n'.repeat(10000)}`); let mutation: Promise<void> | undefined;
  await expect(new CsvLoader(resolve('dist')).import(files.source, { path: files.target, engine: 'node:sqlite' }, {}, () => { mutation ??= writeFile(files.source, 'changed\n'); }, new AbortController().signal)).rejects.toThrow(/chang|UTF|CSV/i);
  await mutation; expect(await readdir(files.directory)).toEqual(['source.csv']);
});

test('FR-004: Given a callback failure, When reporting progress, Then the helper exits and no partial output survives', async () => {
  const files = await fixture('a\n1\n');
  await expect(new CsvLoader(resolve('dist')).import(files.source, { path: files.target, engine: 'node:sqlite' }, {}, () => { throw new Error('observer failed'); }, new AbortController().signal)).rejects.toThrow('observer failed');
  expect(await readdir(files.directory)).toEqual(['source.csv']);
});

test('FR-004: Given a >1-MB cell and 1,000-column row, When importing, Then preview budgets do not truncate full data', async () => {
  const large = 'x'.repeat(1024 * 1024 + 3);
  const values = [large, ...Array.from({ length: 999 }, (_, i) => String(i))];
  const run = await imported(`${values.map((_, i) => `c${String(i)}`).join(',')}\n${values.join(',')}\n`, 'node:sqlite', { allText: true });
  try { expect((await run.client.page('records', { limit: 1 })).rows[0]).toEqual(values); }
  finally { await run.client.close(); }
}, 15000);

test('FR-004: Given a 16-MiB record larger than either worker nursery and preview budget, When importing and requesting an oversized page, Then an explicit page limit preserves the complete stored value and query recovery', async () => {
  const value = `A${'x'.repeat(16 * 1024 * 1024)}Z`;
  const run = await imported(`value\n${value}\n`, 'node:sqlite', { allText: true });
  try {
    await expect(run.client.page('records', { limit: 1 })).rejects.toThrow('result page exceeds 4 MiB');
    expect((await run.client.query('SELECT length(value),substr(value,1,1),substr(value,-1) FROM records')).rows).toEqual([[String(value.length), 'A', 'Z']]);
    expect(run.tables[0]?.rowCount).toBe('1');
  } finally { await run.client.close(); }
}, 30000);

test.each([[';', 'a;b\n1;2\n'], ['|', '"a|quoted"|b\n1|2\n'], ['\t', 'a\tb\n1\t2\n']] as const)('FR-004: Given delimiter %j, When the import preview detects it, Then exact columns and rows are available before full import', async (delimiter, contents) => {
  const files = await fixture(contents); const preview = await new CsvLoader(resolve('dist')).preview(files.source);
  expect(preview.delimiter).toBe(delimiter); expect(preview.rows).toEqual([['1', '2']]);
});

test.each(['node:sqlite', 'sql.js'] as const)('NFR-001: Given %s and a read-only source, When importing, Then reading/querying succeeds without source writes', async (engine) => {
  const files = await fixture('id,value\n9007199254740993,exact\n'); await chmod(files.source, 0o444);
  const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
  try {
    await new CsvLoader(resolve('dist')).import(files.source, { path: files.target, engine }, {}, () => {}, new AbortController().signal);
    await client.open(files.target); expect((await client.page('records')).rows).toEqual([['9007199254740993', 'exact']]);
    expect(await readFile(files.source, 'utf8')).toBe('id,value\n9007199254740993,exact\n');
  } finally { await client.close(); await chmod(files.source, 0o644); }
});

test('FR-004: Given valid preview rows followed by malformed data, When full import reaches the later record, Then it fails without publishing a partial table', async () => {
  const files = await fixture(`a\n${'1\n'.repeat(101)}"unterminated`); const loader = new CsvLoader(resolve('dist'));
  expect((await loader.preview(files.source)).rows).toHaveLength(100);
  await expect(loader.import(files.source, { path: files.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/quote|Malformed/i);
  expect(await readdir(files.directory)).toEqual(['source.csv']);
});

test('FR-004: Given fallback input one byte above 20,000,000, When importing, Then the honest cap refuses loading and leaves no partial file', async () => {
  const files = await fixture(`a\n${'1\n'.repeat(101)}`); await truncate(files.source, 20_000_001);
  await expect(new CsvLoader(resolve('dist')).import(files.source, { path: files.target, engine: 'sql.js' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/Memory-limited.*20,000,000/);
  expect(await readdir(files.directory)).toEqual(['source.csv']);
});

test('FR-004: Given a UTF-8 character and quoting across 64-KiB boundaries, When full import reads the final record, Then complete text is exact', async () => {
  const value = `${'x'.repeat(65532)}🙂\n"quoted"`;
  const run = await imported(`a\n"${value.replaceAll('"', '""')}"\n`, 'node:sqlite', { allText: true });
  try { expect((await run.client.page('records', { limit: 1 })).rows).toEqual([[value]]); } finally { await run.client.close(); }
});

test.each(['invalid', 'exit'] as const)('FR-004: Given helper %s, When a worker response cannot complete, Then failure cleans owned files and source remains usable', async (failure) => {
  const files = await fixture('a\n1\n'); const helper = join(files.directory, 'helper');
  const { mkdir } = await import('node:fs/promises'); await mkdir(helper);
  await writeFile(join(helper, 'csv-import-process.js'), failure === 'exit' ? 'process.exit(0);' : "process.once('message', () => { process.send({type:'progress',value:{bytes:'999',totalBytes:'1',rows:'0'}}); });");
  await expect(new CsvLoader(helper).import(files.source, { path: files.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/Invalid|stopped/);
  expect((await readdir(files.directory)).sort()).toEqual(['helper', 'source.csv']); expect(await readFile(files.source, 'utf8')).toBe('a\n1\n');
});
