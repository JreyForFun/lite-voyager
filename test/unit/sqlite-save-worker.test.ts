import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { SqliteSaveService } from '../../src/editor/sqlite-save';
import { EngineClient } from '../../src/engine/engine-client';
import { CsvLoader } from '../../src/loaders/csv-loader';
import { copyDatabaseBytes } from '../../src/storage/copy-database';

const directories: string[] = [];
beforeAll(async () => { const result = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']); expect(result.stderr).toBe(''); }, 30000);
afterEach(async () => { for (const path of directories.splice(0)) { await rm(path, { recursive: true, force: true }); } });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lv-t022-worker-')); directories.push(root); const storageRoot = join(root, 'storage'); await mkdir(storageRoot);
  const source = join(storageRoot, 'table.sqlite'); const original = join(root, 'input.csv'); const destination = join(root, 'saved.sqlite');
  await writeFile(original, 'a\n1\n');
  return { root, storageRoot, source, original, destination, options: { source, original, storageRoot, workerDirectory: resolve('dist'),
    choose: () => Promise.resolve(destination), confirmReplace: () => Promise.resolve(true) } };
}
async function hash(path: string): Promise<string> { const sum = createHash('sha256'); for await (const chunk of createReadStream(path)) { sum.update(chunk as Buffer); } return sum.digest('hex'); }

test.each(['node:sqlite', 'sql.js'] as const)('FR-007: Given a real %s import, When saving beyond the displayed page, Then every row and exact value reopens on both engines after session storage is gone', async (engine) => {
  const f = await fixture(); const text = 'x'.repeat(1024 * 1024 + 1);
  const contents = `id,"select 😀",last\n9007199254740993,"${text}",\n9223372036854775807,"quote""line\nnext",NULL\n${Array.from({ length: 248 }, (_, i) => `${String(i)},row\n`).join('')}`;
  await writeFile(f.original, contents); const originalHash = await hash(f.original);
  await new CsvLoader(resolve('dist')).import(f.original, { path: f.source, engine }, {}, () => {}, new AbortController().signal);
  const sourceHash = await hash(f.source); const service = new SqliteSaveService(f.options); const progress: string[] = [];
  await service.run((value) => { progress.push(value.phase); }); expect(progress).toContain('copying'); expect(progress.at(-1)).toBe('saving');
  expect(await hash(f.destination)).toBe(sourceHash); expect(await hash(f.original)).toBe(originalHash);
  await rm(f.storageRoot, { recursive: true });
  for (const fallback of [false, true]) {
    const client = new EngineClient({ directory: resolve('dist'), forceFallback: fallback });
    try {
      await client.open(f.destination); expect((await client.query('SELECT count(*) FROM records')).rows).toEqual([['250']]);
      expect((await client.query('SELECT id, length("select 😀"),last FROM records WHERE rowid=1')).rows).toEqual([['9007199254740993', String(text.length), '']]);
      expect((await client.query('SELECT id,"select 😀",last FROM records WHERE rowid=2')).rows).toEqual([['9223372036854775807', 'quote"line\nnext', 'NULL']]);
      expect((await client.query('SELECT last FROM records WHERE rowid=3')).rows).toEqual([[null]]);
    } finally { await client.close(); }
  }
}, 20000);

test('FR-007: Given SQLite NULLs, exact integers and binary cells, When saving, Then database bytes and stored BLOB contents survive without placeholder serialization', async () => {
  const f = await fixture(); const writer = new DatabaseSync(f.source);
  writer.exec("CREATE TABLE data(i INTEGER,t TEXT,n TEXT,b BLOB); INSERT INTO data VALUES(9223372036854775807,'',NULL,x'00FF8041')"); writer.close();
  const before = await hash(f.source); await new SqliteSaveService(f.options).run(() => {}); expect(await hash(f.destination)).toBe(before);
  const saved = new DatabaseSync(f.destination, { readOnly: true });
  try { const statement = saved.prepare('SELECT i,t,n,hex(b) AS b FROM data'); statement.setReadBigInts(true);
    expect({ ...statement.get() }).toEqual({ i: 9223372036854775807n, t: '', n: null, b: '00FF8041' });
  } finally { saved.close(); }
});
test('FR-007: Given an empty valid imported database, When saving, Then the complete file reopens without invented tables', async () => {
  const f = await fixture(); const writer = new DatabaseSync(f.source); writer.exec('VACUUM'); writer.close();
  await new SqliteSaveService(f.options).run(() => {}); const saved = new DatabaseSync(f.destination, { readOnly: true });
  try { expect(saved.prepare('SELECT count(*) AS n FROM sqlite_schema').get()?.['n']).toBe(0); } finally { saved.close(); }
});
test('FR-007: Given a large copy in progress, When cancelled, Then the worker exits, old output survives and a subsequent save succeeds', async () => {
  const f = await fixture(); const file = await open(f.source, 'wx');
  try { const buffer = Buffer.alloc(1024 * 1024, 0x61); for (let i = 0; i < 64; i++) { await file.write(buffer); } } finally { await file.close(); }
  await writeFile(f.destination, 'old'); const service = new SqliteSaveService(f.options); let ticks = 0; const timer = setInterval(() => { ticks++; }, 5);
  try {
    await expect(service.run((progress) => { if (progress.phase === 'copying') { service.abort(); } })).rejects.toThrow(/cancelled/iu); await service.settled();
    expect(ticks).toBeGreaterThan(0); expect(await readFile(f.destination, 'utf8')).toBe('old');
    expect((await readdir(f.root)).some((name) => name.startsWith('.lite-voyager-save-'))).toBe(false);
    await service.run(() => {}); expect(await hash(f.destination)).toBe(await hash(f.source));
  } finally { clearInterval(timer); }
}, 15000);
test('FR-007: Given an unavailable copy worker, When saving, Then failure is actionable and temporary output cannot replace an existing file', async () => {
  const f = await fixture(); await writeFile(f.source, 'source'); await writeFile(f.destination, 'old');
  await expect(new SqliteSaveService({ ...f.options, workerDirectory: join(f.root, 'absent') }).run(() => {})).rejects.toThrow(/worker.*retry/iu);
  expect(await readFile(f.destination, 'utf8')).toBe('old');
});
test('FR-007: Given a changing import file, When copying with bounded buffers, Then a source modification prevents successful completion', async () => {
  const f = await fixture(); await writeFile(f.source, Buffer.alloc(2 * 1024 * 1024, 0x61)); const signal = new AbortController(); let change: Promise<void> | undefined;
  await expect(copyDatabaseBytes(f.source, join(f.root, 'partial'), signal.signal, () => { change ??= writeFile(f.source, 'changed'); })).rejects.toThrow(/changed/iu);
  await change;
});
