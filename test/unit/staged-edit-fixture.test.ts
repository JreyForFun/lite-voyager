import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, test } from 'vitest';
import { seedStagedEditDatabase } from './fixtures/staged-edit-database';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});
async function databasePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t030-seed-'));
  directories.push(directory);
  return join(directory, 'data.sqlite');
}

test('FR-020: Given the staged-edit fixture, When seeded, Then exact int64 keys, rowid gaps and generated columns survive the setup transaction', async () => {
  const path = await databasePath();
  seedStagedEditDatabase(path);
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    const query = database.prepare('SELECT id,number,computed,length(bytes) AS bytes FROM data WHERE value=?');
    query.setReadBigInts(true);
    expect(query.get('first')).toEqual({ id: 9223372036854775807n, number: -9223372036854775808n, computed: 'first!', bytes: 4n });
    expect(database.prepare('SELECT rowid,value FROM gaps ORDER BY rowid').all()).toEqual([{ rowid: 7, value: 'seven' }, { rowid: 99, value: 'last' }]);
  } finally { database.close(); }
});

test('FR-020: Given failed fixture seeding after a schema change, When setup throws, Then no partial schema is committed and the database handle is closed', async () => {
  const path = await databasePath();
  expect(() => seedStagedEditDatabase(path, 'CREATE TABLE partial(value); INSERT INTO missing VALUES(1);')).toThrow(/missing/iu);
  const database = new DatabaseSync(path, { readOnly: true });
  try { expect(database.prepare('SELECT name FROM sqlite_schema').all()).toEqual([]); }
  finally { database.close(); }
  // On Windows an unclosed SQLite handle would prevent removing this file.
  await rm(path);
});
