import { copyFile, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeAll, expect, test, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { EngineClient } from '../../src/engine/engine-client';
import { StagedEdits } from '../../src/staging/staged-edits';
import { editValue, type EditOperation } from '../../src/staging/edit-types';
import { recoverInterruptedSave, sourceVersion } from '../../src/staging/sqlite-edits';

beforeAll(async () => {
  const result = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']); expect(result.stderr).toBe('');
}, 30000);

test.each(['cancel', 'close'] as const)('FR-020: Given an in-place Save with confirmed disk spill and a hot journal, When using %s, Then SQLite restores the original bytes and the reader reopens without replaying the queue', async (action) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-hot-journal-')); const parent = join(directory, 'real'); await mkdir(parent); const path = join(parent, 'source.sqlite');
  // Windows cannot create file symlinks without an extra OS privilege here.
  // Keep the full spill/recovery assertions with a directory junction there;
  // POSIX also exercises a file symlink with a different basename and parent.
  const alias = join(directory, 'alias');
  await symlink(process.platform === 'win32' ? parent : path, alias, process.platform === 'win32' ? 'junction' : 'file');
  const requested = process.platform === 'win32' ? join(alias, 'source.sqlite') : alias;
  const db = new DatabaseSync(path); db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY,v); WITH RECURSIVE n(i) AS(VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<3000) INSERT INTO t SELECT i,zeroblob(2000) FROM n'); db.close();
  const engine = new EngineClient({ directory: resolve('dist') }); const edits = new StagedEdits(engine);
  let saving: Promise<string> | undefined;
  try {
    await engine.open(requested); const before = createHash('sha256').update(await readFile(path)).digest('hex'); edits.setWriteMode(true);
    await edits.stageSql('UPDATE t SET v=zeroblob(2100)');
    await edits.stageSql('UPDATE t SET v=(WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n) WHERE id=1');
    saving = edits.save().then(() => 'saved', (error: unknown) => error instanceof Error ? error.message : 'failed');
    await vi.waitFor(async () => {
      const journal = await open(path + '-journal', 'r'); const header = Buffer.alloc(8);
      try { await journal.read(header, 0, header.length, 0); } finally { await journal.close(); }
      expect(header.some((byte) => byte !== 0)).toBe(true);
      expect(createHash('sha256').update(await readFile(path)).digest('hex')).not.toBe(before);
    }, { timeout: 5000, interval: 10 });
    if (action === 'cancel') { await engine.cancel(); } else { await engine.close(); await engine.open(requested); }
    expect(await saving).toMatch(/cancel|closed/iu); expect(edits.dirty).toBe(true);
    expect(createHash('sha256').update(await readFile(path)).digest('hex')).toBe(before);
    expect((await engine.query('SELECT COUNT(*),SUM(length(v)) FROM t')).rows).toEqual([['3000', '6000000']]);
    await expect(edits.save()).rejects.toThrow(/source changed/iu);
  } finally { await engine.close(); await saving; await rm(directory, { recursive: true, force: true }); }
}, 15000);

test('FR-016: Given an interrupted-save token for a different inode, When journal recovery is requested, Then neither the replacement database nor its journal is touched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-recovery-identity-')); const path = join(directory, 'source.sqlite');
  const db = new DatabaseSync(path); db.exec('CREATE TABLE t(v); INSERT INTO t VALUES(1)'); db.close();
  const version = sourceVersion(path); await rename(path, path + '.old'); await copyFile(path + '.old', path);
  const journal = Buffer.from('unrelated journal bytes'); await writeFile(path + '-journal', journal); const before = await readFile(path);
  try {
    const native = await import('node:sqlite');
    expect(() => recoverInterruptedSave(path, version, native)).toThrow(/identity changed/iu);
    expect(await readFile(path)).toEqual(before); expect(await readFile(path + '-journal')).toEqual(journal);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test.each([false, true])('FR-020: Given another owned WAL reader with cancellation first=%s, When it is suspended for Save and resumed, Then both views read the committed changes', async (cancelFirst) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-split-')); const path = join(directory, 'source.sqlite');
  const db = new DatabaseSync(path); db.exec('PRAGMA journal_mode=WAL; CREATE TABLE t(v); INSERT INTO t VALUES(1)'); db.close();
  const engine = new EngineClient({ directory: resolve('dist') }); const secondary = new EngineClient({ directory: resolve('dist') }); const edits = new StagedEdits(engine);
  try {
    await engine.open(path); await secondary.open(path); edits.setWriteMode(true); await edits.stageSql('UPDATE t SET v=2');
    const cancellation = cancelFirst ? secondary.cancel() : undefined;
    const pausing = secondary.suspendReads(); const cancelling = cancellation ?? secondary.cancel();
    const resume = await pausing; await cancelling;
    try { await edits.save(); } finally { await resume(); }
    expect((await engine.query('SELECT v FROM t')).rows).toEqual([['2']]); expect((await secondary.query('SELECT v FROM t')).rows).toEqual([['2']]);
  } finally { await secondary.close(); await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test.each([[false, false], [false, true], [true, false], [true, true]])('FR-020: Given native rollback after cache spill with WAL=%s and automatic=%s, When the queue is corrected, Then retry saves while later external writes still conflict', async (wal, automatic) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-rollback-')); const path = join(directory, 'source.sqlite');
  const db = new DatabaseSync(path);
  if (wal) { db.exec('PRAGMA journal_mode=WAL'); }
  db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY,v); WITH RECURSIVE n(i) AS(VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<3000) INSERT INTO t SELECT i,zeroblob(2000) FROM n'); db.close();
  const engine = new EngineClient({ directory: resolve('dist') }); const edits = new StagedEdits(engine);
  try {
    await engine.open(path); const before = createHash('sha256').update(await readFile(path)).digest('hex'); edits.setWriteMode(true);
    await edits.stageSql('UPDATE t SET v=zeroblob(2100)'); await edits.stageSql(automatic ? 'INSERT OR ROLLBACK INTO t(id,v) VALUES(1,0)' : 'INSERT INTO missing VALUES(1)');
    await expect(edits.save()).rejects.toThrow(/no such table|UNIQUE constraint/iu); expect(createHash('sha256').update(await readFile(path)).digest('hex')).toBe(before); expect(edits.dirty).toBe(true);
    const recovered = edits.backup(); await engine.cancel(); edits.restore(recovered); edits.setWriteMode(true);
    edits.replace([{ kind: 'sql', sql: 'UPDATE t SET v=42 WHERE id=1' }]); await edits.save();
    expect((await engine.query('SELECT v FROM t WHERE id=1')).rows).toEqual([['42']]);
    await edits.stageSql('UPDATE t SET v=43 WHERE id=1');
    const external = new DatabaseSync(path); try { external.exec('UPDATE t SET v=44 WHERE id=1'); } finally { external.close(); }
    await expect(edits.save()).rejects.toThrow(/source changed/iu); expect(edits.dirty).toBe(true);
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
}, 15000);

test.each([false, true])('FR-020: Given a directory alias and fallback=%s, When Save As targets source sidecars through the alias, Then protected paths stay untouched', async (fallback) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-alias-')); const parent = join(directory, 'real'); const alias = join(directory, 'alias');
  await mkdir(parent); await symlink(parent, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const path = join(parent, 'source.sqlite'); const db = new DatabaseSync(path); db.exec('CREATE TABLE t(v); INSERT INTO t VALUES(1)'); db.close();
  const engine = new EngineClient({ directory: resolve('dist'), forceFallback: fallback }); const edits = new StagedEdits(engine);
  try {
    await engine.open(path); const before = await readFile(path); edits.setWriteMode(true); await edits.stageSql('UPDATE t SET v=2');
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      await expect(edits.save(join(alias, 'source.sqlite' + suffix))).rejects.toThrow(/source|sidecar/iu);
      if (suffix !== '') { await expect(stat(path + suffix)).rejects.toMatchObject({ code: 'ENOENT' }); }
    }
    expect(await readFile(path)).toEqual(before); expect(edits.dirty).toBe(true);
    const output = join(alias, 'copy.sqlite'); await edits.save(output);
    const copy = new DatabaseSync(join(parent, 'copy.sqlite'), { readOnly: true });
    try { expect(copy.prepare('SELECT v FROM t').get()?.['v']).toBe(2); } finally { copy.close(); }
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test.each([false, true])('FR-020: Given a UTF-16 SQLite source and fallback=%s, When editing embedded NUL and BOM text, Then complete text and source encoding survive Save', async (fallback) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-utf16-')); const path = join(directory, 'data.sqlite');
  const db = new DatabaseSync(path); db.exec("PRAGMA encoding='UTF-16le'; CREATE TABLE data(id TEXT PRIMARY KEY,value); INSERT INTO data VALUES('k'||char(0)||'tail','old')"); db.close();
  const engine = new EngineClient({ directory: resolve('dist'), forceFallback: fallback }); const edits = new StagedEdits(engine);
  try {
    await engine.open(path); edits.setWriteMode(true); const value = '\ufeffa\0"😀';
    await edits.stage({ table: 'data', column: 'value', offset: 0, expected: 'old', value: editValue('text', value) }); await edits.save();
    expect((await engine.query('SELECT value FROM data')).rows).toEqual([[value]]);
    const saved = new DatabaseSync(path, { readOnly: true });
    try { expect(saved.prepare('PRAGMA encoding').get()?.['encoding']).toBe('UTF-16le'); expect(saved.prepare('SELECT hex(CAST(value AS BLOB)) AS bytes FROM data').get()?.['bytes']).toBe(Buffer.from(value, 'utf16le').toString('hex').toUpperCase()); }
    finally { saved.close(); }
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test.each([false, true])('FR-020: Given an executing atomic save and fallback=%s, When the helper is cancelled, Then it exits, pending work survives and owned output is cleaned', async (fallback) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t030-cancel-')); const path = join(directory, 'data.sqlite');
  const db = new DatabaseSync(path); db.exec('CREATE TABLE t(v); INSERT INTO t VALUES(1)'); db.close();
  const engine = new EngineClient({ directory: resolve('dist'), forceFallback: fallback }); const edits = new StagedEdits(engine);
  try {
    await engine.open(path); const before = await readFile(path); edits.setWriteMode(true);
    await edits.stageSql('UPDATE t SET v=(WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n)');
    const backup = JSON.parse(edits.backup()) as { version: string; operations: EditOperation[] };
    let begin!: () => void; const started = new Promise<void>((resolve) => { begin = resolve; });
    const saving = engine.edit({ action: 'save', ...backup }, begin).then(() => false, () => true);
    await started; await engine.cancel(); expect(await saving).toBe(true);
    expect(edits.dirty).toBe(true); expect(await readFile(path)).toEqual(before);
    expect((await engine.query('SELECT v FROM t')).rows).toEqual([['1']]);
    expect(await readdir(directory)).toEqual(['data.sqlite']);
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
}, 15000);

test('FR-020: Given a checkpointed WAL source, When native editing opens then saves, Then the opening reader cannot invalidate its own source version', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t030-wal-')); const path = join(directory, 'wal.sqlite');
  const db = new DatabaseSync(path); db.exec("PRAGMA journal_mode=WAL; CREATE TABLE data(id PRIMARY KEY,value); INSERT INTO data VALUES(1,'old'); PRAGMA wal_checkpoint(TRUNCATE)"); db.close();
  const engine = new EngineClient({ directory: resolve('dist') }); const edits = new StagedEdits(engine);
  try {
    await engine.open(path); edits.setWriteMode(true); await edits.stageSql("UPDATE data SET value='new'"); await edits.save();
    expect((await engine.query('SELECT value FROM data')).rows).toEqual([['new']]);
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});

test('FR-020: Given an invalid recovered queue, When restoring, Then the backup is refused before installing malformed state', () => {
  const edits = new StagedEdits({});
  for (const operations of [[{ kind: 'cell' }], [{ kind: 'sql', sql: 'ATTACH x AS y' }], [{ kind: 'cell', table: 't', column: 'v', key: [], value: { kind: 'blob', text: 'ff' } }]]) {
    expect(() => edits.restore(JSON.stringify({ version: 'v', operations }))).toThrow();
    expect(edits.dirty).toBe(false);
  }
});

test('FR-020: Given an atomic fallback Save As to non-database bytes, When saving, Then an ordinary existing destination can be replaced explicitly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t030-replace-')); const path = join(directory, 'source.sqlite'); const output = join(directory, 'output.sqlite');
  const db = new DatabaseSync(path); db.exec('CREATE TABLE t(v); INSERT INTO t VALUES(1)'); db.close(); await writeFile(output, 'old destination');
  const engine = new EngineClient({ directory: resolve('dist'), forceFallback: true }); const edits = new StagedEdits(engine);
  try {
    await engine.open(path); const before = await readFile(path); await edits.save(output);
    expect(await readFile(path)).toEqual(before);
    const copy = new DatabaseSync(output, { readOnly: true }); try { expect(copy.prepare('SELECT v FROM t').get()?.['v']).toBe(1); } finally { copy.close(); }
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
});
