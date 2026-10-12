import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { populateBrowserFixture } from './browser-fixture';

test('FR-002: Given a late fixture SQL error, When populating a disposable database, Then no partial schema or rows persist', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-fixture-atomic-'));
  const path = join(directory, 'fixture.sqlite');
  try {
    expect(() => populateBrowserFixture(new DatabaseSync(path), 'CREATE TABLE first(v); INSERT INTO first VALUES(1); INSERT INTO missing VALUES(2);')).toThrow('no such table');
    const reader = new DatabaseSync(path, { readOnly: true });
    try { expect(reader.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all()).toEqual([]); }
    finally { reader.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('FR-002: Given the complete 103-object and 1000-column fixture, When populated atomically, Then every object, column and value is committed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-fixture-wide-'));
  const path = join(directory, 'fixture.sqlite');
  const columns = Array.from({ length: 1000 }, (_value, index) => `c${String(index)}`);
  const definitions = Array.from({ length: 102 }, (_value, index) => `CREATE TABLE t${String(index).padStart(3, '0')}(v);`).join('');
  try {
    populateBrowserFixture(new DatabaseSync(path), `${definitions} CREATE TABLE wide(${columns.join(',')}); INSERT INTO wide VALUES(${columns.map((_name, index) => String(index)).join(',')});`);
    const reader = new DatabaseSync(path, { readOnly: true });
    try {
      expect(reader.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all()).toHaveLength(103);
      expect(reader.prepare('SELECT * FROM wide').columns().map((column) => column.name)).toEqual(columns);
      expect(reader.prepare('SELECT c999 FROM wide').get()?.['c999']).toBe(999);
    } finally { reader.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
