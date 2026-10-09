import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { parentPort, threadId, workerData } from 'node:worker_threads';
import type { SpikeCell, SpikeParameter, SpikeRequest, SpikeResponse, SpikeResult, SpikeWorkerOptions } from './sqlite-spike-protocol';

const port = parentPort;
if (port === null) { throw new Error('The SQLite spike must run in a worker.'); }
const requireLocal = createRequire(__filename);
const fallbackBytes = 8 * 1024 * 1024;
const pageBytes = 256 * 1024;

// Narrow adapter for the documented sql.js APIs; avoids an additional types dependency.
// https://sql.js.org/documentation/Statement.html and Database.html
interface WasmStatement {
  bind(parameters: SpikeParameter[]): void;
  step(): boolean;
  get(parameters: null, options: { useBigInt: true }): unknown[];
  getColumnNames(): string[];
  free(): boolean;
}
interface WasmDatabase {
  prepare(sql: string): WasmStatement;
  run(sql: string): void;
  close(): void;
}
interface WasmModule { Database: new (bytes: Uint8Array) => WasmDatabase; }
type InitializeWasm = (options: { wasmBinary: Uint8Array }) => Promise<WasmModule>;
interface Cursor { columns: string[]; rows: Iterable<unknown[]>; }

function optionsFrom(value: unknown): SpikeWorkerOptions {
  if (typeof value !== 'object' || value === null || !('path' in value) || typeof value.path !== 'string'
    || !('fallbackDirectory' in value) || typeof value.fallbackDirectory !== 'string'
    || !('simulateUnavailable' in value) || typeof value.simulateUnavailable !== 'boolean') {
    throw new Error('Invalid SQLite spike options.');
  }
  return { path: value.path, fallbackDirectory: value.fallbackDirectory, simulateUnavailable: value.simulateUnavailable };
}

function loadBuiltin(simulateUnavailable: boolean): typeof import('node:sqlite') | undefined {
  try {
    // Both the real and simulated-absence cases use Node's built-in module resolver.
    const loaded: unknown = requireLocal(simulateUnavailable ? 'node:lite-voyager-sqlite-unavailable' : 'node:sqlite');
    return loaded as typeof import('node:sqlite');
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_UNKNOWN_BUILTIN_MODULE') { return undefined; }
    throw error;
  }
}

function checkHeader(path: string): void {
  const file = openSync(path, 'r');
  try {
    const header = Buffer.alloc(16);
    if (readSync(file, header, 0, 16, 0) !== 16 || header.toString('ascii') !== 'SQLite format 3\0') {
      throw new Error('Not a SQLite database.');
    }
  } finally { closeSync(file); }
}

function fallbackFile(path: string): Uint8Array {
  const file = openSync(path, 'r');
  try {
    const size = fstatSync(file).size;
    if (size > fallbackBytes) { throw new Error('Memory-limited spike mode accepts fixtures up to 8 MiB. Use a smaller fixture or a host with node:sqlite.'); }
    const buffer = Buffer.alloc(Math.min(size + 1, fallbackBytes + 1));
    let length = 0;
    while (length < buffer.length) {
      const bytes = readSync(file, buffer, length, buffer.length - length, null);
      if (bytes === 0) { break; }
      length += bytes;
    }
    if (length !== size) { throw new Error('The file changed while being opened. Retry after its writer closes it.'); }
    return buffer.subarray(0, length);
  } finally { closeSync(file); }
}

function nativeCursor(db: DatabaseSync, sql: string, parameters: SpikeParameter[]): Cursor {
  const statement = db.prepare(sql);
  statement.setReadBigInts(true);
  statement.setReturnArrays(true);
  return {
    columns: statement.columns().map((column) => column.name),
    rows: (function* () {
      for (const row of statement.iterate(...parameters)) {
        const value: unknown = row;
        if (!Array.isArray(value)) { throw new Error('Invalid native result shape.'); }
        yield value as unknown[];
      }
    })(),
  };
}

function wasmCursor(db: WasmDatabase, sql: string, parameters: SpikeParameter[]): Cursor {
  const statement = db.prepare(sql);
  try { statement.bind(parameters); }
  catch (error: unknown) { statement.free(); throw error; }
  return {
    columns: statement.getColumnNames(),
    rows: (function* () {
      try { while (statement.step()) { yield statement.get(null, { useBigInt: true }); } }
      finally { statement.free(); }
    })(),
  };
}

function display(value: unknown): SpikeCell {
  if (value === null) { return null; }
  if (typeof value === 'string' || typeof value === 'bigint' || typeof value === 'number') { return String(value); }
  if (value instanceof Uint8Array) { return `[BLOB ${String(value.byteLength)} bytes]`; }
  throw new Error('Unsupported SQLite value.');
}

function collect(cursor: Cursor): SpikeResult {
  const rows: SpikeCell[][] = [];
  let bytes = Buffer.byteLength(JSON.stringify(cursor.columns));
  if (bytes > pageBytes) { throw new Error('The spike page exceeds 256 KiB. Select fewer columns or smaller text values.'); }
  for (const row of cursor.rows) {
    if (rows.length === 100) { return { columns: cursor.columns, rows, hasMore: true }; }
    const cells = row.map(display);
    bytes += Buffer.byteLength(JSON.stringify(cells));
    if (bytes > pageBytes) { throw new Error('The spike page exceeds 256 KiB. Select fewer columns or smaller text values.'); }
    rows.push(cells);
  }
  return { columns: cursor.columns, rows, hasMore: false };
}

/** Only one read statement; skip comments and quoted literals when finding separators. */
function checkReadStatement(sql: string): void {
  let first = '';
  let ended = false;
  for (let index = 0; index < sql.length;) {
    const character = sql[index];
    if (character === undefined) { break; }
    if (/\s/.test(character)) { index++; continue; }
    if (sql.startsWith('--', index)) { const next = sql.indexOf('\n', index); index = next === -1 ? sql.length : next + 1; continue; }
    if (sql.startsWith('/*', index)) {
      const next = sql.indexOf('*/', index + 2);
      if (next === -1) { throw new Error('The spike query has an unfinished comment.'); }
      index = next + 2; continue;
    }
    if (ended) { throw new Error('Run only one statement in the SQLite spike.'); }
    if (character === ';') { ended = true; index++; continue; }
    if (character === "'" || character === '"' || character === '`' || character === '[') {
      const closing = character === '[' ? ']' : character;
      index++;
      while (index < sql.length) {
        if (sql[index++] === closing) {
          if (character !== '[' && sql[index] === closing) { index++; }
          else { break; }
        }
      }
      continue;
    }
    const word = /^[A-Za-z_]+/.exec(sql.slice(index))?.[0];
    if (first === '' && word !== undefined) { first = word.toUpperCase(); }
    index += word?.length ?? 1;
  }
  if (!['SELECT', 'WITH', 'EXPLAIN'].includes(first)) { throw new Error('The read-only SQLite spike accepts SELECT, WITH, or EXPLAIN queries.'); }
}

async function start(): Promise<void> {
  const options = optionsFrom(workerData as unknown);
  const sqlite = loadBuiltin(options.simulateUnavailable);
  // Enforce the documented fallback cap before opening, including invalid large files.
  const bytes = sqlite === undefined ? fallbackFile(options.path) : undefined;
  checkHeader(options.path);
  let native: DatabaseSync | undefined;
  let wasm: WasmDatabase | undefined;
  try {
    if (sqlite !== undefined) {
      native = new sqlite.DatabaseSync(options.path, { readOnly: true, allowExtension: false });
      native.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON');
    } else {
      const loaded: unknown = requireLocal(join(options.fallbackDirectory, 'sql-wasm.cjs'));
      if (typeof loaded !== 'function') { throw new Error('The packaged sql.js initializer is unavailable.'); }
      if (bytes === undefined) { throw new Error('The fallback file was not loaded.'); }
      const module = await (loaded as InitializeWasm)({ wasmBinary: readFileSync(join(options.fallbackDirectory, 'sql-wasm.wasm')) });
      wasm = new module.Database(bytes);
      wasm.run('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON');
    }
    const query = (sql: string, parameters: SpikeParameter[]): SpikeResult => {
      if (native !== undefined) { return collect(nativeCursor(native, sql, parameters)); }
      if (wasm !== undefined) { return collect(wasmCursor(wasm, sql, parameters)); }
      throw new Error('No spike database is open.');
    };
    // Reading sqlite_schema forces validation; open alone may accept truncated files.
    query('SELECT name FROM sqlite_schema LIMIT 1', []);
    const trustedSchemaOff = query('PRAGMA trusted_schema', []).rows[0]?.[0] === '0';
    const extensionLoadingDisabled = sqlite !== undefined || query("SELECT name FROM pragma_function_list WHERE name='load_extension'", []).rows.length === 0;
    if (!trustedSchemaOff || !extensionLoadingDisabled) { throw new Error('SQLite safety settings could not be confirmed.'); }
    const response: SpikeResponse = {
      type: 'opened', value: {
        engine: sqlite === undefined ? 'sql.js' : 'node:sqlite', threadId, processId: process.pid, node: process.versions.node,
        sqlite: query('SELECT sqlite_version()', []).rows[0]?.[0] ?? 'unknown',
        memoryLimited: sqlite === undefined, trustedSchemaOff, extensionLoadingDisabled,
        notice: sqlite === undefined ? 'Memory-limited spike mode: fixtures up to 8 MiB.' : 'Primary engine reads from disk.',
      },
    };
    port?.postMessage(response);
    port?.on('message', (request: SpikeRequest) => {
      const started: SpikeResponse = { type: 'started', id: request.id };
      port.postMessage(started);
      try {
        checkReadStatement(request.sql);
        const result: SpikeResponse = { type: 'result', id: request.id, value: query(request.sql, request.parameters) };
        port.postMessage(result);
      } catch (error: unknown) {
        const text = error instanceof Error ? error.message : '';
        const actionable = /^(Run only one|The read-only|The spike)/.test(text);
        const response: SpikeResponse = { type: 'queryFailed', id: request.id, message: actionable ? text : 'The SQLite spike query failed. Check the SQL and keep it read-only.' };
        port.postMessage(response);
      }
    });
  } catch (error: unknown) {
    native?.close(); wasm?.close();
    throw error;
  }
}

void start().catch((error: unknown) => {
  const text = error instanceof Error ? error.message : '';
  const message = /^(Memory-limited|The file changed)/.test(text) ? `Unable to open: ${text}`
    : 'Unable to open the SQLite file. Check that it exists, is readable, and is a valid complete database.';
  const response: SpikeResponse = { type: 'failed', message };
  port.postMessage(response);
  port.close();
});
