import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import { JsonLoader } from '../../src/loaders/json-loader';

const roots: string[] = [];
beforeAll(async () => { const built = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']); expect(built.stderr).toBe(''); }, 30000);
afterEach(async () => { for (const root of roots.splice(0)) { await rm(root, { recursive: true, force: true }); } });
async function directory(): Promise<string> { const root = await mkdtemp(join(tmpdir(), 'lv-json-recovery-')); roots.push(root); return root; }

for (const engine of ['node:sqlite', 'sql.js'] as const) {
  test('FR-005: Given ' + engine + ' and a key arriving after the preview and first commit, When importing, Then old rows gain NULL and the late nested value remains queryable', async () => {
    const root = await directory(); const source = join(root, 'late.jsonl'); const path = join(root, 'table.sqlite');
    const contents = Array.from({ length: 1001 }, (_, id) => JSON.stringify({ id })).join('\n') + '\n{"id":1001,"late":{"n":9007199254740993}}\n';
    await writeFile(source, contents); const loader = new JsonLoader(resolve('dist')); expect((await loader.preview(source)).columns).toEqual(['id']);
    expect((await loader.import(source, { path, engine }, {}, () => {}, new AbortController().signal))[0]?.columns).toEqual(['id', 'late']);
    const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
    try { await client.open(path);
      expect((await client.query('SELECT count(*),sum(late IS NULL) FROM records')).rows).toEqual([['1002', '1001']]);
      expect((await client.query("SELECT late,json_extract(late,'$.n') FROM records WHERE id=1001")).rows).toEqual([['{"n":9007199254740993}', '9007199254740993']]);
    } finally { await client.close(); }
    expect(await readFile(source, 'utf8')).toBe(contents);
  });
  test.each(['json', 'jsonl'])('FR-005: Given the curated %s fixture and ' + engine + ', When previewing/importing, Then exact int64 extrema, missing/empty/literal values and nested SQL survive', async (format) => {
    const root = await directory(); const source = join(root, `sample.${format}`); const original = resolve(`test/fixtures/sample.${format}`);
    const before = await readFile(original); await copyFile(original, source); const path = join(root, 'table.sqlite'); const loader = new JsonLoader(resolve('dist'));
    expect((await loader.preview(source)).rows[0]?.[0]).toBe('9007199254740993');
    await loader.import(source, { path, engine }, {}, () => {}, new AbortController().signal);
    const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
    try {
      await client.open(path); expect((await client.query('SELECT id,missing,extra FROM records')).rows).toEqual([
        ['9007199254740993', null, null], ['9223372036854775807', '', 'union key'], ['-9223372036854775808', 'NULL', null],
      ]);
      expect((await client.query("SELECT json_extract(nested,'$.active') FROM records LIMIT 1")).rows).toEqual([['1']]);
    } finally { await client.close(); }
    expect(await readFile(source)).toEqual(before); expect(await readFile(original)).toEqual(before);
  });

  test.each(['json', 'jsonl'])('FR-005: Given an unexpected ' + engine + ' %s helper crash, When importing and retrying, Then partial storage is removed, source bytes survive and a fresh worker succeeds', async (format) => {
    const root = await directory(); const source = join(root, `input.${format}`); const record = '{"n":9007199254740993}';
    const contents = format === 'json' ? '[' + Array.from({ length: 100000 }, () => record).join(',') + ']' : (record + '\n').repeat(100000);
    await writeFile(source, contents); const path = join(root, 'table.sqlite'); const loader = new JsonLoader(resolve('dist')); let killed = false;
    await expect(loader.import(source, { path, engine }, {}, (progress) => {
      if (!killed) { expect(progress.processId).toBeTypeOf('number'); if (progress.processId === undefined) { throw new Error('Missing helper PID'); } killed = true; process.kill(progress.processId, 'SIGKILL'); }
    }, new AbortController().signal)).rejects.toThrow(/helper|worker/i);
    expect(killed).toBe(true); expect(await readdir(root)).toEqual([`input.${format}`]); expect(await readFile(source, 'utf8')).toBe(contents);
    expect((await loader.import(source, { path, engine }, {}, () => {}, new AbortController().signal))[0]?.rowCount).toBe('100000');
  }, 30000);
}

test.each(['unsupported.json', 'corrupt.json', 'truncated.jsonl', 'empty.json'])('FR-005: Given curated invalid input %s, When preview/full import fails, Then no partial output or source mutation survives', async (name) => {
  const root = await directory(); const source = join(root, name); const original = resolve('test/fixtures', name); const before = await readFile(original); await copyFile(original, source);
  const loader = new JsonLoader(resolve('dist')); await expect(loader.preview(source)).rejects.toThrow(/JSON/);
  for (const engine of ['node:sqlite', 'sql.js'] as const) { await expect(loader.import(source, { path: join(root, 'table.sqlite'), engine }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/JSON/); }
  expect(await readdir(root)).toEqual([name]); expect(await readFile(source)).toEqual(before); expect(await readFile(original)).toEqual(before);
});
