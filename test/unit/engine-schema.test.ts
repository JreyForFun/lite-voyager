import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, test } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import { MAX_PAGE_BYTES, type EnginePage } from '../../src/engine/engine';

const execute = promisify(execFile);
const table = 'select "😀; DROP TABLE sentinel; --';
const identifier = (name: string): string => `"${name.replaceAll('"', '""')}"`;
const hash = async (path: string): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');

beforeAll(async () => {
  const result = await execute(process.execPath, ['esbuild.js', '--production']);
  expect(result.stderr).toBe('');
}, 30000);

async function withDatabase(fallback: boolean, sql: string, run: (engine: EngineClient, path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t011-'));
  const path = join(directory, 'schema.sqlite');
  const writer = new DatabaseSync(path);
  try { writer.exec(sql); } finally { writer.close(); }
  const engine = new EngineClient({ directory: resolve('dist'), forceFallback: fallback });
  try { await engine.open(path); await run(engine, path); }
  finally { await engine.close(); await chmod(path, 0o600); await rm(directory, { recursive: true, force: true }); }
}

async function allPages(read: (offset: number) => Promise<EnginePage>): Promise<EnginePage['rows']> {
  const rows: EnginePage['rows'] = [];
  for (let offset = 0;; offset += 2) {
    const page = await read(offset);
    expect(page.rows.length).toBeLessThanOrEqual(2);
    expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(MAX_PAGE_BYTES);
    rows.push(...page.rows);
    if (!page.hasMore) { return rows; }
  }
}

const definition = `
  CREATE TABLE sentinel(value);
  CREATE TABLE ${identifier(table)} (
    "first name" TEXT NOT NULL DEFAULT '', "quote""name" INTEGER DEFAULT 9223372036854775807,
    "😀" TEXT DEFAULT 'NULL', "order" TEXT DEFAULT NULL,
    virtual_value TEXT GENERATED ALWAYS AS ("first name" || '!') VIRTUAL,
    stored_value INTEGER GENERATED ALWAYS AS (length("first name")) STORED,
    PRIMARY KEY("quote""name", "first name")
  ) WITHOUT ROWID;
  CREATE UNIQUE INDEX "unique 😀" ON ${identifier(table)}("😀");
  CREATE INDEX "expression index" ON ${identifier(table)}(lower("😀") COLLATE NOCASE DESC, "order") WHERE "order" IS NOT NULL;
  CREATE VIEW "quoted view" AS SELECT "😀", "order" FROM ${identifier(table)};
  CREATE TABLE sqliteX(id INTEGER PRIMARY KEY AUTOINCREMENT, value);
`;

describe.each([false, true])('T-011 worker metadata, fallback=%s', (fallback) => {
  test.each(['columns', 'indexes', 'indexColumns'] as const)('FR-003: Given user tables named like PRAGMA functions, When requesting %s, Then metadata functions are not shadowed', async (operation) => {
    await withDatabase(fallback, `
      CREATE TABLE pragma_table_xinfo(value); CREATE TABLE pragma_index_list(value); CREATE TABLE pragma_index_xinfo(value);
      CREATE TABLE target(value TEXT); CREATE INDEX target_index ON target(value);
    `, async (engine) => {
      const page = operation === 'indexColumns'
        ? await engine.indexColumns('target', 'target_index') : await engine[operation]('target');
      expect(page.rows[0]?.[operation === 'indexes' ? 0 : operation === 'columns' ? 1 : 2]).toBe(operation === 'indexes' ? 'target_index' : 'value');
    });
  });

  test('FR-001: Given tables, views and unusual names, When listing pages, Then every user object is reachable and internal objects are excluded', async () => {
    await withDatabase(fallback, definition, async (engine) => {
      expect((await engine.query("SELECT name FROM main.sqlite_schema WHERE name='sqlite_sequence'")).rows).toEqual([['sqlite_sequence']]);
      const rows = await allPages((offset) => engine.schema({ offset, limit: 2 }));
      expect(rows.map((row) => row[1])).toEqual(['quoted view', table, 'sentinel', 'sqliteX']);
      expect(rows.map((row) => row[0])).toEqual(['view', 'table', 'table', 'table']);
      expect(rows.every((row) => row[3]?.startsWith('CREATE'))).toBe(true);
      expect((await engine.schema({ offset: rows.length })).rows).toEqual([]);
    });
  });

  test('FR-003: Given composite keys, defaults and generated columns, When reading column pages, Then exact declared metadata and every column are preserved', async () => {
    await withDatabase(fallback, definition, async (engine) => {
      expect((await engine.columns(table, { limit: 1 })).columns).toEqual(['cid', 'name', 'type', 'notNull', 'defaultValue', 'primaryKey', 'hidden']);
      expect(await allPages((offset) => engine.columns(table, { offset, limit: 2 }))).toEqual([
        ['0', 'first name', 'TEXT', '1', "''", '2', '0'],
        ['1', 'quote"name', 'INTEGER', '1', '9223372036854775807', '1', '0'],
        ['2', '😀', 'TEXT', '0', "'NULL'", '0', '0'],
        ['3', 'order', 'TEXT', '0', 'NULL', '0', '0'],
        ['4', 'virtual_value', 'TEXT', '0', null, '0', '2'],
        ['5', 'stored_value', 'INTEGER', '0', null, '0', '3'],
      ]);
      expect((await engine.columns('QUOTED VIEW')).rows).toEqual([
        ['0', '😀', 'TEXT', '0', null, '0', '0'], ['1', 'order', 'TEXT', '0', null, '0', '0'],
      ]);
      expect((await engine.indexes('quoted view')).rows).toEqual([]);
      expect((await engine.indexes('sentinel')).rows).toEqual([]);
    });
  });

  test('FR-003: Given explicit, expression and implicit indexes, When paging indexes and terms, Then definitions, flags and WITHOUT ROWID primary keys are inspectable', async () => {
    await withDatabase(fallback, definition, async (engine) => {
      expect((await engine.indexes(table)).columns).toEqual(['name', 'unique', 'origin', 'partial', 'sql']);
      const rows = await allPages((offset) => engine.indexes(table, { offset, limit: 2 }));
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(['expression index', '0', 'c', '1', expect.stringContaining('lower("😀") COLLATE NOCASE DESC')]);
      const primary = rows.find((row) => row[2] === 'pk');
      expect(primary).toEqual([expect.stringContaining('sqlite_autoindex_'), '1', 'pk', '0', null]);
      expect(rows[2]).toEqual(['unique 😀', '1', 'c', '0', expect.stringContaining('CREATE UNIQUE INDEX')]);
      expect((await engine.indexColumns(table, 'EXPRESSION INDEX')).columns).toEqual(['seqno', 'cid', 'name', 'desc', 'coll', 'key']);
      const terms = await allPages((offset) => engine.indexColumns(table, 'expression index', { offset, limit: 2 }));
      expect(terms.slice(0, 2)).toEqual([['0', '-2', null, '1', 'NOCASE', '1'], ['1', '3', 'order', '0', 'BINARY', '1']]);
      expect(terms.slice(2).map((row) => row[5])).toEqual(['0', '0']);
      expect((await engine.indexColumns(table, primary?.[0] ?? '')).rows.slice(0, 2)).toEqual([
        ['0', '1', 'quote"name', '0', 'BINARY', '1'], ['1', '0', 'first name', '0', 'BINARY', '1'],
      ]);
      await expect(engine.indexColumns('sentinel', 'expression index')).rejects.toThrow('index was not found');
    });
  });

  test('FR-003: Given missing objects, injection-like identifiers and invalid pages, When requesting schema, Then failures are clear and subsequent valid requests still work', async () => {
    await withDatabase(fallback, definition, async (engine) => {
      for (const name of ['missing', "sentinel'); DROP TABLE sentinel; --"]) {
        await expect(engine.columns(name)).rejects.toThrow('schema object was not found');
        await expect(engine.indexes(name)).rejects.toThrow('schema object was not found');
      }
      for (const name of ['', 'sentinel\0']) {
        await expect(engine.columns(name)).rejects.toThrow('Invalid');
        await expect(engine.indexes(name)).rejects.toThrow('Invalid');
        await expect(engine.indexColumns(table, name)).rejects.toThrow('Invalid');
      }
      for (const page of [{ limit: 0 }, { limit: 1001 }, { offset: -1 }, { offset: 0.5 }]) {
        await expect(engine.columns(table, page)).rejects.toThrow('Invalid page');
        await expect(engine.indexes(table, page)).rejects.toThrow('Invalid page');
        await expect(engine.indexColumns(table, 'expression index', page)).rejects.toThrow('Invalid page');
      }
      await expect(engine.indexColumns(table, "expression index'); DROP TABLE sentinel; --")).rejects.toThrow('index was not found');
      expect((await engine.columns('sentinel')).rows).toEqual([['0', 'value', '', '0', null, '0', '0']]);
    });
  });

  test('FR-003: Given a thousand-column table, When paging columns, Then no column is silently omitted', async () => {
    await withDatabase(fallback, `CREATE TABLE wide(${Array.from({ length: 1000 }, (_, index) => `c${String(index)} TEXT`).join(',')});`, async (engine) => {
      const first = await engine.columns('wide', { limit: 999 });
      expect(first.rows).toHaveLength(999);
      expect(first.hasMore).toBe(true);
      expect((await engine.columns('wide', { offset: 999, limit: 1 })).rows[0]?.[1]).toBe('c999');
      expect((await engine.columns('wide', { offset: 1000 })).rows).toEqual([]);
    });
  });

  test('FR-003: Given metadata beyond the byte budget, When reading columns, Then it fails explicitly without truncating and recovers', async () => {
    await withDatabase(fallback, `CREATE TABLE oversized(value TEXT DEFAULT '${'x'.repeat(MAX_PAGE_BYTES)}');`, async (engine) => {
      await expect(engine.columns('oversized')).rejects.toThrow('No value was truncated');
      expect((await engine.indexes('oversized')).rows).toEqual([]);
    });
  });

  test('FR-016: Given a read-only source, When inspecting metadata, rejecting writes and cancelling, Then source bytes and sidecars remain unchanged and reopening works', async () => {
    await withDatabase(fallback, definition, async (engine, path) => {
      const before = await hash(path);
      await engine.close();
      await chmod(path, 0o444);
      await engine.open(path);
      await engine.columns(table); await engine.indexes(table); await engine.indexColumns(table, 'unique 😀');
      await expect(engine.query('DELETE FROM sentinel')).rejects.toThrow('read-only');
      await engine.cancel();
      expect((await engine.columns(table)).rows).toHaveLength(6);
      await engine.close();
      expect(await hash(path)).toBe(before);
      expect(await readdir(join(path, '..'))).toEqual(['schema.sqlite']);
      await expect(engine.columns(table)).rejects.toThrow('First open');
      await engine.open(path);
      expect((await engine.indexes(table)).rows).toHaveLength(3);
    });
  });

  test('FR-001: Given an empty database, When listing and requesting an absent schema, Then the list is empty and missing metadata fails clearly', async () => {
    await withDatabase(fallback, 'VACUUM;', async (engine) => {
      expect(await engine.schema()).toMatchObject({ rows: [], hasMore: false });
      await expect(engine.columns('missing')).rejects.toThrow('schema object was not found');
    });
  });

  test('FR-003: Given a UNIQUE constraint and an invalid view, When inspecting schema, Then implicit indexes retain their origin and backend failures are actionable', async () => {
    await withDatabase(fallback, 'CREATE TABLE constrained(value TEXT UNIQUE); CREATE VIEW broken AS SELECT * FROM absent;', async (engine) => {
      const index = (await engine.indexes('constrained')).rows[0];
      expect(index).toEqual(['sqlite_autoindex_constrained_1', '1', 'u', '0', null]);
      expect((await engine.indexColumns('constrained', index?.[0] ?? '')).rows).toEqual([
        ['0', '0', 'value', '0', 'BINARY', '1'], ['1', '-1', null, '0', 'BINARY', '0'],
      ]);
      await expect(engine.columns('broken')).rejects.toThrow('The SQLite schema could not be read.');
      expect((await engine.columns('constrained')).rows).toHaveLength(1);
    });
  });

  test('FR-003: Given an in-flight metadata request, When another request or close occurs, Then overlap is rejected and closure settles the pending request', async () => {
    await withDatabase(fallback, definition, async (engine, path) => {
      const pending = engine.columns(table);
      const rejected = expect(pending).rejects.toThrow('closed');
      await expect(engine.indexes(table)).rejects.toThrow('already running');
      await engine.close();
      await rejected;
      await engine.open(path);
      expect((await engine.columns(table)).rows).toHaveLength(6);
    });
  });
});
