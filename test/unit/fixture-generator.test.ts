import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';
import { generateLargeFixtures, generateStressFixtures } from '../../scripts/fixtures.mts';

const execute = promisify(execFile);
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
async function outputPath(): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), 'lite-voyager-generator-test-'));
  directories.push(parent);
  return join(parent, 'output');
}

test('T-005: Given a scaled large-data request, When generated, Then CSV and SQLite row counts agree and unsafe integers remain exact', async () => {
  const output = await outputPath();
  const result = await generateLargeFixtures(output, { rows: 7, payloadBytes: 32 });
  expect(result.rows).toBe(7);
  const lines = (await readFile(join(output, 'large.csv'), 'utf8')).trimEnd().split('\n');
  expect(lines).toHaveLength(8);
  expect(lines[1]).toMatch(/^9007199254740993,/);
  expect(lines[7]).toMatch(/^9007199254740999,/);
  const db = new DatabaseSync(join(output, 'large.sqlite'), { readOnly: true });
  try {
    const query = db.prepare('SELECT count(*) AS count, min(id) AS first, max(id) AS last, min(length(payload)) AS length FROM records');
    query.setReadBigInts(true);
    expect(query.get()).toMatchObject({ count: 7n, first: 9007199254740993n, last: 9007199254740999n, length: 32n });
    expect(db.prepare('PRAGMA integrity_check').get()).toMatchObject({ integrity_check: 'ok' });
  } finally { db.close(); }
  expect(result.csvBytes).toBe((await stat(join(output, 'large.csv'))).size);
  expect(result.sqliteBytes).toBe((await stat(join(output, 'large.sqlite'))).size);
});

test('T-005: Given a minimum CSV size, When generated, Then whole records reach the requested bytes and SQLite contains the same rows', async () => {
  const output = await outputPath();
  const result = await generateLargeFixtures(output, { rows: 1, payloadBytes: 32, csvBytes: 4096 });
  expect(result.csvBytes).toBeGreaterThanOrEqual(4096);
  expect(result.rows).toBeGreaterThan(1);
  expect((await readFile(join(output, 'large.csv'), 'utf8')).endsWith('\n')).toBe(true);
  const db = new DatabaseSync(join(output, 'large.sqlite'), { readOnly: true });
  try { expect(db.prepare('SELECT count(*) AS count FROM records').get()).toMatchObject({ count: result.rows }); } finally { db.close(); }
});

test('T-005: Given stress fixtures, When generated, Then a greater-than-1-MB cell and 1000-column CSV/SQLite data are real', async () => {
  const output = await outputPath();
  await generateStressFixtures(output);
  const csv = await readFile(join(output, 'large-cell.csv'), 'utf8');
  expect(csv.split('\n')[1]?.length).toBeGreaterThan(1_048_576);
  expect((await readFile(join(output, 'wide.csv'), 'utf8')).split('\n')[0]?.split(',')).toHaveLength(1000);
  const db = new DatabaseSync(join(output, 'stress.sqlite'), { readOnly: true });
  try {
    expect(db.prepare('PRAGMA table_info(wide)').all()).toHaveLength(1000);
    expect(db.prepare('SELECT length(value) AS size FROM large_cell').get()).toMatchObject({ size: 1_048_577 });
  } finally { db.close(); }
});

test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
  'T-005: Given invalid row count %s, When requested, Then generation rejects it before creating output',
  async (rows) => {
    const output = await outputPath();
    await expect(generateLargeFixtures(output, { rows, payloadBytes: 32 })).rejects.toThrow('positive safe integer');
    await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

test('T-005: Given a destination file, When generation is requested, Then it refuses to replace user data', async () => {
  const output = await outputPath();
  await writeFile(output, 'preserve me');
  await expect(generateLargeFixtures(output, { rows: 1, payloadBytes: 32 })).rejects.toThrow('already exists');
  expect(await readFile(output, 'utf8')).toBe('preserve me');
});

test('T-005: Given CLI misuse, When invoked, Then it exits nonzero with a clear message and no raw stack trace', async () => {
  const output = await outputPath();
  let failure: unknown;
  try { await execute(process.execPath, ['scripts/generate-fixtures.mts', 'large', '--output', output, '--rows', 'oops'], { cwd: resolve('.') }); }
  catch (error: unknown) { failure = error; }
  expect(failure).toMatchObject({ code: 1 });
  if (typeof failure !== 'object' || failure === null || !('stderr' in failure) || typeof failure.stderr !== 'string') {
    throw new Error('CLI failure did not provide a stderr message.');
  }
  expect(failure.stderr).toContain('positive safe integer');
  expect(failure.stderr).not.toMatch(/\n\s+at /);
  await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('T-005: Given generated-output paths, When Git checks ignore rules, Then large assets are ignored and small fixtures are retained', async () => {
  const { stdout } = await execute('git', ['check-ignore', 'test/fixtures/generated/example/large.sqlite', 'test/fixtures/generated/example/large.csv'], { cwd: resolve('.') });
  expect(stdout.trim().split(/\r?\n/)).toHaveLength(2);
});
