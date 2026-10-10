import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, test } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import { FALLBACK_PROMPT_BYTES, MAX_PAGE_BYTES, type EngineMode } from '../../src/engine/engine';
import { selectBuiltin } from '../../src/engine/selection';

const fixture = resolve('test/fixtures/sample.sqlite');
const execute = promisify(execFile);
const hash = async (path: string): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');
const makeEngine = (forceFallback: boolean, workerPath = resolve('dist/db-worker.js'), directory = resolve('dist')): EngineClient =>
  new EngineClient({ directory, workerPath, forceFallback });

beforeAll(async () => {
  const { stderr } = await execute(process.execPath, ['esbuild.js', '--production']);
  expect(stderr).toBe('');
}, 30000);

test('FR-001: Given module detection, When selecting an engine, Then only built-in absence or the exact force flag selects fallback', () => {
  const native = { DatabaseSync };
  expect(selectBuiltin(() => native, undefined)).toBe(native);
  expect(selectBuiltin(() => native, '0')).toBe(native);
  expect(selectBuiltin(() => { throw new Error('must not load'); }, '1')).toBeUndefined();
  expect(selectBuiltin(() => { throw Object.assign(new Error('absent'), { code: 'ERR_UNKNOWN_BUILTIN_MODULE' }); }, undefined)).toBeUndefined();
  expect(() => selectBuiltin(() => { throw new Error('broken module'); }, undefined)).toThrow('broken module');
});

describe.each([false, true])('Production Engine, fallback=%s', (fallback) => {
  test('FR-001: Given ordinary names starting sqlite and a view, When schema is paged, Then no user table or view is omitted', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-engine-schema-'));
    const path = join(directory, 'schema.sqlite');
    const writer = new DatabaseSync(path);
    writer.exec('CREATE TABLE sqliteX(value); INSERT INTO sqliteX VALUES(42); CREATE VIEW "quoted view" AS SELECT value FROM sqliteX;');
    writer.close();
    const engine = makeEngine(fallback);
    try {
      await engine.open(path);
      expect((await engine.schema()).rows.map((row) => row[1])).toEqual(['quoted view', 'sqliteX']);
      expect((await engine.page('quoted view')).rows).toEqual([['42']]);
    } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
  });
  test('FR-001: Given a valid database, When opened, Then both backends fulfill the common worker Engine contract', async () => {
    const engine = makeEngine(fallback);
    const modes: EngineMode[] = [];
    try {
      const opened = await engine.open(fixture, { onMode: (mode) => { modes.push(mode); } });
      expect(opened.engine).toBe(fallback ? 'sql.js' : 'node:sqlite');
      expect(opened.threadId).toBeGreaterThan(0);
      expect(opened.processId).not.toBe(process.pid);
      expect(opened.memoryLimited).toBe(fallback);
      expect(modes).toHaveLength(1);
      expect(modes[0]?.notice).toContain(fallback ? 'Memory-limited' : 'disk');
      const schema = await engine.schema({ limit: 2 });
      expect(schema.rows).toHaveLength(2);
      expect(schema.hasMore).toBe(true);
      expect((await engine.page('fidelity', { offset: 1, limit: 1 })).rows[0]?.[0]).toBe('-9223372036854775808');
      const result = await engine.query('SELECT integer_value, real_value, text_value FROM fidelity ORDER BY rowid');
      expect(result.rows).toEqual([
        ['9223372036854775807', '1e+300', null],
        ['-9223372036854775808', '1e-300', ''],
        ['9007199254740993', '-1e+300', 'NULL'],
      ]);
      expect((await engine.query('SELECT payload FROM records WHERE label = ?', ['BLOB record'])).rows).toEqual([['[BLOB 3 bytes]']]);
      expect((await engine.query('SELECT 1 AS duplicate, 2 AS duplicate')).rows).toEqual([['1', '2']]);
      expect((await engine.page('select')).rows).toEqual([['space', 'quoted', 'emoji', 'keyword']]);
    } finally { await engine.close(); }
  });

  test('FR-001: Given paged queries, When navigating beyond one page, Then every row remains reachable without loading all rows', async () => {
    const engine = makeEngine(fallback);
    const sql = 'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<259) SELECT x FROM n';
    try {
      await engine.open(fixture);
      const first = await engine.query(sql, [], { offset: 0, limit: 128 });
      const second = await engine.query(sql, [], { offset: 128, limit: 128 });
      const last = await engine.query(sql, [], { offset: 256, limit: 128 });
      expect(first.rows).toHaveLength(128);
      expect(first.hasMore).toBe(true);
      expect(second.rows[0]).toEqual(['129']);
      expect(second.hasMore).toBe(true);
      expect(last.rows).toEqual([['257'], ['258'], ['259']]);
      expect(last.hasMore).toBe(false);
      expect((await engine.query(sql, [], { offset: 259 })).rows).toEqual([]);
      expect(await engine.query('SELECT 1 AS value WHERE 0')).toMatchObject({ columns: ['value'], rows: [], hasMore: false });
      for (const page of [{ limit: 0 }, { limit: 1001 }, { offset: -1 }, { offset: 0.5 }]) {
        await expect(engine.query('SELECT 1', [], page)).rejects.toThrow('page');
      }
    } finally { await engine.close(); }
  });

  test('NFR-001: Given untrusted SQL and identifiers, When querying, Then source bytes and read-only settings remain intact', async () => {
    const engine = makeEngine(fallback);
    const before = await hash(fixture);
    try {
      await engine.open(fixture);
      for (const sql of ['DELETE FROM records', 'WITH n AS (SELECT 1) DELETE FROM records', 'PRAGMA query_only=OFF', "ATTACH DATABASE 'bad.sqlite' AS bad", 'SELECT 1; DELETE FROM records', "SELECT load_extension('bad')"]) {
        await expect(engine.query(sql)).rejects.toThrow();
      }
      await expect(engine.page('records"; DELETE FROM records; --')).rejects.toThrow();
      expect((await engine.query('SELECT ? AS text', ["'; DELETE FROM records; --"])).rows).toEqual([["'; DELETE FROM records; --"]]);
      expect((await engine.query("/* comment */ SELECT ';' AS value; -- trailing comment")).rows).toEqual([[';']]);
      await expect(engine.query('SELECT ?', [9007199254740992])).rejects.toThrow('exact');
      expect((await engine.query('SELECT count(*) FROM records')).rows).toEqual([['1']]);
    } finally { await engine.close(); }
    expect(await hash(fixture)).toBe(before);
  });

  test('FR-001: Given an EXPLAIN of a preparation-time PRAGMA, When queried, Then safety settings cannot be changed', async () => {
    const engine = makeEngine(fallback);
    try {
      await engine.open(fixture);
      for (const sql of ['EXPLAIN PRAGMA query_only=OFF', 'EXPLAIN /* comment */ PRAGMA trusted_schema=ON', 'EXPLAIN QUERY PLAN PRAGMA query_only=OFF']) {
        await expect(engine.query(sql)).rejects.toThrow('read');
      }
      await expect(engine.query('WITH n AS (SELECT 1) DELETE FROM records')).rejects.toThrow();
      expect((await engine.query('SELECT count(*) FROM records')).rows).toEqual([['1']]);
      expect((await engine.query('EXPLAIN SELECT 1')).rows.length).toBeGreaterThan(0);
      expect((await engine.query('EXPLAIN QUERY PLAN SELECT * FROM records')).rows.length).toBeGreaterThan(0);
    } finally { await engine.close(); }
  });

  test('FR-001: Given large cells and wide tables, When paging, Then values are complete or the payload limit is explicit', async () => {
    const engine = makeEngine(fallback);
    try {
      await engine.open(fixture);
      const text = 'x'.repeat(1_048_577);
      expect((await engine.query('SELECT ? AS value', [text])).rows).toEqual([[text]]);
      const wide = await engine.query(`SELECT ${Array.from({ length: 1000 }, (_, index) => `${String(index)} AS c${String(index)}`).join(',')}`);
      expect(wide.columns).toHaveLength(1000);
      expect(wide.rows[0]).toHaveLength(1000);
      const overhead = Buffer.byteLength(JSON.stringify({ columns: ['value'], rows: [['']], hasMore: false }));
      const boundary = 'x'.repeat(MAX_PAGE_BYTES - overhead);
      expect(Buffer.byteLength(JSON.stringify(await engine.query('SELECT ? AS value', [boundary])))).toBe(MAX_PAGE_BYTES);
      await expect(engine.query('SELECT ? AS value', [`${boundary}x`])).rejects.toThrow('page');
      expect((await engine.query('SELECT 1')).rows).toEqual([['1']]);
    } finally { await engine.close(); }
  }, 15000);

  test.each(['corrupt.sqlite', 'truncated.sqlite', 'zero-byte.sqlite', 'missing.sqlite'])('FR-001: Given %s, When opened, Then a clear error permits recovery without changing engines', async (name) => {
    const engine = makeEngine(fallback);
    try {
      await expect(engine.open(resolve('test/fixtures', name))).rejects.toThrow('open');
      expect((await engine.open(fixture)).engine).toBe(fallback ? 'sql.js' : 'node:sqlite');
      await expect(engine.query('SELECT FROM')).rejects.toThrow('query');
      expect((await engine.query('SELECT 1')).rows).toEqual([['1']]);
    } finally { await engine.close(); }
  });

  test('FR-001: Given a database with no tables, When opened, Then schema is empty rather than an error', async () => {
    const engine = makeEngine(fallback);
    try {
      await engine.open(resolve('test/fixtures/empty.sqlite'));
      expect((await engine.schema()).rows).toEqual([]);
    } finally { await engine.close(); }
  });

  test('FR-001: Given an executing query, When cancelled, Then the helper exits and the same Engine reopens safely', async () => {
    const engine = makeEngine(fallback);
    try {
      const opened = await engine.open(fixture);
      let started!: () => void;
      const running = new Promise<void>((resolveStarted) => { started = resolveStarted; });
      const query = engine.query('WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<20000000) SELECT sum(x) FROM n', [], {}, started);
      const rejected = expect(query).rejects.toThrow('cancelled');
      await running;
      await new Promise<void>((resolveTick) => setTimeout(resolveTick, 150));
      await engine.cancel();
      await rejected;
      expect(() => process.kill(opened.processId, 0)).toThrow();
      expect((await engine.query('SELECT 42')).rows).toEqual([['42']]);
    } finally { await engine.close(); }
  }, 15000);

  test('FR-001: Given a helper crash during a query, When it exits, Then the error settles and immediate reopening recovers', async () => {
    const engine = makeEngine(fallback);
    try {
      const opened = await engine.open(fixture);
      let started!: () => void;
      const running = new Promise<void>((resolveStarted) => { started = resolveStarted; });
      const query = engine.query('WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<20000000) SELECT sum(x) FROM n', [], {}, started);
      const rejected = expect(query).rejects.toThrow('stopped');
      await running;
      process.kill(opened.processId, 'SIGKILL');
      await rejected;
      await engine.open(fixture);
      expect((await engine.query('SELECT 42')).rows).toEqual([['42']]);
    } finally { await engine.close(); }
  });

  test('FR-001: Given an executing query and repeated cancellation, When both cancellations finish, Then one recovery leaves the Engine usable', async () => {
    const engine = makeEngine(fallback);
    try {
      const opened = await engine.open(fixture);
      let started!: () => void;
      const running = new Promise<void>((resolveStarted) => { started = resolveStarted; });
      const query = engine.query('WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<20000000) SELECT sum(x) FROM n', [], {}, started);
      const rejected = expect(query).rejects.toThrow('cancelled');
      await running;
      await Promise.all([engine.cancel(), engine.cancel(), rejected]);
      expect(() => process.kill(opened.processId, 0)).toThrow();
      expect((await engine.query('SELECT 42')).rows).toEqual([['42']]);
    } finally { await engine.close(); }
  });

  test('FR-001: Given a cancellation in progress, When the database is explicitly closed, Then recovery does not reopen it', async () => {
    const engine = makeEngine(fallback);
    const opened = await engine.open(fixture);
    try {
      await Promise.all([engine.cancel(), engine.close()]);
      expect(() => process.kill(opened.processId, 0)).toThrow();
      await expect(engine.query('SELECT 42')).rejects.toThrow('open');
      await engine.open(fixture);
      expect((await engine.query('SELECT 42')).rows).toEqual([['42']]);
    } finally { await engine.close(); }
  });

  test('FR-001: Given a read-only source and two Engines, When querying then deleting it, Then source safety and clear failures persist', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-engine-readonly-'));
    const path = join(directory, 'source.sqlite');
    await writeFile(path, await readFile(fixture));
    await chmod(path, 0o444);
    const first = makeEngine(fallback);
    const second = makeEngine(fallback);
    try {
      const before = await hash(path);
      await Promise.all([first.open(path), second.open(path)]);
      expect((await first.query('SELECT count(*) FROM fidelity')).rows).toEqual([['3']]);
      expect((await second.query('SELECT count(*) FROM fidelity')).rows).toEqual([['3']]);
      await Promise.all([first.close(), second.close()]);
      expect(await hash(path)).toBe(before);
      await chmod(path, 0o666);
      await rm(path);
      await expect(first.open(path)).rejects.toThrow('open');
    } finally { await Promise.all([first.close(), second.close()]); await chmod(path, 0o666).catch(() => undefined); await rm(directory, { recursive: true, force: true }); }
  });
});

test('FR-001: Given a large fallback input, When consent is refused, Then it is not read into memory and opening another file works', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-consent-'));
  const path = join(directory, 'large.sqlite');
  await writeFile(path, await readFile(fixture));
  await truncate(path, FALLBACK_PROMPT_BYTES + 1);
  const engine = makeEngine(true);
  let asked = false;
  try {
    await expect(engine.open(path, { confirmLargeFile: (mode) => {
      asked = true;
      expect(mode.bytes).toBe(String(FALLBACK_PROMPT_BYTES + 1));
      return Promise.resolve(false);
    } })).rejects.toThrow('not loaded');
    expect(asked).toBe(true);
    await expect(engine.open(path)).rejects.toThrow('consent');
    await engine.open(fixture);
    expect((await engine.query('SELECT 1')).rows).toEqual([['1']]);
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test('FR-001: Given consent for a large fallback file, When it changes before loading, Then the changed snapshot is rejected', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-consent-race-'));
  const path = join(directory, 'large.sqlite');
  await writeFile(path, await readFile(fixture));
  await truncate(path, FALLBACK_PROMPT_BYTES + 1);
  const engine = makeEngine(true);
  try {
    await expect(engine.open(path, { confirmLargeFile: async () => {
      await truncate(path, 28672);
      return true;
    } })).rejects.toThrow('changed');
    await engine.open(path);
    expect((await engine.query('SELECT 1')).rows).toEqual([['1']]);
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test('FR-001: Given pending consent, When the Engine is closed, Then opening settles without waiting for the prompt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-consent-close-'));
  const path = join(directory, 'large.sqlite');
  await writeFile(path, await readFile(fixture));
  await truncate(path, FALLBACK_PROMPT_BYTES + 1);
  const engine = makeEngine(true);
  let requested!: () => void;
  const prompt = new Promise<void>((resolvePrompt) => { requested = resolvePrompt; });
  let approve!: (value: boolean) => void;
  const opening = engine.open(path, { confirmLargeFile: () => { requested(); return new Promise((resolveChoice) => { approve = resolveChoice; }); } });
  const rejected = expect(opening).rejects.toThrow('closed');
  try {
    await prompt;
    await engine.close();
    await rejected;
    approve(true);
    await engine.open(fixture);
    expect((await engine.query('SELECT 1')).rows).toEqual([['1']]);
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test.each(['-wal', '-journal'])('FR-001: Given a fallback %s sidecar, When opened, Then an incomplete snapshot is rejected without modification', async (suffix) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-engine-journal-'));
  const path = join(directory, 'source.sqlite');
  await writeFile(path, await readFile(fixture));
  await writeFile(`${path}${suffix}`, 'writer state');
  const before = [await hash(path), await hash(`${path}${suffix}`)];
  const engine = makeEngine(true);
  try {
    await expect(engine.open(path)).rejects.toThrow(/WAL|journal/);
    expect([await hash(path), await hash(`${path}${suffix}`)]).toEqual(before);
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test('FR-001: Given explicit consent for a file above 200 MB, When opened in fallback, Then the real sql.js engine loads and queries it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-engine-approved-'));
  const path = join(directory, 'large.sqlite');
  await writeFile(path, await readFile(fixture));
  await truncate(path, FALLBACK_PROMPT_BYTES + 1);
  const engine = makeEngine(true);
  let prompts = 0;
  try {
    const opened = await engine.open(path, { confirmLargeFile: () => { prompts++; return Promise.resolve(true); } });
    expect(opened.engine).toBe('sql.js');
    expect(opened.needsConsent).toBe(true);
    expect(prompts).toBe(1);
    expect((await engine.query('SELECT integer_value FROM fidelity ORDER BY rowid')).rows[0]).toEqual(['9223372036854775807']);
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
}, 30000);

test('FR-001: Given an unavailable built-in resolved at runtime, When opening, Then the real worker automatically selects fallback', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-engine-absence-'));
  const worker = join(directory, 'absence.cjs');
  await writeFile(worker, `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function(name, ...args) {
      return load.call(this, name === 'node:sqlite' ? 'node:lite-voyager-missing-sqlite' : name, ...args);
    };
    require(${JSON.stringify(resolve('dist/db-worker.js'))});
  `);
  const engine = makeEngine(false, worker);
  try {
    expect((await engine.open(fixture)).engine).toBe('sql.js');
    expect((await engine.query('SELECT 1')).rows).toEqual([['1']]);
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test.each(['journal', 'change'])('NFR-001: Given a %s during fallback reading, When loading completes, Then the inconsistent snapshot is rejected', async (race) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-engine-snapshot-'));
  const path = join(directory, 'source.sqlite');
  const worker = join(directory, 'race.cjs');
  await writeFile(path, await readFile(fixture));
  await writeFile(worker, `
    const fs = require('node:fs');
    const { workerData } = require('node:worker_threads');
    const read = fs.readSync;
    let changed = false;
    fs.readSync = (...args) => {
      const bytes = read(...args);
      if (!changed && args[1].length > 100) {
        changed = true;
        if (${JSON.stringify(race)} === 'journal') fs.writeFileSync(workerData.path + '-journal', 'writer started');
        else {
          const modified = fs.statSync(workerData.path).mtime;
          fs.utimesSync(workerData.path, modified, new Date(modified.getTime() + 5000));
        }
      }
      return bytes;
    };
    require(${JSON.stringify(resolve('dist/db-worker.js'))});
  `);
  const engine = makeEngine(true, worker);
  try { await expect(engine.open(path)).rejects.toThrow(/journal|changed/); }
  finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test('FR-001: Given a checkpointed WAL database with no sidecars, When fallback opens it, Then it explicitly rejects the unsupported mode', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-engine-wal-header-'));
  const path = join(directory, 'source.sqlite');
  const writer = new DatabaseSync(path);
  writer.exec('PRAGMA journal_mode=WAL; CREATE TABLE records(value); INSERT INTO records VALUES(1);');
  writer.close();
  const engine = makeEngine(true);
  try { await expect(engine.open(path)).rejects.toThrow('WAL'); }
  finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});
