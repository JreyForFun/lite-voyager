import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';
import { workerData } from 'node:worker_threads';
import type { SqliteFixtureJob } from './fixtures.mts';

function validJob(value: unknown): value is SqliteFixtureJob {
  if (typeof value !== 'object' || value === null || !('mode' in value) || !('directory' in value)) { return false; }
  if (typeof value.directory !== 'string') { return false; }
  if (value.mode === 'small' || value.mode === 'stress') { return true; }
  return value.mode === 'large' && 'rows' in value && 'payloadBytes' in value
    && typeof value.rows === 'number' && Number.isSafeInteger(value.rows) && value.rows > 0
    && typeof value.payloadBytes === 'number' && Number.isSafeInteger(value.payloadBytes) && value.payloadBytes > 0;
}

function quoteIdentifier(name: string): string { return `"${name.replaceAll('"', '""')}"`; }

function smallDatabase(directory: string): void {
  const path = join(directory, 'sample.sqlite');
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      CREATE TABLE records(id INTEGER PRIMARY KEY, label TEXT NOT NULL DEFAULT 'default', payload BLOB);
      CREATE INDEX records_label_idx ON records(label);
      CREATE VIEW record_labels AS SELECT id, label FROM records;
      CREATE TABLE no_primary_key(value TEXT);
      CREATE TABLE composite(region TEXT, code TEXT, value TEXT, PRIMARY KEY(region, code)) WITHOUT ROWID;
      CREATE TABLE fidelity(integer_value INTEGER, real_value REAL, text_value TEXT);
      CREATE TABLE "select"("first name" TEXT, "quote""name" TEXT, "😀" TEXT, "order" TEXT);
    `);
    db.prepare('INSERT INTO records(id, label, payload) VALUES (?, ?, ?)').run(1, 'BLOB record', Buffer.from([0, 1, 255]));
    db.prepare('INSERT INTO no_primary_key(value) VALUES (?)').run('uses rowid');
    db.prepare('INSERT INTO composite(region, code, value) VALUES (?, ?, ?)').run('PH', 'A', 'composite key');
    const fidelity = db.prepare('INSERT INTO fidelity VALUES (?, ?, ?)');
    fidelity.run(9223372036854775807n, 1e300, null);
    fidelity.run(-9223372036854775808n, 1e-300, '');
    fidelity.run(9007199254740993n, -1e300, 'NULL');
    db.prepare('INSERT INTO "select" VALUES (?, ?, ?, ?)').run('space', 'quoted', 'emoji', 'keyword');
  } finally { db.close(); }
  const empty = new DatabaseSync(join(directory, 'empty.sqlite'));
  try { empty.exec('VACUUM'); } finally { empty.close(); }
  writeFileSync(join(directory, 'corrupt.sqlite'), 'not a SQLite database\n', { flag: 'wx' });
  writeFileSync(join(directory, 'truncated.sqlite'), readFileSync(path).subarray(0, 128), { flag: 'wx' });
}

function largeDatabase(job: SqliteFixtureJob): void {
  if (job.rows === undefined || job.payloadBytes === undefined) { throw new Error('Large fixture job requires rows and payloadBytes.'); }
  const db = new DatabaseSync(join(job.directory, 'large.sqlite'));
  try {
    db.exec('CREATE TABLE records(id INTEGER PRIMARY KEY, name TEXT, payload TEXT)');
    const insert = db.prepare('INSERT INTO records VALUES (?, ?, ?)');
    const payload = 'x'.repeat(job.payloadBytes);
    const firstId = 9007199254740993n;
    for (let offset = 0; offset < job.rows; offset += 1000) {
      db.exec('BEGIN');
      for (let row = offset; row < Math.min(offset + 1000, job.rows); row += 1) {
        insert.run(firstId + BigInt(row), `row ${String(row)}`, payload);
      }
      db.exec('COMMIT');
    }
  } finally { db.close(); }
}

function stressDatabase(directory: string): void {
  const db = new DatabaseSync(join(directory, 'stress.sqlite'));
  try {
    db.exec('CREATE TABLE large_cell(value TEXT)');
    db.prepare('INSERT INTO large_cell VALUES (?)').run('x'.repeat(1_048_577));
    const columns = Array.from({ length: 1000 }, (_, index) => `column_${String(index)}`);
    db.exec(`CREATE TABLE wide(${columns.map((name) => `${quoteIdentifier(name)} INTEGER`).join(',')})`);
    db.prepare(`INSERT INTO wide VALUES (${columns.map(() => '?').join(',')})`).run(...columns.map((_, index) => index));
  } finally { db.close(); }
}

const job: unknown = workerData;
if (!validJob(job)) { throw new Error('Invalid SQLite fixture worker job.'); }
if (job.mode === 'small') { smallDatabase(job.directory); }
else if (job.mode === 'large') { largeDatabase(job); }
else { stressDatabase(job.directory); }
