import { afterEach, expect, test } from 'vitest';
import { access, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) { await rm(root, { recursive: true, force: true }); } });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lv-t032-')); roots.push(root);
  const { QueryHistory } = await import('../../src/editor/query-history');
  return { root, history: new QueryHistory(root, 'file:///one.sqlite'), QueryHistory };
}
test('FR-013: Given 51 successful runs, When reopening history, Then exactly the latest 50 persist newest first and only their owned SQL files remain', async () => {
  const { root, history, QueryHistory } = await fixture();
  for (let index = 0; index < 51; index++) { await history.record(`SELECT ${index}`); }
  const reopened = new QueryHistory(root, 'file:///one.sqlite'); const entries = await reopened.list();
  expect(entries).toHaveLength(50); expect(await reopened.read(entries[0]?.id ?? '')).toBe('SELECT 50');
  expect(await reopened.read(entries[49]?.id ?? '')).toBe('SELECT 1');
  const directories = await readdir(root); expect(directories).toHaveLength(1);
  expect((await readdir(join(root, directories[0] ?? ''))).filter(file => file.endsWith('.sql'))).toHaveLength(50);
});
test('FR-013: Given split-view concurrent runs and another source, When recording repeated statements, Then serialization preserves every run and isolates files', async () => {
  const { root, history, QueryHistory } = await fixture(); const second = new QueryHistory(root, 'file:///one.sqlite');
  await Promise.all([history.record('SELECT 1'), second.record('SELECT 1'), history.record('SELECT 2')]);
  const entries = await second.list(); expect(entries).toHaveLength(3); expect(await second.read(entries[0]?.id ?? '')).toBe('SELECT 2');
  expect(await new QueryHistory(root, 'file:///two.sqlite').list()).toEqual([]);
});

test('FR-013: Given SQL containing JSON-escaped control characters, When retaining 50 runs, Then the bounded index remains readable and full SQL stays exact', async () => {
  const { root, history, QueryHistory } = await fixture(); const sql = `SELECT '${'\u0001'.repeat(160)}'`;
  for (let index = 0; index < 50; index++) { await history.record(sql); }
  const reopened = new QueryHistory(root, 'file:///one.sqlite'); const entries = await reopened.list(); expect(entries).toHaveLength(50);
  const [directory] = await readdir(root); expect((await readFile(join(root, directory ?? '', 'index.json'))).byteLength).toBeLessThanOrEqual(32768);
  expect(await reopened.read(entries[0]?.id ?? '')).toBe(sql);
});
test('FR-013: Given Unicode, whitespace, HTML-like and greater-than-1-MB SQL, When loading one history entry, Then exact complete text survives while metadata stays small', async () => {
  const { history } = await fixture(); const sql = `  SELECT '${'🚀<script>&\n'.repeat(100000)}9223372036854775807'  `;
  await history.record(sql); const entries = await history.list(); expect(JSON.stringify(entries).length).toBeLessThan(512);
  expect(entries[0]?.length).toBe(sql.length); expect(await history.read(entries[0]?.id ?? '')).toBe(sql);
});
test('FR-013: Given malformed or missing SQL and a valid prior entry, When recording or reading untrusted IDs, Then history is retained and paths cannot escape storage', async () => {
  const { history } = await fixture(); await history.record('SELECT 1');
  for (const sql of ['', ' ', 'SELECT\0x', 'x'.repeat(4 * 1024 * 1024 + 1)]) { await expect(history.record(sql)).rejects.toThrow(); }
  for (const id of ['../source', 'a'.repeat(32), '']) { await expect(history.read(id)).rejects.toThrow(); }
  expect(await history.list()).toHaveLength(1);
});
test('FR-013: Given a corrupted index, When querying history, Then corruption is reported without replacing or deleting its bytes', async () => {
  const { root, history } = await fixture(); await history.record('SELECT 1'); const [directory] = await readdir(root);
  const path = join(root, directory ?? '', 'index.json'); await writeFile(path, '{broken');
  await expect(history.list()).rejects.toThrow(/history/iu); await expect(history.record('SELECT 2')).rejects.toThrow(/history/iu);
  expect(await readFile(path, 'utf8')).toBe('{broken');
});
test('FR-013: Given two source histories, When explicitly clearing one, Then only its owned entries are removed', async () => {
  const { root, history, QueryHistory } = await fixture(); const other = new QueryHistory(root, 'file:///two.sqlite');
  await history.record('SELECT 1'); await other.record('SELECT 2'); await history.clear();
  expect(await history.list()).toEqual([]); expect(await other.list()).toHaveLength(1);
});
async function folderOf(root: string): Promise<string> { const [directory] = await readdir(root); return join(root, directory ?? ''); }
test('FR-013: Given a corrupted index, When explicitly clearing history, Then an empty history replaces it and only owned SQL files are removed', async () => {
  const { root, history } = await fixture(); await history.record('SELECT 1'); await history.record('SELECT 2'); const folder = await folderOf(root);
  await writeFile(join(folder, 'index.json'), '{broken'); await writeFile(join(folder, 'notes.txt'), 'not owned by history');
  await history.clear();
  expect(await history.list()).toEqual([]); expect((await readdir(folder)).sort()).toEqual(['index.json', 'notes.txt']);
  await history.record('SELECT 3'); expect((await history.list()).map(entry => entry.preview)).toEqual(['SELECT 3']);
});
test('FR-013: Given another VS Code window holds this history lock, When recording, Then the write waits until the lock is released', async () => {
  const { root, history } = await fixture(); await history.record('SELECT 1'); const lock = join(await folderOf(root), 'history.lock');
  await writeFile(lock, 'held by another window'); let done = false; const pending = history.record('SELECT 2').then(() => { done = true; });
  await new Promise(resolve => setTimeout(resolve, 200)); expect(done).toBe(false);
  await rm(lock); await pending;
  expect((await history.list()).map(entry => entry.preview)).toEqual(['SELECT 2', 'SELECT 1']); await expect(access(lock)).rejects.toThrow();
});
test('FR-013: Given a stale history lock left by a crashed window, When recording, Then the lock is reclaimed and the run is saved', async () => {
  const { root, history } = await fixture(); await history.record('SELECT 1'); const lock = join(await folderOf(root), 'history.lock');
  await writeFile(lock, 'crashed window'); const old = new Date(Date.now() - 120000); await utimes(lock, old, old);
  await history.record('SELECT 2');
  expect(await history.list()).toHaveLength(2); await expect(access(lock)).rejects.toThrow();
});
test('FR-013: Given two windows recording the same file concurrently, When both finish, Then exactly 50 runs remain, every listed SQL file exists and none is orphaned', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lv-t032-windows-')); roots.push(root); const build = await mkdtemp(join(tmpdir(), 'lv-t032-bundle-')); roots.push(build);
  const bundle = join(build, 'query-history.cjs'); const { build: esbuild } = await import('esbuild');
  await esbuild({ entryPoints: ['src/editor/query-history.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle, logLevel: 'silent' });
  const { Worker } = await import('node:worker_threads');
  // Each worker has its own module instance, so its in-process queue cannot see the other: like two VS Code windows.
  const script = `const { workerData, parentPort } = require('node:worker_threads'); const { QueryHistory } = require(workerData.bundle);
(async () => { const history = new QueryHistory(workerData.root, 'file:///shared.sqlite'); for (let i = 0; i < 40; i++) { await history.record('SELECT ' + workerData.tag + ' + ' + i); } })()
  .then(() => { parentPort.postMessage('done'); }, (error) => { parentPort.postMessage('error: ' + error.message); });`;
  const window = (tag: string) => new Promise<void>((resolve, reject) => {
    const worker = new Worker(script, { eval: true, workerData: { bundle, root, tag } });
    worker.once('message', (message: unknown) => { void worker.terminate(); if (message === 'done') { resolve(); } else { reject(new Error(String(message))); } });
    worker.once('error', reject);
  });
  await Promise.all([window('a'), window('b')]);
  const { QueryHistory } = await import('../../src/editor/query-history'); const history = new QueryHistory(root, 'file:///shared.sqlite');
  const entries = await history.list(); expect(entries).toHaveLength(50);
  const files = (await readdir(await folderOf(root))).filter(name => name.endsWith('.sql'));
  expect(files.sort()).toEqual(entries.map(entry => `${entry.id}.sql`).sort());
  for (const entry of entries) { expect(await history.read(entry.id)).toMatch(/^SELECT [ab] \+ \d+$/u); }
}, 60000);
test('FR-013: Given short multi-line, long and escape-heavy SQL, When listing history, Then only genuinely shortened previews end with an ellipsis', async () => {
  const { history } = await fixture();
  await history.record('SELECT *\n    FROM t'); await history.record(`SELECT '${'x'.repeat(300)}'`); await history.record(`SELECT '${'\u0001'.repeat(100)}'`);
  const [escaped, long, short] = await history.list();
  expect(short?.preview).toBe('SELECT * FROM t');
  expect(long?.preview.endsWith('…')).toBe(true); expect(long?.preview.length).toBeLessThanOrEqual(160);
  expect(escaped?.preview.endsWith('…')).toBe(true); expect(Buffer.byteLength(JSON.stringify(escaped?.preview), 'utf8')).toBeLessThanOrEqual(480);
});
