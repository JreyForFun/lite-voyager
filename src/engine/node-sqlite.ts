import type { DatabaseSync } from 'node:sqlite';
import { TextDecoder } from 'node:util';
import type { Cursor, Parameter, ReadBackend } from './engine';
import { checkReadStatement } from './read-engine';

/** Worker-only disk-backed implementation. No user file is opened for writing. */
export class NodeSqliteEngine implements ReadBackend {
  private readonly database: DatabaseSync;
  private readonly decoder: TextDecoder;

  constructor(sqlite: typeof import('node:sqlite'), path: string) {
    this.database = new sqlite.DatabaseSync(path, { readOnly: true, allowExtension: false });
    // Connection-local temporary sort storage may spill to disk. This never
    // writes the read-only source. https://www.sqlite.org/pragma.html#pragma_temp_store
    try { this.database.exec('PRAGMA temp_store=FILE; PRAGMA trusted_schema=OFF; PRAGMA query_only=ON'); }
    catch (error: unknown) { this.database.close(); throw error; }
    const encoding = this.database.prepare('PRAGMA encoding').get()?.['encoding'];
    if (typeof encoding !== 'string') { this.database.close(); throw new Error('SQLite text encoding could not be confirmed.'); }
    this.decoder = new TextDecoder(encoding.toLowerCase(), { fatal: true, ignoreBOM: true });
  }

  cursor(sql: string, parameters: Parameter[]): Cursor {
    const columns = this.database.prepare(sql).columns().map((column) => column.name);
    // Native string conversion replaces invalid encoded TEXT. Transport text
    // as ASCII hex instead, then decode losslessly in the worker. The OFFSET 0
    // subquery prevents flattening/re-evaluation of nondeterministic values;
    // it streams one row at a time, without MATERIALIZED or a collected table.
    // https://www.sqlite.org/optoverview.html#subquery_flattening (rule 14)
    const first = sql.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/u, '');
    const encoded = /^(SELECT|WITH)\b/iu.test(first);
    let readSql = sql;
    if (encoded) {
      const original = checkReadStatement(sql);
      let alias = '__lite_voyager_result_0'; let ordinal = 0;
      // An outer CTE must never shadow an identifier referenced by user SQL.
      while (original.toLowerCase().includes(alias)) { alias = `__lite_voyager_result_${String(++ordinal)}`; }
      const names = columns.map((_column, index) => `c${String(index)}`);
      readSql = `WITH ${alias}(${names.join(',')}) AS (SELECT * FROM (${original}\n) LIMIT -1 OFFSET 0) SELECT ${names.map((name) =>
        `CASE WHEN typeof(${name})='text' THEN 't'||hex(CAST(${name} AS BLOB)) ELSE ${name} END`).join(',')} FROM ${alias}`;
    }
    const statement = this.database.prepare(readSql);
    statement.setReadBigInts(true);
    statement.setReturnArrays(true);
    const iterator = statement.iterate(...parameters);
    const decoder = this.decoder;
    let exhausted = false;
    return {
      columns,
      // Advance the same native iterator. Offset rows never need Buffer/text
      // decoding, and an exhausted iterator still gives the exact observed total.
      skipRows: (count) => {
        let skipped = 0;
        while (!exhausted && skipped < count) {
          if (iterator.next().done) { exhausted = true; }
          else { skipped++; }
        }
        return skipped;
      },
      rows: (function* () {
        // A native iterator can restart after exhaustion. Never re-enter it
        // after skipRows reaches the end, or rerun nondeterministic SQL.
        if (exhausted) { return; }
        for (const row of iterator) {
          const value: unknown = row;
          if (!Array.isArray(value)) { throw new Error('Invalid native result shape.'); }
          yield encoded ? value.map((cell: unknown) => {
            if (typeof cell !== 'string') { return cell; }
            if (!/^t(?:[\da-f]{2})*$/iu.test(cell)) { throw new Error('Invalid native text transport.'); }
            try { return decoder.decode(Buffer.from(cell.slice(1), 'hex')); }
            catch { throw new Error('The SQLite TEXT is not valid in its declared encoding. The value was not replaced or truncated.'); }
          }) : value as unknown[];
        }
      })(),
      close: () => { exhausted = true; iterator.return?.(); },
    };
  }

  close(): void { this.database.close(); }
}
