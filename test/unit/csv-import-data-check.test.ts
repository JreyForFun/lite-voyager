import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { csvFixtureCheckSql } from '../../src/test/csv-import-data-check';

test('NFR-003: Given generated payloads with changed ends, lengths, NULL or BLOB storage, When verifying every imported row, Then only exact TEXT values count as valid', () => {
  const db = new DatabaseSync(':memory:'); const expected = 'x'.repeat(4095);
  try {
    db.exec('CREATE TABLE records(payload)'); const insert = db.prepare('INSERT INTO records VALUES(?)');
    for (const value of [expected, `A${expected.slice(1)}`, `${expected.slice(0, -1)}Z`, expected.slice(1), `${expected}x`, null, Buffer.from(expected)]) { insert.run(value); }
    expect(db.prepare(csvFixtureCheckSql()).get()).toEqual({ n: 7, invalid: 6 });
    db.exec('DELETE FROM records'); insert.run(expected); insert.run(expected);
    expect(db.prepare(csvFixtureCheckSql()).get()).toEqual({ n: 2, invalid: 0 });
  } finally { db.close(); }
});
