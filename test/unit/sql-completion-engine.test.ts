import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { beforeAll, expect, test } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { EngineClient } from '../../src/engine/engine-client';
import { findCompletions } from '../../src/editor/sql-completion';
import { SqliteBrowser } from '../../src/editor/sqlite-browser';
import type { BrowserResponse } from '../../src/protocol';
import { completionContext } from '../../webview/sql-completion';

beforeAll(async () => {
  const built = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']);
  expect(built.stderr).toBe('');
}, 30000);

test.each([false, true])('FR-012: Given Unicode aliases in a real worker fallback=%s, When accepting qualified column suggestions, Then every offered identifier executes against its exact table without changing the source', async (fallback) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t026-unicode-')); const path = join(directory, 'schema.sqlite');
  const writer = new DatabaseSync(path);
  try { writer.exec("BEGIN; CREATE TABLE upper_table(first_upper); INSERT INTO upper_table VALUES('upper'); CREATE TABLE lower_table(first_lower); INSERT INTO lower_table VALUES('lower'); COMMIT;"); }
  finally { writer.close(); }
  const digest = async (): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');
  const before = await digest(); const engine = new EngineClient({ directory: resolve('dist'), forceFallback: fallback });
  try {
    await engine.open(path);
    for (const scenario of [
      { qualifier: 'Ä', from: 'upper_table AS "Ä" JOIN lower_table AS "ä" ON 1', table: 'upper_table', field: 'first_upper', value: 'upper' },
      { qualifier: 'ä', from: 'upper_table AS "Ä" JOIN lower_table AS "ä" ON 1', table: 'lower_table', field: 'first_lower', value: 'lower' },
      { qualifier: 'ſelect', from: 'upper_table AS ſelect', table: 'upper_table', field: 'first_upper', value: 'upper' },
      { qualifier: 'mixed', from: 'upper_table AS MiXeD', table: 'upper_table', field: 'first_upper', value: 'upper' },
      { qualifier: 'AS', from: 'upper_table "AS"', table: 'upper_table', field: 'first_upper', value: 'upper' },
      { qualifier: '.', from: 'upper_table "."', table: 'upper_table', field: 'first_upper', value: 'upper' },
    ]) {
      const sql = `SELECT "${scenario.qualifier}".fi FROM ${scenario.from}`;
      const search = completionContext(new CompletionContext(EditorState.create({ doc: sql }), sql.indexOf('.fi') + 3, true));
      if (search === null) { throw new Error('Missing Unicode alias completion context'); }
      const suggestions = await findCompletions(engine, search);
      expect(suggestions.items).toEqual([{ name: scenario.field, table: scenario.table, kind: 'column' }]);
      const name = suggestions.items[0]?.name; if (name === undefined) { throw new Error('Missing suggested identifier'); }
      const page = await engine.query(`SELECT "${scenario.qualifier}"."${name.replaceAll('"', '""')}" FROM ${scenario.from}`, [], { limit: 1 });
      expect(page.rows).toEqual([[scenario.value]]);
    }
    await engine.close(); expect(await digest()).toBe(before);
  } finally { await engine.close(); expect(dirname(directory)).toBe(resolve(tmpdir())); await rm(directory, { recursive: true, force: true }); }
}, 15000);

test.each([false, true])('FR-012: Given a real worker fallback=%s and wide schema, When completing filtered names and recovering, Then distant names, exact quoting and source safety survive', async (fallback) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t026-unit-'));
  const path = join(directory, 'schema.sqlite'); const writer = new DatabaseSync(path);
  try {
    writer.exec('BEGIN');
    for (let i = 0; i < 125; i++) { writer.exec(`CREATE TABLE t${String(i).padStart(3, '0')}(id)`); }
    writer.exec(`CREATE TABLE "select" (${Array.from({ length: 1000 }, (_, i) => `c${String(i).padStart(4, '0')}`).join(',')}, "quote""name", "😀", "__proto__")`);
    writer.exec('CREATE VIEW "view name" AS SELECT "quote""name" FROM "select"; CREATE VIEW broken AS SELECT * FROM missing_table; CREATE TABLE pragma_table_xinfo(dummy); COMMIT');
  } finally { writer.close(); }
  const digest = async (): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');
  const before = await digest(); const engine = new EngineClient({ directory: resolve('dist'), forceFallback: fallback });
  try {
    await engine.open(path);
    expect((await findCompletions(engine, { prefix: 't124', tables: [], includeTables: true })).items).toEqual([{ name: 't124', kind: 'table', table: '' }]);
    expect((await findCompletions(engine, { prefix: '', tables: [], includeTables: true })).hasMore).toBe(true);
    expect((await findCompletions(engine, { prefix: 'c0999', tables: ['select'], includeTables: false })).items[0]?.name).toBe('c0999');
    for (const name of ['quote"name', '😀', '__proto__']) {
      expect((await findCompletions(engine, { prefix: name, tables: ['select'], includeTables: false })).items[0]?.name).toBe(name);
    }
    expect((await findCompletions(engine, { prefix: 'quote', tables: ['view name'], includeTables: false })).items[0]?.table).toBe('view name');
    expect((await findCompletions(engine, { prefix: "%' OR 1=1 --", tables: ['select'], includeTables: true })).items).toEqual([]);
    const browser = new SqliteBrowser(engine); const sent: BrowserResponse[] = [];
    await browser.handle({ type: 'browserQuery', requestId: 1, sql: 'SELECT 9223372036854775807', offset: 0, limit: 1 }, (message) => sent.push(message));
    await browser.handle({ type: 'browserComplete', requestId: 2, prefix: 'view', tables: [], includeTables: true }, (message) => sent.push(message));
    expect(sent.at(-1)).toMatchObject({ type: 'browserCompletions', items: [{ kind: 'view', name: 'view name' }] });
    await browser.handle({ type: 'browserComplete', requestId: 3, prefix: '', tables: ['broken'], includeTables: false }, (message) => sent.push(message));
    expect(sent.at(-1)).toMatchObject({ type: 'browserError' });
    let exported = '';
    browser.setExporter({ run: (sql) => { exported = sql; return Promise.resolve(undefined); }, abort: () => {}, settled: () => Promise.resolve() });
    await browser.handle({ type: 'browserExport', requestId: 4, format: 'csv' }, (message) => sent.push(message));
    expect(exported).toBe('SELECT 9223372036854775807');
    browser.dispose(); await engine.cancel();
    expect((await findCompletions(engine, { prefix: 'missing', tables: [], includeTables: true })).items).toEqual([]);
    await engine.close(); expect(await digest()).toBe(before);
  } finally { await engine.close(); expect(dirname(directory)).toBe(resolve(tmpdir())); await rm(directory, { recursive: true, force: true }); }
}, 15000);
