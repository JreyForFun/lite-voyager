import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// T-012 disposable fixture generation, always in a new explicitly named directory.
const output = process.argv[2];
if (output === undefined || process.argv.length > 4 || (process.argv[3] !== undefined && process.argv[3] !== '--large')) {
  throw new Error('Usage: node scripts/browser-fixture.mts <new-output-directory> [--large]');
}
const directory = resolve(output);
await mkdir(directory, { recursive: true });
const path = join(directory, 'browser.sqlite');
// Never overwrite an owner/source database, including an empty existing file.
await writeFile(path, '', { flag: 'wx' });
const db = new DatabaseSync(path);
const quote = (name: string): string => `"${name.replaceAll('"', '""')}"`;
try {
  db.exec(`
    CREATE TABLE "a values"(nullable TEXT, empty TEXT, literal TEXT, maximum INTEGER, minimum INTEGER, bytes BLOB, real REAL, date TEXT, hostile TEXT);
    INSERT INTO "a values" VALUES(NULL, '', 'NULL', 9223372036854775807, -9223372036854775808, zeroblob(24), 1e-200, '2026-10-10T12:00:00+08:00', '<script>literal</script>');
    CREATE TABLE "b pages"(id INTEGER PRIMARY KEY, value TEXT);
    WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<201) INSERT INTO "b pages" SELECT x, 'row ' || x FROM n;
    CREATE TABLE "c empty"(value);
    CREATE VIEW "d view" AS SELECT * FROM "b pages";
    CREATE TABLE "e large cells"(value);
    INSERT INTO "e large cells" VALUES(printf('%.*c',1100000,'x')), (printf('%.*c',1100000,'y')), (printf('%.*c',1100000,'z')), (printf('%.*c',1100000,'w'));
    CREATE TABLE "f wide"(${Array.from({ length: 1000 }, (_value, index) => quote(`column ${String(index)}`)).join(',')});
    INSERT INTO "f wide" VALUES(${Array.from({ length: 1000 }, (_value, index) => String(index)).join(',')});
    CREATE VIEW "g slow count" AS WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT x FROM n;
    CREATE VIEW "h broken view" AS SELECT * FROM missing_table;
  `);
  db.exec(Array.from({ length: 102 }, (_value, index) => `CREATE TABLE ${quote(`list ${String(index).padStart(3, '0')} 🚀`)}(v);`).join(''));
  if (process.argv[3] === '--large') {
    db.exec('CREATE TABLE "0 ten million"(id INTEGER PRIMARY KEY, value); BEGIN; WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10000000) INSERT INTO "0 ten million" SELECT x, x FROM n; COMMIT;');
  }
} finally { db.close(); }
const evidence = { path, bytes: (await stat(path)).size, largeRows: process.argv[3] === '--large' ? 10000000 : 0 };
await writeFile(join(directory, 'generation.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify(evidence)}\n`);
