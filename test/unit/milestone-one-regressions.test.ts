import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { NodeSqliteEngine } from '../../src/engine/node-sqlite';
import { checkReadStatement, collectPage, quoteIdentifier } from '../../src/engine/read-engine';
import { isBrowserRequest, isBrowserResponse, isGridOptions } from '../../src/protocol';
import { QueryView } from '../../webview/query-view';

test('FR-002: Given legal empty SQLite identifiers, When validating and quoting them, Then tables and blank-column controls remain reachable while empty SQL and NUL identifiers fail', () => {
  expect(quoteIdentifier('')).toBe('""');
  expect(isBrowserResponse({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: '', kind: 'table' }, { name: 'ordinary', kind: 'table' }], hasMore: false })).toBe(true);
  expect(isBrowserRequest({ type: 'browserPage', requestId: 2, table: '', offset: 0, limit: 100 })).toBe(true);
  expect(isGridOptions({ filters: [{ column: '', operator: 'contains', value: 'x' }] })).toBe(true);
  expect(isBrowserRequest({ type: 'browserQuery', requestId: 2, sql: '', offset: 0, limit: 100 })).toBe(false);
  expect(() => quoteIdentifier('\0')).toThrow();
});

test('FR-016: Given WITH-prefixed writes, When validating before native text wrapping, Then the main write verb is refused while CTE names, nested reads and VALUES remain allowed', () => {
  for (const verb of ['DELETE FROM data', 'UPDATE data SET v=1', 'INSERT INTO data VALUES(1)', 'REPLACE INTO data VALUES(1)']) {
    for (const returning of ['', ' RETURNING v']) {
      expect(() => checkReadStatement(`WITH n(x) AS (VALUES(1)) ${verb}${returning}`)).toThrow(/read-only/u);
    }
  }
  for (const sql of [
    'WITH replace(v) AS (VALUES(1)) SELECT v FROM replace',
    'WITH n(delete_me) AS NOT MATERIALIZED (SELECT 1), replace(v) AS (SELECT delete_me FROM n) SELECT v FROM replace',
    'WITH n(v) AS (WITH nested(x) AS (SELECT 1) SELECT x FROM nested) VALUES(1)',
    'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<3) SELECT x FROM n',
    'EXPLAIN QUERY PLAN WITH "DELETE"(v) AS (SELECT \'UPDATE\') SELECT v FROM "DELETE"',
  ]) { expect(() => checkReadStatement(sql)).not.toThrow(); }
  // Invalid CTE grammar belongs to SQLite's syntax diagnostic, rather than a
  // fabricated write classification from merely closing a column-name list.
  for (const sql of ['WITH n(x) DELETE FROM data', 'WITH n AS nonsense(SELECT 1) DELETE FROM data']) {
    expect(() => checkReadStatement(sql)).not.toThrow();
  }
});

test('FR-011: Given a rerun exhausted before the requested offset, When committing its final page, Then the observed count or honest unknown replaces an invented offset total', () => {
  const cursor = { columns: ['x'], rows: Array.from({ length: 50 }, () => ['x']), close: () => {} };
  const page = collectPage(cursor, { offset: 100, limit: 100 });
  const view = new QueryView(); view.commit('SELECT x FROM data', 100, page, 1);
  expect(view.count).toBe('50'); expect(view.summary).not.toContain('Total rows: 100');
  view.commit('SELECT x FROM data', 100, { columns: ['x'], rows: [], hasMore: false }, 1);
  expect(view.count).toBeNull(); expect(view.summary).toContain('not yet known');
});

test.each(['UTF-8', 'UTF-16le', 'UTF-16be'])('FR-018: Given native %s storage, When reading text, Then malformed encoding fails and NUL, BOM and literal replacement characters remain exact', async (encoding) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t019-text-')); const path = join(directory, 'source.sqlite');
  const writer = new DatabaseSync(path); writer.exec(`PRAGMA encoding='${encoding}'; CREATE TABLE data(v TEXT)`); writer.close();
  const backend = new NodeSqliteEngine({ DatabaseSync } as typeof import('node:sqlite'), path);
  try {
    const bad = encoding === 'UTF-8' ? '80' : encoding === 'UTF-16le' ? '00D8' : 'D800';
    expect(() => collectPage(backend.cursor(`SELECT CAST(x'${bad}' AS TEXT)`, []), { limit: 1 })).toThrow(/not valid/);
    const page = collectPage(backend.cursor("SELECT char(65279)||'before'||char(0)||'after'||char(65533) AS same, 9223372036854775807 AS same, zeroblob(3)", []), { limit: 1 });
    expect(page.columns.slice(0, 2)).toEqual(['same', 'same']);
    expect(page.rows).toEqual([['\uFEFFbefore\0after\uFFFD', '9223372036854775807', '[BLOB 3 bytes]']]);
  } finally { backend.close(); await rm(directory, { recursive: true, force: true }); }
});

test('FR-018: Given native nondeterministic mixed-type expressions, When streaming a page, Then each row is evaluated once and aliases and bound data stay exact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t019-once-')); const path = join(directory, 'source.sqlite');
  const writer = new DatabaseSync(path); writer.exec('CREATE TABLE data(v);'); writer.close();
  let calls = 0;
  class CountingDatabase extends DatabaseSync {
    constructor(databasePath: string, options?: import('node:sqlite').DatabaseSyncOptions) {
      super(databasePath, options); this.function('next_value', () => (++calls % 2 === 0 ? 'text' : calls));
    }
  }
  const backend = new NodeSqliteEngine({ DatabaseSync: CountingDatabase } as typeof import('node:sqlite'), path);
  try {
    const page = collectPage(backend.cursor('WITH n(x) AS (VALUES(1),(2),(3)) SELECT next_value() AS "", ? AS "" FROM n; -- trailing comment', ['bound\0data']), { limit: 3 });
    expect(page.columns).toEqual(['', '']); expect(calls).toBe(3);
    expect(page.rows).toEqual([['1', 'bound\0data'], ['text', 'bound\0data'], ['3', 'bound\0data']]);
  } finally { backend.close(); await rm(directory, { recursive: true, force: true }); }
});
