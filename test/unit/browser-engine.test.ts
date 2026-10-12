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
import type { BrowserRequest, BrowserResponse, GridOptions } from '../../src/protocol';
import { populateBrowserFixture } from './browser-fixture';

beforeAll(async () => {
  const built = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']);
  expect(built.stderr).toBe('');
}, 30000);

async function withBrowser(fallback: boolean, sql: string, run: (request: (message: BrowserRequest) => Promise<BrowserResponse>, path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t012-'));
  const path = join(directory, 'browser.sqlite');
  const db = new DatabaseSync(path);
  populateBrowserFixture(db, sql);
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
  test('FR-017: Given 1000 active column filters, When reading rows and counting on either engine, Then every predicate executes without exceeding SQLite expression depth', async () => {
    const columns = Array.from({ length: 1000 }, (_value, index) => `c${String(index)}`);
    await withBrowser(fallback, `CREATE TABLE wide(${columns.join(',')}); INSERT INTO wide VALUES(${columns.map(() => "'x'").join(',')});`, async (request) => {
      const filters = columns.map((column) => ({ column, operator: 'contains' as const, value: 'x' }));
      const first = await request({ type: 'browserPage', requestId: 1, table: 'wide', offset: 0, limit: 1, grid: { filters } });
      if (first.type !== 'browserRows') { throw new Error(`Expected all 1000 filters to execute: ${JSON.stringify(first)}`); }
      expect(first.page.columns).toEqual(columns); expect(first.page.rows).toEqual([columns.map(() => 'x')]);
      expect(first.page.hasMore).toBe(false);
      expect(await request({ type: 'browserCount', requestId: 2, table: 'wide', grid: { filters } })).toMatchObject({ count: '1' });
      const absent = filters.map((filter, index) => ({ ...filter, value: index === 999 ? 'absent' : filter.value }));
      expect(await request({ type: 'browserPage', requestId: 3, table: 'wide', offset: 0, limit: 1, grid: { filters: absent } })).toMatchObject({ page: { rows: [] } });
      expect(await request({ type: 'browserCount', requestId: 4, table: 'wide', grid: { filters: absent } })).toMatchObject({ count: '0' });
      const nonNull = columns.map((column) => ({ column, operator: 'isNotNull' as const }));
      expect(await request({ type: 'browserCount', requestId: 5, table: 'wide', grid: { filters: nonNull } })).toMatchObject({ count: '1' });
    });
  });
  test('FR-017: Given quoted columns, generated keys and large text, When combining filters and sorting, Then literals, exact integers and complete values survive both engines', async () => {
    await withBrowser(fallback, `CREATE TABLE "order 🚀"("select """ INTEGER, "text" TEXT, bytes BLOB, PRIMARY KEY("select """, text)) WITHOUT ROWID;
      INSERT INTO "order 🚀" VALUES(9223372036854775807, '100%_Case🚀', zeroblob(4)),(2,'100%_case🚀',NULL);
      CREATE TABLE large(value TEXT); INSERT INTO large VALUES(printf('%.*c',1100000,'x'));
      CREATE TABLE plans(a,b,c); INSERT INTO plans VALUES(2,1,0),(1,2,1); CREATE INDEX composite ON plans(a,b);
      CREATE INDEX partial ON plans(b) WHERE c=1; CREATE INDEX expression ON plans(lower(b));`, async (request) => {
      let id = 0;
      const rows = (table: string, grid: GridOptions) => request({ type: 'browserPage', requestId: ++id, table, offset: 0, limit: 1, grid });
      expect(await rows('order 🚀', { filters: [{ column: 'select "', operator: 'contains', value: '9223372036854775807' }, { column: 'text', operator: 'contains', value: '%_Case🚀' }, { column: 'bytes', operator: 'isNotNull' }] })).toMatchObject({ page: { rows: [['9223372036854775807', '100%_Case🚀', '[BLOB 4 bytes]']], hasMore: false } });
      expect(await rows('order 🚀', { filters: [{ column: 'text', operator: 'contains', value: '%_case🚀' }] })).toMatchObject({ page: { rows: [['2', '100%_case🚀', null]] } });
      expect(await rows('large', { filters: [{ column: 'value', operator: 'contains', value: 'xxx' }] })).toMatchObject({ page: { rows: [['x'.repeat(1100000)]] } });
      expect(await rows('plans', { sort: { column: 'b', direction: 'asc' } })).toMatchObject({ type: 'browserSortWarning' });
      expect(await rows('plans', { sort: { column: 'a', direction: 'asc' } })).toMatchObject({ type: 'browserRows', page: { rows: [['1', '2', '1']] } });
      if (!fallback) {
        const storage = await request({ type: 'browserQuery', requestId: ++id, sql: 'SELECT temp_store FROM temp.pragma_temp_store', offset: 0, limit: 1 });
        expect(storage).toMatchObject({ page: { rows: [['1']] } });
      }
    });
  });
  test('FR-017: Given more than one page and indexed and unindexed columns, When sorting and filtering, Then the whole dataset is ordered, counted and kept read-only', async () => {
    await withBrowser(fallback, `CREATE TABLE data(id INTEGER PRIMARY KEY, value TEXT, bytes BLOB);
      WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<205)
      INSERT INTO data SELECT x, CASE WHEN x=1 THEN NULL WHEN x=2 THEN '' WHEN x=3 THEN 'NULL' ELSE 'group_' || (x%2) END, zeroblob(2) FROM n;
      CREATE INDEX data_value ON data(value); CREATE VIEW v AS SELECT * FROM data;
      INSERT INTO data VALUES(9223372036854775807, '%_quote''🚀', NULL),(-9223372036854775808, 'min', NULL);`, async (request) => {
      let id = 0;
      const rows = (grid: GridOptions, offset = 0, table = 'data') => request({ type: 'browserPage', requestId: ++id, table, offset, limit: 100, grid });
      const sorted = await rows({ sort: { column: 'value', direction: 'desc' } });
      expect(sorted).toMatchObject({ type: 'browserRows', page: { hasMore: true } });
      if (sorted.type !== 'browserRows') { throw new Error('Expected sorted rows'); }
      expect(sorted.page.rows[0]?.[1]).toBe('min');
      const filtered = { sort: { column: 'id', direction: 'desc' }, filters: [{ column: 'value', operator: 'contains', value: 'group_1' }], allowSlowSort: true } satisfies GridOptions;
      const first = await rows(filtered);
      expect(first).toMatchObject({ page: { hasMore: true } });
      if (first.type !== 'browserRows') { throw new Error('Expected filtered rows'); }
      expect(first.page.rows[0]?.[0]).toBe('205');
      expect(first.page.rows).toHaveLength(100);
      expect(await rows(filtered, 100)).toMatchObject({ page: { rows: [['5', 'group_1', '[BLOB 2 bytes]']], hasMore: false } });
      expect(await request({ type: 'browserCount', requestId: ++id, table: 'data', grid: filtered })).toMatchObject({ count: '101' });
      expect(await rows({ filters: [{ column: 'value', operator: 'contains', value: "%_quote'🚀" }] })).toMatchObject({ page: { rows: [['9223372036854775807', "%_quote'🚀", null]] } });
      expect(await rows({ filters: [{ column: 'value', operator: 'isNull' }] })).toMatchObject({ page: { rows: [['1', null, '[BLOB 2 bytes]']] } });
      expect(await rows({ filters: [{ column: 'value', operator: 'contains', value: 'null' }] })).toMatchObject({ page: { rows: [] } });
      expect(await rows({ filters: [{ column: 'bytes', operator: 'contains', value: '' }] })).toMatchObject({ page: { rows: [] } });
      const integers = await rows({ sort: { column: 'id', direction: 'asc' }, allowSlowSort: true });
      if (integers.type !== 'browserRows') { throw new Error('Expected integer ordering'); }
      expect(integers.page.rows[0]).toEqual(['-9223372036854775808', 'min', null]);
      expect(await rows({ sort: { column: 'bytes', direction: 'asc' } })).toMatchObject({ type: 'browserSortWarning' });
      expect(await rows({ sort: { column: 'value', direction: 'asc' } }, 0, 'v')).toMatchObject({ type: 'browserSortWarning' });
      const invalid = await rows({ filters: [{ column: 'missing', operator: 'contains', value: 'x' }] });
      if (invalid.type !== 'browserError') { throw new Error('Expected column rejection'); }
      expect(invalid.message).toContain('column');
    });
  });
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
