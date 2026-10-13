import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const output = process.argv[2];
const rawRows = process.argv[4] ?? '10000000';
const rows = Number(rawRows);
if (output === undefined || ![3, 5].includes(process.argv.length) || (process.argv.length === 5 && process.argv[3] !== '--rows')
  || !/^\d+$/u.test(rawRows) || !Number.isSafeInteger(rows) || rows <= 0 || rows > 10000000) {
  throw new Error('Usage: node scripts/sqlite-memory-fixture.mts <new-directory> [--rows <1..10000000>]. The row override is only for generator unit tests.');
}
const directory = resolve(output);
// The parent must exist; refuse all existing destinations, including empty ones.
await mkdir(directory);
const files: { name: string; bytes: number }[] = [];
for (const [name, payloadBytes] of [['one-gb.sqlite', 100], ['five-gb.sqlite', 512]] as const) {
  const path = join(directory, name);
  await writeFile(path, '', { flag: 'wx' });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA cache_size=-2048; CREATE TABLE records(id INTEGER PRIMARY KEY, name TEXT, payload TEXT); CREATE VIEW record_names AS SELECT id, name FROM records; BEGIN');
    // One bounded recursive stream and transaction in this disposable process.
    // Values are bound, IDs stay BigInt, and every byte belongs to valid records.
    const insert = db.prepare("WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x+1 < ?) INSERT INTO records SELECT ?+x, 'row ' || x, ? FROM n");
    insert.setReadBigInts(true); // Keep run()'s int64 metadata exact as well.
    insert.run(rows, 9007199254740993n, 'x'.repeat(payloadBytes));
    db.exec('COMMIT');
  } finally { db.close(); }
  const file = { name, bytes: (await stat(path)).size }; files.push(file);
  process.stdout.write(`${JSON.stringify({ ...file, rows, payloadBytes })}\n`);
}
const evidence = { rows, payloadBytes: [100, 512], files };
await writeFile(join(directory, 'generation.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
