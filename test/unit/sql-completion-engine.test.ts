import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { beforeAll, expect, test } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import { findCompletions } from '../../src/editor/sql-completion';
import { SqliteBrowser } from '../../src/editor/sqlite-browser';
import type { BrowserResponse } from '../../src/protocol';

beforeAll(async () => {
  const built = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']);
  expect(built.stderr).toBe('');
}, 30000);

test.each([false, true])('FR-012: Given a real worker fallback=%s and wide schema, When completing filtered names and recovering, Then distant names, exact quoting and source safety survive', async (fallback) => {
  const directory = await mkdtemp(join(resolve('out'), 't026-unit-'));
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
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
}, 15000);
