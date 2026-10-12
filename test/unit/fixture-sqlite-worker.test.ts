import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';

test.each([false, true])('T-005: Given stress generation with injected failure=%s, When the real SQLite writes run, Then one transaction preserves complete data or rolls back and closes the database', async (fail) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-stress-transaction-'));
  const writesInTransaction: boolean[] = [];
  const boundaries: string[] = [];
  let closed = false;
  class ObservedDatabase extends DatabaseSync {
    override exec(sql: string): void {
      if (sql === 'BEGIN' || sql === 'COMMIT') { boundaries.push(sql); }
      if (sql.startsWith('CREATE TABLE')) { writesInTransaction.push(this.isTransaction); }
      super.exec(sql);
      if (fail && sql.startsWith('CREATE TABLE wide')) { throw new Error('Injected stress generation failure.'); }
    }
    override prepare(sql: string): StatementSync {
      writesInTransaction.push(this.isTransaction);
      return super.prepare(sql);
    }
    override close(): void { super.close(); closed = true; }
  }
  vi.doMock('node:sqlite', () => ({ DatabaseSync: ObservedDatabase }));
  vi.doMock('node:worker_threads', () => ({ workerData: { mode: 'stress', directory } }));
  vi.resetModules();
  try {
    const generation = import('../../scripts/fixture-sqlite-worker.mts');
    if (fail) { await expect(generation).rejects.toThrow('Injected stress generation failure.'); }
    else { await generation; }
    expect(closed).toBe(true);
    expect(writesInTransaction.length).toBe(fail ? 3 : 4);
    expect(writesInTransaction.every(Boolean)).toBe(true);
    expect(boundaries).toEqual(fail ? ['BEGIN'] : ['BEGIN', 'COMMIT']);
    const db = new DatabaseSync(join(directory, 'stress.sqlite'), { readOnly: true });
    try {
      if (fail) { expect(db.prepare('SELECT name FROM sqlite_schema WHERE type = ?').all('table')).toEqual([]); }
      else {
        expect(db.prepare('SELECT length(value) AS size FROM large_cell').get()).toMatchObject({ size: 1_048_577 });
        expect(db.prepare('PRAGMA table_info(wide)').all()).toHaveLength(1000);
        expect(Object.values(db.prepare('SELECT * FROM wide').get() ?? {})).toEqual(Array.from({ length: 1000 }, (_, index) => index));
        expect(db.prepare('PRAGMA integrity_check').get()).toMatchObject({ integrity_check: 'ok' });
      }
    } finally { db.close(); }
  } finally {
    vi.doUnmock('node:sqlite');
    vi.doUnmock('node:worker_threads');
    vi.resetModules();
    await rm(directory, { recursive: true, force: true });
  }
});
