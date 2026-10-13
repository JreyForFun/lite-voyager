import { writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const path = process.argv[2];
if (path === undefined || process.argv.length !== 3) { throw new Error('Usage: node scripts/sqlite-safety-fixture.mts <new-sqlite-path>'); }
await writeFile(path, '', { flag: 'wx' });
const db = new DatabaseSync(path);
try {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE records(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO records VALUES(1, \'committed WAL row\')');
  process.stdout.write('ready\n');
  // Hold a genuine external connection idle; no fixture writes during the test.
  await new Promise<void>((resolve) => { process.stdin.resume(); process.stdin.once('end', resolve); });
} finally { db.close(); }
