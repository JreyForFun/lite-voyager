import { afterEach, expect, test } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
