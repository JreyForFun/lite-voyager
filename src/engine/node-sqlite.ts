import type { DatabaseSync } from 'node:sqlite';
import type { Cursor, Parameter, ReadBackend } from './engine';

/** Worker-only disk-backed implementation. No user file is opened for writing. */
export class NodeSqliteEngine implements ReadBackend {
  private readonly database: DatabaseSync;

  constructor(sqlite: typeof import('node:sqlite'), path: string) {
    this.database = new sqlite.DatabaseSync(path, { readOnly: true, allowExtension: false });
    try { this.database.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON'); }
    catch (error: unknown) { this.database.close(); throw error; }
  }

  cursor(sql: string, parameters: Parameter[]): Cursor {
    const statement = this.database.prepare(sql);
    statement.setReadBigInts(true);
    statement.setReturnArrays(true);
    const iterator = statement.iterate(...parameters);
    return {
      columns: statement.columns().map((column) => column.name),
      rows: (function* () {
        for (const row of iterator) {
          const value: unknown = row;
          if (!Array.isArray(value)) { throw new Error('Invalid native result shape.'); }
          yield value as unknown[];
        }
      })(),
      close: () => { iterator.return?.(); },
    };
  }

  close(): void { this.database.close(); }
}
