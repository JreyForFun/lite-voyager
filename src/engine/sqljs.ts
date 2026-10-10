import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Cursor, Parameter, ReadBackend } from './engine';
import { readFallback, type FileSnapshot } from './file-snapshot';

// Narrow declarations for the documented, already-installed sql.js API.
// https://sql.js.org/documentation/Statement.html and Database.html
interface WasmStatement {
  bind(parameters: Parameter[]): void;
  step(): boolean;
  get(parameters: null, options: { useBigInt: true }): unknown[];
  getColumnNames(): string[];
  free(): boolean;
}
interface WasmDatabase { prepare(sql: string): WasmStatement; run(sql: string): void; close(): void; }
interface WasmModule { Database: new (bytes: Uint8Array) => WasmDatabase; }
type InitializeWasm = (options: { wasmBinary: Uint8Array }) => Promise<WasmModule>;

/** Worker-only memory-backed implementation, using exclusively packaged assets. */
export class SqlJsEngine implements ReadBackend {
  private constructor(private readonly database: WasmDatabase) {}

  static async open(snapshot: FileSnapshot, directory: string): Promise<SqlJsEngine> {
    const requireLocal = createRequire(__filename);
    const loaded: unknown = requireLocal(join(directory, 'sql-wasm.cjs'));
    if (typeof loaded !== 'function') { throw new Error('Memory-limited mode could not initialize the packaged sql.js engine. Rebuild and retry.'); }
    const module = await (loaded as InitializeWasm)({ wasmBinary: readFileSync(join(directory, 'sql-wasm.wasm')) });
    const bytes = readFallback(snapshot);
    const database = new module.Database(bytes);
    try { database.run('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON'); }
    catch (error: unknown) { database.close(); throw error; }
    return new SqlJsEngine(database);
  }

  cursor(sql: string, parameters: Parameter[]): Cursor {
    const statement = this.database.prepare(sql);
    try {
      statement.bind(parameters);
      return {
        columns: statement.getColumnNames(),
        rows: (function* () {
          while (statement.step()) { yield statement.get(null, { useBigInt: true }); }
        })(),
        close: () => { statement.free(); },
      };
    } catch (error: unknown) { statement.free(); throw error; }
  }

  close(): void { this.database.close(); }
}
