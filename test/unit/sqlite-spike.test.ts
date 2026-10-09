import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, test } from 'vitest';
import { SqliteSpike } from '../../src/worker/sqlite-spike';

const execute = promisify(execFile);
const fixture = resolve('test/fixtures/sample.sqlite');
const longQuery = 'WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<20000000) SELECT sum(x) FROM n';
const hash = async (path: string): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');

beforeAll(async () => {
  const { stderr } = await execute(process.execPath, ['esbuild.js', '--production']);
  expect(stderr).toBe('');
}, 30000);

describe.each([false, true])('SQLite spike, missing built-in = %s', (simulateUnavailable) => {
  const makeSpike = (): SqliteSpike => new SqliteSpike(resolve('dist/sqlite-spike-worker.js'), {
    simulateUnavailable, fallbackDirectory: resolve('dist'),
  });

  test('NFR-002: Given a fixture, When opened in a worker, Then the selected real engine queries exact values', async () => {
    const spike = makeSpike();
    try {
      const opened = await spike.open(fixture);
      expect(opened.engine).toBe(simulateUnavailable ? 'sql.js' : 'node:sqlite');
      expect(opened.threadId).toBeGreaterThan(0);
      expect(opened.processId).not.toBe(process.pid);
      expect(opened.memoryLimited).toBe(simulateUnavailable);
      expect(opened.notice).toContain(simulateUnavailable ? 'Memory-limited' : 'disk');
      const result = await spike.query('SELECT integer_value, real_value, text_value FROM fidelity ORDER BY rowid');
      expect(result.rows).toEqual([
        ['9223372036854775807', '1e+300', null],
        ['-9223372036854775808', '1e-300', ''],
        ['9007199254740993', '-1e+300', 'NULL'],
      ]);
      expect((await spike.query('SELECT payload FROM records WHERE label = ?', ['BLOB record'])).rows).toEqual([['[BLOB 3 bytes]']]);
      expect((await spike.query('SELECT "first name", "quote""name", "😀", "order" FROM "select"')).rows).toEqual([['space', 'quoted', 'emoji', 'keyword']]);
      expect((await spike.query('SELECT 1 AS duplicate, 2 AS duplicate')).rows).toEqual([['1', '2']]);
    } finally { await spike.close(); }
  });

  test('NFR-001: Given a source file, When querying or attempting a write, Then its bytes remain unchanged', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-spike-'));
    const path = join(directory, 'source.sqlite');
    await writeFile(path, await readFile(fixture));
    const before = await hash(path);
    const spike = makeSpike();
    try {
      await spike.open(path);
      await spike.query('SELECT * FROM records');
      await expect(spike.query('DELETE FROM records')).rejects.toThrow('read');
      expect((await spike.query('SELECT count(*) FROM records')).rows).toEqual([['1']]);
    } finally { await spike.close(); }
    try { expect(await hash(path)).toBe(before); }
    finally { await rm(directory, { recursive: true, force: true }); }
  });

  test('NFR-001: Given committed WAL rows, When opened, Then native reads all rows and fallback rejects without changing source bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-spike-wal-'));
    const path = join(directory, 'source.sqlite');
    const writer = new DatabaseSync(path);
    const spike = makeSpike();
    try {
      writer.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE records(value); INSERT INTO records VALUES(1); PRAGMA wal_checkpoint(TRUNCATE); INSERT INTO records VALUES(2);');
      expect((await readFile(`${path}-wal`)).length).toBeGreaterThan(0);
      const before = [await hash(path), await hash(`${path}-wal`)];
      if (simulateUnavailable) {
        await expect(spike.open(path)).rejects.toThrow('WAL');
        await spike.open(fixture);
        expect((await spike.query('SELECT 1')).rows).toEqual([['1']]);
      } else {
        await spike.open(path);
        expect((await spike.query('SELECT value FROM records ORDER BY value')).rows).toEqual([['1'], ['2']]);
      }
      await spike.close();
      expect([await hash(path), await hash(`${path}-wal`)]).toEqual(before);
    } finally { await spike.close(); writer.close(); await rm(directory, { recursive: true, force: true }); }
  });

  test('NFR-009: Given an untrusted database, When opened, Then trusted schema and extension loading are disabled', async () => {
    const spike = makeSpike();
    try {
      const opened = await spike.open(fixture);
      expect(opened.trustedSchemaOff).toBe(true);
      expect(opened.extensionLoadingDisabled).toBe(true);
      await expect(spike.query("SELECT load_extension('not-a-real-extension')")).rejects.toThrow();
      expect((await spike.query('SELECT 1')).rows).toEqual([['1']]);
    } finally { await spike.close(); }
  });

  test('FR-015: Given a running query, When cancelled, Then the host responds and a fresh worker can query again', async () => {
    const spike = makeSpike();
    try {
      const opened = await spike.open(fixture);
      let started!: () => void;
      const running = new Promise<void>((resolveStarted) => { started = resolveStarted; });
      const query = spike.query(longQuery, [], started);
      const rejected = expect(query).rejects.toThrow('cancelled');
      await running;
      // Leave enough time to enter SQLite's native execution, not just queue a request.
      await new Promise<void>((resolveTick) => setTimeout(resolveTick, 150));
      const cancelStarted = Date.now();
      await spike.cancel();
      await rejected;
      expect(Date.now() - cancelStarted).toBeLessThan(1000);
      expect(() => process.kill(opened.processId, 0)).toThrow();
      await spike.open(fixture);
      expect((await spike.query('SELECT 42')).rows).toEqual([['42']]);
    } finally { await spike.close(); }
  }, 15000);

  test('NFR-005: Given many result rows, When queried, Then only one bounded page is returned with an explicit continuation flag', async () => {
    const spike = makeSpike();
    try {
      await spike.open(fixture);
      const result = await spike.query('WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<101) SELECT x FROM n');
      expect(result.rows).toHaveLength(100);
      expect(result.hasMore).toBe(true);
      expect((await spike.query('SELECT 1 WHERE 0')).rows).toEqual([]);
      await expect(spike.query("SELECT printf('%300000s', 'x')")).rejects.toThrow('page');
    } finally { await spike.close(); }
  });

  test('NFR-005: Given a result at the payload boundary, When queried, Then the complete serialized page fits 256 KiB or fails explicitly', async () => {
    const spike = makeSpike();
    const emptyPageBytes = Buffer.byteLength(JSON.stringify({ columns: ['value'], rows: [['']], hasMore: false }));
    const value = 'x'.repeat(256 * 1024 - emptyPageBytes);
    try {
      await spike.open(fixture);
      const result = await spike.query('SELECT ? AS value', [value]);
      expect(Buffer.byteLength(JSON.stringify(result))).toBe(256 * 1024);
      await expect(spike.query('SELECT ? AS value', [`${value}x`]).then((page) => Buffer.byteLength(JSON.stringify(page)))).rejects.toThrow('page');
      expect((await spike.query('SELECT 1')).rows).toEqual([['1']]);
    } finally { await spike.close(); }
  });

  test.each(['corrupt.sqlite', 'truncated.sqlite', 'zero-byte.sqlite', 'does-not-exist.sqlite'])('NFR-002: Given %s, When opened, Then it fails clearly without falling back on database errors', async (name) => {
    const spike = makeSpike();
    try {
      await expect(spike.open(resolve('test/fixtures', name))).rejects.toThrow('open');
      await spike.open(fixture);
      expect((await spike.query('SELECT 1')).rows).toEqual([['1']]);
    } finally { await spike.close(); }
  });

  test('NFR-002: Given an empty database, When queried, Then an empty result retains its column metadata', async () => {
    const spike = makeSpike();
    try {
      await spike.open(resolve('test/fixtures/empty.sqlite'));
      expect(await spike.query('SELECT name FROM sqlite_schema WHERE type = ?', ['table'])).toMatchObject({ columns: ['name'], rows: [], hasMore: false });
      await expect(spike.query('SELECT FROM')).rejects.toThrow('query');
      await expect(spike.query('SELECT 1; SELECT 2')).rejects.toThrow('one');
      expect((await spike.query("/* leading comment */ SELECT ';' AS value; -- trailing comment")).rows).toEqual([[';']]);
      await expect(spike.query('PRAGMA query_only=OFF')).rejects.toThrow('read');
      await expect(spike.query("ATTACH DATABASE 'other.sqlite' AS other")).rejects.toThrow('read');
    } finally { await spike.close(); }
  });
});

test('NFR-005: Given cancellation during opening, When close overlaps it, Then both settle and reopening is safe', async () => {
  const spike = new SqliteSpike(resolve('dist/sqlite-spike-worker.js'), { fallbackDirectory: resolve('dist') });
  const opening = spike.open(fixture);
  const rejected = expect(opening).rejects.toThrow('cancelled');
  await Promise.all([spike.cancel(), spike.close(), rejected]);
  try { await spike.open(fixture); expect((await spike.query('SELECT 1')).rows).toEqual([['1']]); }
  finally { await spike.close(); }
});

test('NFR-005: Given a helper crash during a running query, When it exits, Then the query fails and a new helper can open', async () => {
  const spike = new SqliteSpike(resolve('dist/sqlite-spike-worker.js'), { fallbackDirectory: resolve('dist') });
  try {
    const opened = await spike.open(fixture);
    let started!: () => void;
    const running = new Promise<void>((resolveStarted) => { started = resolveStarted; });
    const query = spike.query(longQuery, [], started);
    const rejected = expect(query).rejects.toThrow('stopped');
    await running;
    process.kill(opened.processId, 'SIGKILL');
    await rejected;
    await spike.open(fixture);
    expect((await spike.query('SELECT 1')).rows).toEqual([['1']]);
  } finally { await spike.close(); }
});

test('NFR-002: Given an oversized fallback input, When opening, Then its explicit spike memory limit is reported before loading', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-spike-limit-'));
  const path = join(directory, 'large.sqlite');
  await writeFile(path, Buffer.alloc(8 * 1024 * 1024 + 1));
  const spike = new SqliteSpike(resolve('dist/sqlite-spike-worker.js'), { fallbackDirectory: resolve('dist'), simulateUnavailable: true });
  try { await expect(spike.open(path)).rejects.toThrow('8 MiB'); }
  finally { await spike.close(); await rm(directory, { recursive: true, force: true }); }
});

test('FR-016: Given a checkpointed WAL database without sidecars, When using fallback, Then WAL mode is explicitly rejected', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-spike-wal-header-'));
  const path = join(directory, 'source.sqlite');
  const writer = new DatabaseSync(path);
  writer.exec('PRAGMA journal_mode=WAL; CREATE TABLE records(value); INSERT INTO records VALUES(1);');
  writer.close();
  const spike = new SqliteSpike(resolve('dist/sqlite-spike-worker.js'), { fallbackDirectory: resolve('dist'), simulateUnavailable: true });
  try {
    expect((await readFile(path))[18]).toBe(2);
    await expect(readFile(`${path}-wal`)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(spike.open(path)).rejects.toThrow('WAL');
  } finally { await spike.close(); await rm(directory, { recursive: true, force: true }); }
});

test.each(['-wal', '-journal'])('NFR-001: Given a %s sidecar, When using fallback, Then it refuses an incomplete snapshot and preserves the files', async (suffix) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-spike-journal-'));
  const path = join(directory, 'source.sqlite');
  await writeFile(path, await readFile(fixture));
  await writeFile(`${path}${suffix}`, 'uncheckpointed state');
  const before = [await hash(path), await hash(`${path}${suffix}`)];
  const spike = new SqliteSpike(resolve('dist/sqlite-spike-worker.js'), { fallbackDirectory: resolve('dist'), simulateUnavailable: true });
  try {
    await expect(spike.open(path)).rejects.toThrow(/WAL|journal/);
    expect([await hash(path), await hash(`${path}${suffix}`)]).toEqual(before);
  } finally { await spike.close(); await rm(directory, { recursive: true, force: true }); }
});

test.each(['journal', 'change'])('NFR-001: Given a %s during fallback reading, When the read finishes, Then the unsafe snapshot is rejected', async (race) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-spike-snapshot-'));
  const path = join(directory, 'source.sqlite');
  const worker = join(directory, 'race.cjs');
  await writeFile(path, await readFile(fixture));
  await writeFile(worker, `
    const fs = require('node:fs');
    const { workerData } = require('node:worker_threads');
    const read = fs.readSync;
    let changed = false;
    fs.readSync = (...args) => {
      const result = read(...args);
      if (!changed && args[1].length > 100) {
        changed = true;
        if (${JSON.stringify(race)} === 'journal') {
          fs.writeFileSync(workerData.path + '-journal', 'writer started during read');
        } else {
          const modified = fs.statSync(workerData.path).mtime;
          fs.utimesSync(workerData.path, modified, new Date(modified.getTime() + 5000));
        }
      }
      return result;
    };
    require(${JSON.stringify(resolve('dist/sqlite-spike-worker.js'))});
  `);
  const spike = new SqliteSpike(worker, { fallbackDirectory: resolve('dist'), simulateUnavailable: true });
  try { await expect(spike.open(path)).rejects.toThrow(/journal|changed/); }
  finally { await spike.close(); await rm(directory, { recursive: true, force: true }); }
});

test('NFR-005: Given rejected result metadata or rows, When queries fail or stop paging, Then real sql.js statements are all freed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-spike-statement-'));
  const counter = join(directory, 'active-statements.txt');
  // Instrument the real packaged engine's prepare/free methods without a production test hook.
  await writeFile(join(directory, 'sqlite-spike-process.js'), await readFile(resolve('dist/sqlite-spike-process.js')));
  await writeFile(join(directory, 'sql-wasm.wasm'), await readFile(resolve('dist/sql-wasm.wasm')));
  await writeFile(join(directory, 'sql-wasm.cjs'), `
    const initialize = require(${JSON.stringify(resolve('dist/sql-wasm.cjs'))});
    const { writeFileSync } = require('node:fs');
    module.exports = async (options) => {
      const module = await initialize(options);
      const ActualDatabase = module.Database;
      module.Database = class extends ActualDatabase {
        active = 0;
        prepare(sql) {
          const statement = super.prepare(sql);
          this.active++;
          writeFileSync(${JSON.stringify(counter)}, String(this.active));
          const free = statement.free.bind(statement);
          statement.free = () => {
            const result = free();
            this.active--;
            writeFileSync(${JSON.stringify(counter)}, String(this.active));
            return result;
          };
          if (sql === 'SELECT 1 AS metadata_error') {
            statement.getColumnNames = () => { throw new Error('synthetic metadata failure'); };
          }
          if (sql === 'SELECT 1 AS bind_error') {
            statement.bind = () => { throw new Error('synthetic bind failure'); };
          }
          if (sql === 'SELECT 1 AS step_error') {
            statement.step = () => { throw new Error('synthetic step failure'); };
          }
          if (sql === 'SELECT 1 AS get_error') {
            statement.get = () => { throw new Error('synthetic row failure'); };
          }
          return statement;
        }
      };
      return module;
    };
  `);
  const spike = new SqliteSpike(resolve('dist/sqlite-spike-worker.js'), { fallbackDirectory: directory, simulateUnavailable: true });
  const active = async (): Promise<string> => readFile(counter, 'utf8');
  try {
    await spike.open(fixture);
    expect(await active()).toBe('0');
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(spike.query(`SELECT 1 AS "${'x'.repeat(300000)}"`)).rejects.toThrow('page');
      expect(await active()).toBe('0');
    }
    for (const sql of ['SELECT 1 AS metadata_error', 'SELECT 1 AS bind_error', 'SELECT 1 AS step_error', 'SELECT 1 AS get_error', "SELECT printf('%300000s', 'x')"]) {
      await expect(spike.query(sql)).rejects.toThrow();
      expect(await active()).toBe('0');
    }
    expect((await spike.query('SELECT 1')).rows).toEqual([['1']]);
    expect(await active()).toBe('0');
    expect((await spike.query('SELECT 1 WHERE 0')).rows).toEqual([]);
    expect(await active()).toBe('0');
    expect((await spike.query('WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<101) SELECT x FROM n')).hasMore).toBe(true);
    expect(await active()).toBe('0');
  } finally { await spike.close(); await rm(directory, { recursive: true, force: true }); }
});

test('NFR-005: Given a worker startup crash, When opening, Then the failure is reported and resources can be closed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-spike-crash-'));
  const worker = join(directory, 'crash.cjs');
  await writeFile(worker, "throw new Error('synthetic worker crash');");
  const spike = new SqliteSpike(worker, { fallbackDirectory: resolve('dist') });
  try { await expect(spike.open(fixture)).rejects.toThrow('worker'); }
  finally { await spike.close(); await rm(directory, { recursive: true, force: true }); }
});

test('NFR-005: Given a worker crash after opening, When querying, Then the failure settles and immediate reopening allows real recovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-spike-worker-crash-'));
  const worker = join(directory, 'crash.cjs');
  await writeFile(worker, `
    const { parentPort, workerData, threadId } = require('node:worker_threads');
    if (workerData.path === 'crash-first') {
      parentPort.postMessage({type:'opened',value:{engine:'node:sqlite',threadId,processId:process.pid,node:process.versions.node,sqlite:'synthetic',memoryLimited:false,notice:'synthetic',trustedSchemaOff:true,extensionLoadingDisabled:true}});
      parentPort.on('message', () => { throw new Error('synthetic worker crash'); });
    } else { require(${JSON.stringify(resolve('dist/sqlite-spike-worker.js'))}); }
  `);
  const spike = new SqliteSpike(worker, { fallbackDirectory: resolve('dist') });
  try {
    const crashed = await spike.open('crash-first');
    await expect(spike.query('SELECT 1')).rejects.toThrow('worker');
    await spike.open(fixture);
    expect(() => process.kill(crashed.processId, 0)).toThrow();
    expect((await spike.query('SELECT 1')).rows).toEqual([['1']]);
  } finally { await spike.close(); await rm(directory, { recursive: true, force: true }); }
});
