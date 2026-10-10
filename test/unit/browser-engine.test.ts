import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, test } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import { SqliteBrowser } from '../../src/editor/sqlite-browser';
import type { BrowserRequest, BrowserResponse } from '../../src/protocol';

beforeAll(async () => {
  const built = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']);
  expect(built.stderr).toBe('');
}, 30000);

async function withBrowser(fallback: boolean, sql: string, run: (request: (message: BrowserRequest) => Promise<BrowserResponse>, path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t012-'));
  const path = join(directory, 'browser.sqlite');
  const db = new DatabaseSync(path);
  try { db.exec(sql); } finally { db.close(); }
  await chmod(path, 0o444);
  const before = createHash('sha256').update(await readFile(path)).digest('hex');
  const engine = new EngineClient({ directory: resolve('dist'), forceFallback: fallback });
  const browser = new SqliteBrowser(engine);
  try {
    await engine.open(path);
    await run(async (message) => {
      let response: BrowserResponse | undefined;
      await browser.handle(message, (value) => { response = value; });
      if (response === undefined) { throw new Error('Browser did not respond'); }
      return response;
    }, path);
    await engine.close();
    expect(createHash('sha256').update(await readFile(path)).digest('hex')).toBe(before);
    expect(await readdir(directory)).toEqual(['browser.sqlite']);
  } finally {
    browser.dispose(); await engine.close(); await chmod(path, 0o600); await rm(directory, { recursive: true, force: true });
  }
}

describe.each([false, true])('T-012 real browser Engine fallback=%s', (fallback) => {
  test('FR-002: Given schema SQL larger than a row-page budget, When listing names, Then unnecessary creation SQL does not prevent browsing', async () => {
    await withBrowser(fallback, `CREATE TABLE "a small"(v); INSERT INTO "a small" VALUES(42); CREATE TABLE "z large schema"(v TEXT DEFAULT '${'x'.repeat(4300000)}');`, async (request) => {
      const list = await request({ type: 'browserList', requestId: 1, offset: 0 });
      expect(list).toEqual({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'a small', kind: 'table' }, { name: 'z large schema', kind: 'table' }], hasMore: false });
      expect(await request({ type: 'browserPage', requestId: 2, table: 'a small', offset: 0, limit: 100 })).toMatchObject({ page: { rows: [['42']], hasMore: false } });
    });
  });

  test('FR-002: Given empty, exact-boundary and partial-page tables and a view, When browsing, Then pages and quoted fidelity values are exact and sources unchanged', async () => {
    await withBrowser(fallback, `
      CREATE TABLE "select 🚀"(id INTEGER, value TEXT, bytes BLOB, real REAL, date TEXT);
      WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<201)
      INSERT INTO "select 🚀" SELECT x, CASE x WHEN 1 THEN NULL WHEN 2 THEN '' WHEN 3 THEN 'NULL' ELSE '<script>literal</script>' END, zeroblob(24), 1e-200, '2026-10-10T12:00:00+08:00' FROM n;
      INSERT INTO "select 🚀" VALUES(9223372036854775807, 'max', zeroblob(0), 1e200, 'stored'),(-9223372036854775808, 'min', NULL, -1e200, 'stored');
      CREATE TABLE empty(value); CREATE VIEW "order \"\"quoted" AS SELECT * FROM "select 🚀";
      CREATE TABLE boundary(value); WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100) INSERT INTO boundary SELECT x FROM n;
    `, async (request) => {
      const list = await request({ type: 'browserList', requestId: 1, offset: 0 });
      if (list.type !== 'browserTables') { throw new Error('List expected'); }
      expect(list.objects).toContainEqual({ name: 'order "quoted', kind: 'view' });
      expect(await request({ type: 'browserPage', requestId: 2, table: 'empty', offset: 0, limit: 100 })).toMatchObject({ page: { columns: ['value'], rows: [], hasMore: false } });
      const boundary = await request({ type: 'browserPage', requestId: 3, table: 'boundary', offset: 0, limit: 100 });
      if (boundary.type !== 'browserRows') { throw new Error('Rows expected'); }
      expect(boundary.page.rows).toHaveLength(100); expect(boundary.page.hasMore).toBe(false);
      const first = await request({ type: 'browserPage', requestId: 4, table: 'select 🚀', offset: 0, limit: 100 });
      if (first.type !== 'browserRows') { throw new Error('Rows expected'); }
      expect(first.page.rows).toHaveLength(100);
      expect(first.page.hasMore).toBe(true);
      expect(first.page.rows.slice(0, 3).map((row) => row[1])).toEqual([null, '', 'NULL']);
      expect(first.page.rows[0]).toEqual(['1', null, '[BLOB 24 bytes]', '1e-200', '2026-10-10T12:00:00+08:00']);
      const last = await request({ type: 'browserPage', requestId: 5, table: 'order "quoted', offset: 200, limit: 100 });
      expect(last).toMatchObject({ page: { rows: [['201', '<script>literal</script>', '[BLOB 24 bytes]', '1e-200', '2026-10-10T12:00:00+08:00'], ['9223372036854775807', 'max', '[BLOB 0 bytes]', '1e+200', 'stored'], ['-9223372036854775808', 'min', null, '-1e+200', 'stored']], hasMore: false } });
      expect(await request({ type: 'browserCount', requestId: 6, table: 'order "quoted' })).toMatchObject({ count: '203' });
      const absent = await request({ type: 'browserPage', requestId: 7, table: 'absent', offset: 0, limit: 100 });
      if (absent.type !== 'browserError') { throw new Error('Error expected'); }
      expect(absent.message).toMatch(/reopen|retry/iu);
      expect(await request({ type: 'browserPage', requestId: 8, table: 'boundary', offset: 0, limit: 100 })).toMatchObject({ type: 'browserRows' });
    });
  });

  test('FR-002: Given more than 100 objects and 1000 columns, When paging names and rows, Then no objects or columns disappear', async () => {
    const definitions = Array.from({ length: 102 }, (_value, index) => `CREATE TABLE t${String(index).padStart(3, '0')}(v);`).join('');
    const columns = Array.from({ length: 1000 }, (_value, index) => `c${String(index)}`);
    await withBrowser(fallback, `${definitions} CREATE TABLE wide(${columns.join(',')}); INSERT INTO wide VALUES(${columns.map((_name, index) => String(index)).join(',')});`, async (request) => {
      const first = await request({ type: 'browserList', requestId: 1, offset: 0 });
      if (first.type !== 'browserTables') { throw new Error('List expected'); }
      expect(first.objects).toHaveLength(100); expect(first.hasMore).toBe(true);
      expect(await request({ type: 'browserList', requestId: 2, offset: 100 })).toMatchObject({ objects: [{ name: 't100', kind: 'table' }, { name: 't101', kind: 'table' }, { name: 'wide', kind: 'table' }], hasMore: false });
      const wide = await request({ type: 'browserPage', requestId: 3, table: 'wide', offset: 0, limit: 100 });
      if (wide.type !== 'browserRows') { throw new Error('Rows expected'); }
      expect(wide.page.columns).toEqual(columns); expect(wide.page.rows[0]?.[999]).toBe('999');
    });
  });

  test('FR-002: Given multiple 1 MiB cells and an oversized value, When reducing page size, Then complete data is accessible and impossible pages fail explicitly', async () => {
    await withBrowser(fallback, `CREATE TABLE cells(value); INSERT INTO cells VALUES(printf('%.*c', 1100000, 'x')), (printf('%.*c', 1100000, 'y')), (printf('%.*c', 1100000, 'z')), (printf('%.*c', 1100000, 'w')); CREATE TABLE huge(value); INSERT INTO huge VALUES(printf('%.*c', 4300000, 'a'));`, async (request) => {
      const oversized = await request({ type: 'browserPage', requestId: 1, table: 'cells', offset: 0, limit: 100 });
      if (oversized.type !== 'browserError') { throw new Error('Error expected'); }
      expect(oversized.message).toContain('No value was truncated');
      const page = await request({ type: 'browserPage', requestId: 2, table: 'cells', offset: 3, limit: 1 });
      if (page.type !== 'browserRows') { throw new Error('Rows expected'); }
      expect(page.page.rows[0]?.[0]).toBe('w'.repeat(1100000));
      expect(page.page.hasMore).toBe(false);
      const huge = await request({ type: 'browserPage', requestId: 3, table: 'huge', offset: 0, limit: 1 });
      if (huge.type !== 'browserError') { throw new Error('Error expected'); }
      expect(huge.message).toContain('No value was truncated');
    });
  });
});
