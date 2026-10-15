import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TextDecoder } from 'node:util';
import { expect, test, vi } from 'vitest';
import { NodeSqliteEngine } from '../../src/engine/node-sqlite';
import { collectPage } from '../../src/engine/read-engine';

test('NFR-003: Given thousands of large native TEXT rows before a page, When reading the page or passing the end, Then only returned/lookahead values are decoded and exact totals survive', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-native-paging-'));
  const path = join(directory, 'source.sqlite');
  const writer = new DatabaseSync(path);
  writer.exec("CREATE TABLE records(id INTEGER, payload TEXT); WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<6999) INSERT INTO records SELECT x,printf('%.*c',4095,'x') FROM n");
  writer.close();
  const backend = new NodeSqliteEngine({ DatabaseSync } as typeof import('node:sqlite'), path);
  const decode = vi.spyOn(TextDecoder.prototype, 'decode');
  try {
    const page = collectPage(backend.cursor('SELECT * FROM records', []), { offset: 6000, limit: 100 });
    expect(page.columns).toEqual(['id', 'payload']); expect(page.hasMore).toBe(true);
    expect(page.rows).toEqual(Array.from({ length: 100 }, (_, index) => [String(6000 + index), 'x'.repeat(4095)]));
    expect(decode).toHaveBeenCalledTimes(101);
    decode.mockClear();
    const pastEnd = collectPage(backend.cursor('SELECT * FROM records', []), { offset: 10000, limit: 100 });
    expect(pastEnd.rows.length).toBe(0);
    expect(pastEnd).toEqual({ columns: ['id', 'payload'], rows: [], hasMore: false, total: '7000' });
    expect(decode).not.toHaveBeenCalled();
    expect(collectPage(backend.cursor('SELECT * FROM records', []), { offset: 7000, limit: 100 }))
      .toEqual({ columns: ['id', 'payload'], rows: [], hasMore: false });
    expect(collectPage(backend.cursor('SELECT * FROM records WHERE 0', []), { offset: 0, limit: 100 }))
      .toEqual({ columns: ['id', 'payload'], rows: [], hasMore: false });
    expect(decode).not.toHaveBeenCalled();
  } finally { decode.mockRestore(); backend.close(); await rm(directory, { recursive: true, force: true }); }
});

test('FR-018: Given paged nondeterministic expressions and bound Unicode/NUL text, When skipping native rows, Then one execution preserves aliases, int64, BLOBs and exact end counts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-native-once-')); const path = join(directory, 'source.sqlite');
  new DatabaseSync(path).close(); let calls = 0;
  class CountingDatabase extends DatabaseSync {
    constructor(databasePath: string, options?: import('node:sqlite').DatabaseSyncOptions) {
      super(databasePath, options); this.function('next_value', () => (++calls % 2 === 0 ? 'text' : calls));
    }
  }
  const backend = new NodeSqliteEngine({ DatabaseSync: CountingDatabase } as typeof import('node:sqlite'), path);
  const sql = 'WITH n(x) AS (VALUES(1),(2),(3),(4),(5)) SELECT next_value() AS "", ? AS "", 9223372036854775807 AS exact, zeroblob(3) AS bytes FROM n; -- tail';
  const bound = '\uFEFFbefore\0after🚀';
  try {
    const page = collectPage(backend.cursor(sql, [bound]), { offset: 2, limit: 2 });
    expect(page.columns).toEqual(['', '', 'exact', 'bytes']); expect(page.hasMore).toBe(true); expect(calls).toBe(5);
    expect(page.rows).toEqual([['3', bound, '9223372036854775807', '[BLOB 3 bytes]'], ['text', bound, '9223372036854775807', '[BLOB 3 bytes]']]);
    calls = 0;
    expect(collectPage(backend.cursor(sql, [bound]), { offset: 10, limit: 2 }))
      .toEqual({ columns: ['', '', 'exact', 'bytes'], rows: [], hasMore: false, total: '5' });
    expect(calls).toBe(5);
    expect(() => collectPage(backend.cursor("WITH n(x) AS (VALUES(1),(2)) SELECT CASE WHEN x=2 THEN CAST(x'80' AS TEXT) ELSE 'valid' END FROM n", []), { offset: 1, limit: 1 })).toThrow(/not valid/);
    expect(collectPage(backend.cursor("SELECT 'recovered'", []), {}).rows).toEqual([['recovered']]);
  } finally { backend.close(); await rm(directory, { recursive: true, force: true }); }
});
