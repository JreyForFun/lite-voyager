import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const output = process.argv[2];
if (output === undefined || process.argv.length !== 3) { throw new Error('Usage: node scripts/milestone-one-fixture.mts <new-directory>'); }
const directory = resolve(output); await mkdir(directory, { recursive: true });
const path = join(directory, 'gate.sqlite'); await writeFile(path, '', { flag: 'wx' });
const db = new DatabaseSync(path);
const quote = (name: string): string => `"${name.replaceAll('"', '""')}"`;
try {
  db.exec(`
    CREATE TABLE ""("" TEXT NOT NULL DEFAULT 'literal', id INTEGER, PRIMARY KEY("", id)) WITHOUT ROWID;
    INSERT INTO "" VALUES('blank',9223372036854775807);
    CREATE INDEX blank_index ON ""(id DESC) WHERE id>0;
    CREATE TABLE "select ""🚀"(value TEXT UNIQUE DEFAULT '<img>');
    CREATE INDEX expression_index ON "select ""🚀"(length(value));
    CREATE TABLE wide(${Array.from({ length: 1000 }, (_, index) => quote(`column ${String(index)}`)).join(',')});
    INSERT INTO wide VALUES(${Array.from({ length: 1000 }, (_, index) => String(index)).join(',')});
    CREATE TABLE malformed(value TEXT); INSERT INTO malformed VALUES(CAST(x'80' AS TEXT));
  `);
} finally { db.close(); }
process.stdout.write(`${JSON.stringify({ path })}\n`);
