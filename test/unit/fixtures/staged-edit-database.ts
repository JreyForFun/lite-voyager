import { DatabaseSync } from 'node:sqlite';

const seed = `CREATE TABLE data(id INTEGER PRIMARY KEY, value TEXT UNIQUE, number INTEGER, bytes BLOB, computed TEXT GENERATED ALWAYS AS (value || '!'));
    INSERT INTO data(id,value,number,bytes) VALUES(9223372036854775807,'first',-9223372036854775808,zeroblob(4)),(2,'second',NULL,NULL);
    CREATE TABLE composite(a INTEGER,b TEXT,value,PRIMARY KEY(a,b)) WITHOUT ROWID;
    INSERT INTO composite VALUES(9223372036854775807,'quote''😀','old');
    CREATE TABLE no_key(value); INSERT INTO no_key VALUES('one'),('two');
    CREATE TABLE nullable(a TEXT PRIMARY KEY,value); INSERT INTO nullable VALUES(NULL,'a'),(NULL,'b');
    CREATE TABLE shadow(rowid,_rowid_,oid,value); INSERT INTO shadow VALUES(1,2,3,4);
    CREATE TABLE gaps(value); INSERT INTO gaps(rowid,value) VALUES(7,'seven'),(99,'last');
    CREATE TABLE "select ""😀"("key ""🚀" TEXT PRIMARY KEY,note TEXT); INSERT INTO "select ""😀" VALUES('k'||char(0)||'tail','old');
    CREATE VIEW view_data AS SELECT * FROM data;
    CREATE TABLE row_defaults(id INTEGER PRIMARY KEY, value TEXT DEFAULT 'default value', number INTEGER, generated TEXT GENERATED ALWAYS AS (value || '!'));
    CREATE TABLE ignore_insert(value);
    CREATE TABLE row_parent(id INTEGER PRIMARY KEY); INSERT INTO row_parent VALUES(1);
    CREATE TABLE row_child(parent REFERENCES row_parent(id)); INSERT INTO row_child VALUES(1);
    CREATE TRIGGER ignore_row BEFORE INSERT ON ignore_insert BEGIN SELECT RAISE(IGNORE); END;
    CREATE TABLE wide_rows(${Array.from({ length: 1000 }, (_, index) => `column_${String(index)} TEXT`).join(',')});`;

export function seedStagedEditDatabase(path: string, statements = seed): void {
  const database = new DatabaseSync(path);
  // Fixture creation is one durable commit; retain SQLite's default durability.
  // Closing after an error rolls back setup rather than leaving a partial seed.
  try { database.exec('BEGIN'); database.exec(statements); database.exec('COMMIT'); }
  finally { database.close(); }
}
