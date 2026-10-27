import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeAll, describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { EngineClient } from '../../src/engine/engine-client';
import { StagedEdits } from '../../src/staging/staged-edits';
import { checkWriteStatement, editValue } from '../../src/staging/edit-types';

beforeAll(async () => {
  const result = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']);
  expect(result.stderr).toBe('');
}, 30000);

async function fixture(fallback: boolean, run: (edits: StagedEdits, engine: EngineClient, path: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t030-'));
  const path = join(directory, 'data.sqlite');
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE data(id INTEGER PRIMARY KEY, value TEXT UNIQUE, number INTEGER, bytes BLOB, computed TEXT GENERATED ALWAYS AS (value || '!'));
    INSERT INTO data(id,value,number,bytes) VALUES(9223372036854775807,'first',-9223372036854775808,zeroblob(4)),(2,'second',NULL,NULL);
    CREATE TABLE composite(a INTEGER,b TEXT,value,PRIMARY KEY(a,b)) WITHOUT ROWID;
    INSERT INTO composite VALUES(9223372036854775807,'quote''😀','old');
    CREATE TABLE no_key(value); INSERT INTO no_key VALUES('one'),('two');
    CREATE TABLE nullable(a TEXT PRIMARY KEY,value); INSERT INTO nullable VALUES(NULL,'a'),(NULL,'b');
    CREATE TABLE shadow(rowid,_rowid_,oid,value); INSERT INTO shadow VALUES(1,2,3,4);
    CREATE TABLE gaps(value); INSERT INTO gaps(rowid,value) VALUES(7,'seven'),(99,'last');
    CREATE TABLE "select ""😀"("key ""🚀" TEXT PRIMARY KEY,note TEXT); INSERT INTO "select ""😀" VALUES('k'||char(0)||'tail','old');
    CREATE VIEW view_data AS SELECT * FROM data;`);
  db.close();
  const engine = new EngineClient({ directory: resolve('dist'), forceFallback: fallback });
  const edits = new StagedEdits(engine);
  try { await engine.open(path); await run(edits, engine, path); }
  finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
}

test('FR-020: Given explicit cell types, When parsing values, Then int64 stays exact and invalid or overflowing values are refused', () => {
  expect(editValue('integer', '9223372036854775807')).toEqual({ kind: 'integer', text: '9223372036854775807' });
  expect(editValue('null', 'anything')).toEqual({ kind: 'null', text: '' });
  expect(editValue('text', '')).toEqual({ kind: 'text', text: '' });
  for (const value of ['9223372036854775808', '-9223372036854775809', '1.5', '1e3', '']) { expect(() => editValue('integer', value)).toThrow(); }
  for (const value of ['Infinity', 'NaN', '1e999', '1e-999', '']) { expect(() => editValue('real', value)).toThrow(); }
  expect(() => editValue('text', '\ud800')).toThrow();
});

test('FR-016: Given queued SQL, When validating, Then exactly one DML statement is accepted and file or transaction controls are refused', () => {
  for (const sql of ["UPDATE data SET value=';'; -- safe", "UPDATE data SET value='? :id @id $id'; -- ?", '/* hello */ DELETE FROM data WHERE 0', 'INSERT INTO data(id) VALUES(3) RETURNING id']) {
    expect(checkWriteStatement(sql)).toBeTruthy();
  }
  for (const sql of ['BEGIN', 'COMMIT', 'PRAGMA journal_mode=OFF', "ATTACH 'x' AS x", 'VACUUM', 'CREATE TABLE x(a)', 'UPDATE data SET id=1; DELETE FROM data', "UPDATE data SET value='broken", 'WITH x AS (SELECT 1) UPDATE data SET id=3', 'UPDATE data SET value=?', 'UPDATE data SET value=:value', 'INSERT INTO data(value) VALUES($value)', 'DELETE FROM data WHERE id=@id']) {
    expect(() => checkWriteStatement(sql)).toThrow();
  }
});

describe.each([false, true])('T-030 real staged edits fallback=%s', (fallback) => {
  test('FR-020: Given quoted Unicode names and embedded NUL text keys, When staging and saving complete TEXT, Then keys and values preserve every byte on both engines', async () => {
    await fixture(fallback, async (edits, engine) => {
      const value = '\ufeffa\0"😀'; edits.setWriteMode(true);
      await edits.stage({ table: 'select "😀', offset: 0, column: 'note', expected: 'old', value: editValue('text', value) });
      await edits.stage({ table: 'no_key', offset: 0, column: 'value', expected: 'one', value: editValue('text', value) }); await edits.save();
      expect((await engine.query('SELECT note,hex(CAST(note AS BLOB)),hex(CAST("key ""🚀" AS BLOB)) FROM "select ""😀"')).rows).toEqual([[value, Buffer.from(value).toString('hex').toUpperCase(), Buffer.from('k\0tail').toString('hex').toUpperCase()]]);
      expect((await engine.query('SELECT value FROM no_key WHERE rowid=1')).rows).toEqual([[value]]);
    });
  });
  test('FR-020: Given staged cells larger than 1 MB, When their combined page exceeds transport bounds, Then smaller pages preserve complete values and Save never truncates data', async () => {
    await fixture(fallback, async (edits, engine) => {
      edits.setWriteMode(true); const value = 'x'.repeat(2_100_000);
      await edits.stage({ table: 'no_key', offset: 0, column: 'value', expected: 'one', value: editValue('text', value) });
      await edits.stage({ table: 'no_key', offset: 1, column: 'value', expected: 'two', value: editValue('text', value) });
      await expect(edits.page('no_key', {}, { limit: 2 })).rejects.toThrow(/4 MiB|fewer rows/iu);
      expect((await edits.page('no_key', {}, { limit: 1 })).rows[0]?.[0]).toBe(value);
      await edits.save(); expect((await engine.query('SELECT length(value) FROM no_key')).rows).toEqual([['2100000'], ['2100000']]);
    });
  });
  test('FR-020: Given rowid gaps without a declared key, When Save As copies staged edits, Then original rowids are preserved and no different row is addressed', async () => {
    await fixture(fallback, async (edits, _engine, path) => {
      edits.setWriteMode(true); await edits.stage({ table: 'gaps', offset: 1, column: 'value', expected: 'last', value: editValue('text', 'changed') });
      const output = path + '.gaps.sqlite'; await edits.save(output);
      const saved = new DatabaseSync(output, { readOnly: true });
      try { expect(saved.prepare('SELECT rowid,value FROM gaps ORDER BY rowid').all()).toEqual([{ rowid: 7, value: 'seven' }, { rowid: 99, value: 'changed' }]); }
      finally { saved.close(); }
    });
  });
  test('FR-020: Given explicit Save As, When saving a new database or selecting an original sidecar, Then the copy includes edits and protected paths remain untouched', async () => {
    await fixture(fallback, async (edits, engine, path) => {
      const before = await readFile(path); edits.setWriteMode(true);
      await edits.stageSql("UPDATE no_key SET value='copy' WHERE rowid=1");
      for (const suffix of ['-wal', '-shm', '-journal']) {
        await expect(edits.save(path + suffix)).rejects.toThrow(/source|sidecar/iu);
        await expect(stat(path + suffix)).rejects.toMatchObject({ code: 'ENOENT' });
      }
      const output = path + '.copy.sqlite'; await edits.save(output);
      expect(await readFile(path)).toEqual(before); expect(edits.dirty).toBe(true);
      const copy = new DatabaseSync(output, { readOnly: true });
      try { expect(copy.prepare('SELECT value FROM no_key WHERE rowid=1').get()?.['value']).toBe('copy'); }
      finally { copy.close(); }
      expect((await engine.query('SELECT value FROM no_key WHERE rowid=1')).rows).toEqual([['one']]);
    });
  });
  test('FR-020: Given sorted filtered rows, awkward identifiers and stale display text, When staging, Then only the intended stable row changes with exact scalar fidelity', async () => {
    await fixture(fallback, async (edits, engine) => {
      edits.setWriteMode(true);
      await expect(edits.stage({ table: 'data', offset: 0, column: 'value', expected: 'wrong', value: editValue('text', 'x') })).rejects.toThrow(/changed/iu);
      await edits.stage({ table: 'data', offset: 0, grid: { sort: { column: 'id', direction: 'desc' }, filters: [{ column: 'value', operator: 'contains', value: 'first' }] }, column: 'number', expected: '-9223372036854775808', value: editValue('integer', '9223372036854775807') });
      await edits.stageSql('CREATE TABLE forbidden(x)').then(() => { throw new Error('DDL must be refused'); }, () => {});
      await edits.save();
      expect((await engine.query('SELECT number FROM data WHERE id=9223372036854775807')).rows).toEqual([['9223372036854775807']]);
      await edits.stageSql('INSERT INTO no_key VALUES (\'NULL\'), (\'\'), (NULL), (1e-200)'); await edits.save();
      expect((await engine.query('SELECT value FROM no_key WHERE rowid>2')).rows).toEqual([['NULL'], [''], [null], ['1e-200']]);
    });
  });
  test('FR-020: Given pending changes and a backup, When recovering or editing the same cell again, Then original identities and queued values survive without source writes', async () => {
    await fixture(fallback, async (edits, engine, path) => {
      const before = await readFile(path); edits.setWriteMode(true);
      await edits.stage({ table: 'no_key', offset: 0, column: 'value', expected: 'one', value: editValue('text', 'first staged') });
      await edits.stage({ table: 'no_key', offset: 0, column: 'value', expected: 'first staged', value: editValue('text', '') });
      const recovered = new StagedEdits(engine); recovered.restore(edits.backup());
      expect(recovered.writeMode).toBe(false); expect(recovered.dirty).toBe(true);
      expect((await recovered.page('no_key', {}, { limit: 1 })).rows).toEqual([['']]);
      expect(await readFile(path)).toEqual(before); await recovered.save();
      expect((await engine.query('SELECT value FROM no_key WHERE rowid=1')).rows).toEqual([['']]);
    });
  });
  test('FR-020: Given a read-only document, When staging and reverting exact scalar edits, Then sources stay unchanged and Save is atomic', async () => {
    await fixture(fallback, async (edits, engine, path) => {
      const before = await readFile(path);
      await expect(edits.stage({ table: 'data', offset: 0, column: 'value', expected: 'second', value: editValue('text', 'new') })).rejects.toThrow(/write mode/iu);
      edits.setWriteMode(true);
      await edits.stage({ table: 'data', offset: 0, column: 'value', expected: 'second', value: editValue('text', 'new') });
      expect((await edits.page('data', {}, { limit: 1 })).rows[0]?.[1]).toBe('new');
      expect(await readFile(path)).toEqual(before);
      const undo = edits.operations.slice(); edits.replace([]); expect(edits.dirty).toBe(false); edits.replace(undo);
      await edits.save(); expect(edits.dirty).toBe(false);
      expect((await engine.query('SELECT value FROM data WHERE id=2')).rows).toEqual([['new']]);
      edits.setWriteMode(true);
      await edits.stage({ table: 'data', offset: 0, column: 'number', expected: null, value: editValue('integer', '-9223372036854775808') });
      await edits.save();
      expect((await engine.query('SELECT number FROM data WHERE id=2')).rows).toEqual([['-9223372036854775808']]);
    });
  });
  test('FR-020: Given composite and rowid identities, When changing key values and awkward text, Then original stable keys address exactly one row', async () => {
    await fixture(fallback, async (edits, engine) => {
      edits.setWriteMode(true);
      await edits.stage({ table: 'composite', offset: 0, column: 'a', expected: '9223372036854775807', value: editValue('integer', '-9223372036854775808') });
      await edits.stage({ table: 'composite', offset: 0, column: 'value', expected: 'old', value: editValue('text', "quote'; DROP TABLE data; --😀") });
      await edits.stage({ table: 'no_key', offset: 1, column: 'value', expected: 'two', value: editValue('null', '') });
      await edits.save();
      expect((await engine.query('SELECT * FROM composite')).rows).toEqual([['-9223372036854775808', "quote'😀", "quote'; DROP TABLE data; --😀"]]);
      expect((await engine.query('SELECT value FROM no_key WHERE rowid=2')).rows).toEqual([[null]]);
    });
  });
  test('FR-020: Given views, generated cells, BLOB cells, duplicate nullable keys and shadowed rowid, When staging, Then unsupported or ambiguous targets fail without mutation', async () => {
    await fixture(fallback, async (edits, _engine, path) => {
      const before = await readFile(path); edits.setWriteMode(true);
      for (const target of [
        { table: 'view_data', column: 'value', expected: 'second' },
        { table: 'data', column: 'computed', expected: 'second!' },
        { table: 'data', column: 'bytes', offset: 1, expected: '[BLOB 4 bytes]' },
        { table: 'nullable', column: 'value', expected: 'a' },
        { table: 'shadow', column: 'value', expected: '4' },
      ]) {
        await expect(edits.stage({ offset: 0, ...target, value: editValue('text', 'x') })).rejects.toThrow();
      }
      expect(edits.dirty).toBe(false); expect(await readFile(path)).toEqual(before);
    });
  });
  test('FR-016: Given write SQL or a constraint failure, When saving, Then only explicit Save writes and every queued operation rolls back together', async () => {
    await fixture(fallback, async (edits, engine, path) => {
      const before = await readFile(path);
      await expect(edits.stageSql("UPDATE data SET value='x' WHERE id=2")).rejects.toThrow(/write mode/iu);
      edits.setWriteMode(true);
      await edits.stageSql("UPDATE data SET number=42 WHERE id=2");
      await edits.stageSql("UPDATE data SET value='first' WHERE id=2");
      expect(await readFile(path)).toEqual(before);
      await expect(edits.save()).rejects.toThrow(); expect(edits.dirty).toBe(true);
      expect(await readFile(path)).toEqual(before);
      expect((await engine.query('SELECT number FROM data WHERE id=2')).rows).toEqual([[null]]);
      edits.replace(edits.operations.slice(0, 1)); await edits.save();
      expect((await engine.query('SELECT number FROM data WHERE id=2')).rows).toEqual([['42']]);
    });
  });
  test('FR-020: Given a changed source or cancelled worker, When saving old staged work, Then pending edits remain and newer data is preserved', async () => {
    await fixture(fallback, async (edits, engine, path) => {
      edits.setWriteMode(true);
      await edits.stage({ table: 'no_key', offset: 0, column: 'value', expected: 'one', value: editValue('text', 'staged') });
      await engine.cancel();
      const writer = new DatabaseSync(path); writer.exec("UPDATE no_key SET value='external' WHERE rowid=1"); writer.close();
      await expect(edits.save()).rejects.toThrow(/changed/iu);
      expect(edits.dirty).toBe(true);
      const reader = new DatabaseSync(path, { readOnly: true });
      try { expect(reader.prepare('SELECT value FROM no_key WHERE rowid=1').get()?.['value']).toBe('external'); }
      finally { reader.close(); }
    });
  });
});
