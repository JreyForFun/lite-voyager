import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import type { EngineName } from '../../src/engine/engine';
import { JsonLoader } from '../../src/loaders/json-loader';
import { isJsonPreviewResult, MAX_PREVIEW_CHARACTERS } from '../../src/protocol';

const directories: string[] = [];
beforeAll(async () => { const built = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']); expect(built.stderr).toBe(''); }, 30000);
afterEach(async () => { for (const path of directories.splice(0)) { await rm(path, { recursive: true, force: true }); } });
async function fixture(input: string | Uint8Array, format = 'json') {
  const directory = await mkdtemp(join(tmpdir(), 'lv-json-import-')); directories.push(directory);
  const source = join(directory, `input.${format}`); const target = join(directory, 'table.sqlite'); await writeFile(source, input);
  return { directory, source, target };
}
async function imported(input: string, engine: EngineName, format = 'json') {
  const f = await fixture(input, format); const loader = new JsonLoader(resolve('dist'));
  const tables = await loader.import(f.source, { path: f.target, engine }, {}, () => {}, new AbortController().signal);
  const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' }); await client.open(f.target);
  return { ...f, tables, client };
}

test.each(['node:sqlite', 'sql.js'] as const)('FR-005: Given %s and exact JSON types, When importing, Then int64, nested SQL, NULL and original number spellings survive', async (engine) => {
  const input = '[{"id":9007199254740993,"value":{"n":9007199254740993,"s":"🙂"},"empty":"","literal":"NULL","n":null,"yes":true,"r":1.5},'
    + '{"id":-9223372036854775808,"value":[1,{"ok":true}],"big":9223372036854775808,"tiny":1e-9999,"raw":1.00,"yes":false},'
    + '{"id":9223372036854775807,"overflow":1e9999,"negativeZero":-0}]';
  const run = await imported(input, engine);
  try {
    expect((await run.client.query('SELECT id,typeof(id),json_extract(value,\'$.s\'),empty,literal,n,yes,typeof(yes),r,typeof(r) FROM records WHERE rowid=1')).rows)
      .toEqual([['9007199254740993', 'integer', '🙂', '', 'NULL', null, '1', 'integer', '1.5', 'real']]);
    expect((await run.client.query('SELECT id,big,tiny,raw,typeof(big),yes FROM records WHERE rowid=2')).rows)
      .toEqual([['-9223372036854775808', '9223372036854775808', '1e-9999', '1.00', 'text', '0']]);
    expect((await run.client.query('SELECT id,overflow,negativeZero FROM records WHERE rowid=3')).rows).toEqual([['9223372036854775807', '1e9999', '-0']]);
    expect(await readFile(run.source, 'utf8')).toBe(input);
  } finally { await run.client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-005: Given %s and late/hostile keys, When importing JSONL, Then union columns and every input row survive', async (engine) => {
  const input = '{}\n{"a":1,"A":2,"":3,"\\u0000":4,"select \\"🙂":5,"__proto__":6,"rowid":20,"_rowid_":30,"oid":40}\n{}\n{"late":"x","a":"text"}\n';
  const run = await imported(input, engine, 'jsonl');
  try {
    expect(run.tables[0]?.columns).toEqual(['a', 'A_2', 'column_3', '_', 'select "🙂', '__proto__', 'rowid', '_rowid_', 'oid', 'late']);
    expect((await run.client.query('SELECT a,"A_2",late FROM records')).rows).toEqual([[null, null, null], ['1', '2', null], [null, null, null], ['text', null, 'x']]);
    expect(run.tables[0]?.notice).toMatch(/unique/i);
  } finally { await run.client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-005: Given %s empty/keyless objects, When importing, Then valid databases preserve row counts', async (engine) => {
  for (const [input, format, rows] of [['[]', 'json', '0'], ['', 'jsonl', '0'], ['[{},{}]', 'json', '2']] as const) {
    const run = await imported(input, engine, format);
    try { expect(run.tables[0]?.rowCount ?? '0').toBe(rows);
      if (rows === '2') { expect((await run.client.page('records')).rows).toEqual([['{}'], ['{}']]); }
      else { expect((await run.client.schema()).rows).toEqual([]); }
    } finally { await run.client.close(); }
  }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-005: Given %s malformed data after preview, When full import fails, Then no partial database or source edit survives', async (engine) => {
  const f = await fixture('[' + '{"n":1},'.repeat(101) + 'null]'); const loader = new JsonLoader(resolve('dist'));
  expect((await loader.preview(f.source)).rows).toHaveLength(100);
  await expect(loader.import(f.source, { path: f.target, engine }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/JSON/);
  expect(await readdir(f.directory)).toEqual(['input.json']);
});

test('FR-005: Given cancellation, callback failure or an existing target, When importing, Then helpers exit and existing files survive with retry available', async () => {
  const input = '[' + Array.from({ length: 30000 }, (_, n) => `{"n":${String(n)}}`).join(',') + ']';
  const f = await fixture(input); const loader = new JsonLoader(resolve('dist')); const signal = new AbortController();
  await expect(loader.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => { signal.abort(); }, signal.signal)).rejects.toThrow(/cancel/i);
  expect(await readdir(f.directory)).toEqual(['input.json']);
  await expect(loader.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => { throw new Error('observer failed'); }, new AbortController().signal)).rejects.toThrow('observer failed');
  await writeFile(f.target, 'keep');
  for (const path of [f.target, f.source]) { await expect(loader.import(f.source, { path, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(); }
  expect(await readFile(f.target, 'utf8')).toBe('keep'); expect(await readFile(f.source, 'utf8')).toBe(input);
  await rm(f.target); expect((await loader.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal))[0]?.rowCount).toBe('30000');
}, 30000);

test('FR-005: Given source replacement during progress or fallback cap refusal, When importing, Then publication fails and partial storage is removed', async () => {
  const f = await fixture('[{"a":1}]'); const loader = new JsonLoader(resolve('dist')); let mutation: Promise<void> | undefined;
  await expect(loader.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => { mutation ??= writeFile(f.source, '[]'); }, new AbortController().signal)).rejects.toThrow(/chang|JSON/);
  await mutation; await truncate(f.source, 20_000_001);
  await expect(loader.import(f.source, { path: f.target, engine: 'sql.js' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/Memory-limited.*20,000,000/);
  expect(await readdir(f.directory)).toEqual(['input.json']);
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-005: Given %s, a read-only source, 1,000 keys and a >1-MB value, When importing, Then full data is stored beyond preview budgets', async (engine) => {
  const data = Object.fromEntries(Array.from({ length: 1000 }, (_, n) => [`c${String(n)}`, n === 0 ? 'A' + 'x'.repeat(1024 * 1024 + 1) + 'Z' : n]));
  const f = await fixture(JSON.stringify([data])); await chmod(f.source, 0o444); const loader = new JsonLoader(resolve('dist'));
  const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
  try { await loader.import(f.source, { path: f.target, engine }, {}, () => {}, new AbortController().signal); await client.open(f.target);
    expect((await client.query("SELECT count(*) FROM pragma_table_info('records')")).rows).toEqual([['1000']]);
    expect((await client.query('SELECT length(c0),substr(c0,-1),c999 FROM records')).rows).toEqual([[String(1024 * 1024 + 3), 'Z', '999']]);
  } finally { await client.close(); await chmod(f.source, 0o644); }
}, 30000);

test('FR-005: Given bounded JSON preview, When late keys/payload limits occur, Then complete rows fit the typed transport with honest limits', async () => {
  const loader = new JsonLoader(resolve('dist')); const f = await fixture('[{"a":null},{"b":""},{"a":"NULL"}]');
  const preview = await loader.preview(f.source); expect(isJsonPreviewResult(preview)).toBe(true);
  expect(preview.rows).toEqual([[null, null], [null, ''], ['NULL', null]]); expect(preview.columns).toEqual(['a', 'b']);
  const huge = await fixture(JSON.stringify([{ a: 'x'.repeat(MAX_PREVIEW_CHARACTERS) }])); const limited = await loader.preview(huge.source);
  expect(limited.rows).toEqual([]); expect(limited.reachedEnd).toBe(false); expect(limited.notice).toMatch(/preview|budget/i);
  expect(limited.notice).toMatch(/20,000,000/);
  expect(isJsonPreviewResult({ ...preview, rows: [[42]] })).toBe(false);
  expect(isJsonPreviewResult({ ...preview, format: 'other' })).toBe(false);
});

test('FR-005: Given keyless JSON records, When previewing, Then complete object placeholders are visible rather than an unexplained blank grid', async () => {
  const f = await fixture('[{},{}]'); const preview = await new JsonLoader(resolve('dist')).preview(f.source);
  expect(preview.columns).toEqual(['__json_object']); expect(preview.rows).toEqual([['{}'], ['{}']]); expect(preview.notice).toMatch(/keyless|no keys/i);
  const huge = await fixture('[{},' + JSON.stringify({ value: 'x'.repeat(4 * 1024 * 1024 + 1) }) + ']');
  const boundary = await new JsonLoader(resolve('dist')).preview(huge.source); expect(boundary.reachedEnd).toBe(false);
  expect(boundary.notice).toMatch(/record.*budget/i); expect(boundary.rows).toEqual([['{}']]);
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-005: Given %s and escaped NUL/BOM/quotes in strings, When importing, Then decoded UTF-8 text remains complete', async (engine) => {
  const value = '\0before\ufeffafter"🙂'; const run = await imported(JSON.stringify([{ value }]), engine);
  try {
    expect((await new JsonLoader(resolve('dist')).preview(run.source)).rows).toEqual([[value]]);
    expect((await run.client.query('SELECT value FROM records')).rows).toEqual([[value]]);
  } finally { await run.client.close(); }
});

test('FR-005: Given a 16-MiB JSON string beyond preview/nursery budgets, When importing, Then page refusal preserves the full stored value and query recovery', async () => {
  const value = 'A' + 'x'.repeat(16 * 1024 * 1024) + 'Z'; const run = await imported(JSON.stringify([{ value }]), 'node:sqlite');
  try {
    await expect(run.client.page('records')).rejects.toThrow('result page exceeds 4 MiB');
    expect((await run.client.query('SELECT length(value),substr(value,1,1),substr(value,-1) FROM records')).rows).toEqual([[String(value.length), 'A', 'Z']]);
  } finally { await run.client.close(); }
}, 30000);
