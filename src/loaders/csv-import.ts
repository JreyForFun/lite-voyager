import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { EngineName } from '../engine/engine';
import { quoteIdentifier } from '../engine/read-engine';
import type { ImportedTable, LoadOptions, Progress } from './file-loader';
import { detectedPreview } from './csv-detection';
import { streamRecords } from './csv-records';

export const FALLBACK_IMPORT_SOURCE_BYTES = 20_000_000;
export const FALLBACK_IMPORT_DATABASE_BYTES = 64_000_000;
type ColumnType = 'INTEGER' | 'REAL' | 'TEXT';
export interface Insert { run(values: (string | null)[]): void; close(): void; }
interface ImportDatabase {
  exec(sql: string): void; insert(sql: string): Insert; size(): number; finish(path: string): void; close(): void;
}
interface WasmStatement { bind(values: (string | null | Uint8Array)[]): boolean; step(): boolean; free(): boolean; }
interface WasmDatabase {
  run(sql: string): void; prepare(sql: string): WasmStatement; exec(sql: string): { values: unknown[][] }[];
  export(): Uint8Array; close(): void;
}
interface WasmModule { Database: new () => WasmDatabase; }
type InitializeWasm = (options: { wasmBinary: Uint8Array }) => Promise<WasmModule>;
export interface CsvImportJob { source: string; path: string; directory: string; engine: EngineName; options: LoadOptions; format?: 'json' | 'jsonl' | 'xlsx'; xlsxSnapshot?: import('./xlsx-consent').XlsxSnapshot; }

export function inferredType(value: string): ColumnType {
  if (/^(0|-[1-9]\d*|[1-9]\d*)$/u.test(value)) {
    // Do not allocate an arbitrarily large BigInt for a huge string field.
    if (value.length > 20) { return 'TEXT'; }
    const integer = BigInt(value);
    return integer >= -9223372036854775808n && integer <= 9223372036854775807n ? 'INTEGER' : 'TEXT';
  }
  if (value.length < 32 && /[.eE]/u.test(value)) {
    const number = Number(value);
    if (Number.isFinite(number) && String(number) === value) { return 'REAL'; }
  }
  return 'TEXT';
}

export async function openImportDatabase(job: CsvImportJob): Promise<{ db: ImportDatabase; engine: EngineName }> {
  const requireLocal = createRequire(__filename);
  if (job.engine !== 'sql.js') {
    let native: { DatabaseSync: typeof DatabaseSync } | undefined;
    try { native = requireLocal('node:sqlite') as { DatabaseSync: typeof DatabaseSync }; }
    catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      if (code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && code !== 'ERR_UNKNOWN_MODULE') { throw error; }
    }
    if (native !== undefined) {
      const db = new native.DatabaseSync(job.path);
      return { engine: 'node:sqlite', db: {
        exec: (sql) => { db.exec(sql); }, insert: (sql) => {
          const statement = db.prepare(sql); return { run: (values) => { statement.run(...values); }, close: () => {} };
        }, size: () => 0, finish: () => {}, close: () => { db.close(); },
      } };
    }
  }
  const inputBytes = statSync(job.source, { bigint: true }).size;
  if (inputBytes > BigInt(FALLBACK_IMPORT_SOURCE_BYTES)) { throw new Error('Memory-limited mode: imports are limited to 20,000,000 source bytes and 64,000,000 SQLite bytes. Update VS Code to use the disk-backed engine. Nothing was imported.'); }
  const initialize: unknown = requireLocal(join(job.directory, 'sql-wasm.cjs'));
  if (typeof initialize !== 'function') { throw new Error('Packaged sql.js could not initialize. Rebuild the extension.'); }
  const module = await (initialize as InitializeWasm)({ wasmBinary: readFileSync(join(job.directory, 'sql-wasm.wasm')) });
  const db = new module.Database();
  return { engine: 'sql.js', db: {
    exec: (sql) => { db.run(sql); }, insert: (sql) => {
      const statement = db.prepare(sql); return { run: (values) => {
        // sql.js bindString passes -1 to sqlite3_bind_text, so embedded NUL needs
        // length-aware blob binding. JSON's placeholder casts it back to TEXT.
        statement.bind(values.map((value) => value?.includes('\0') === true ? new TextEncoder().encode(value) : value)); statement.step();
      }, close: () => { statement.free(); } };
    }, size: () => {
      const pages = db.exec('PRAGMA page_count')[0]?.values[0]?.[0]; const pageSize = db.exec('PRAGMA page_size')[0]?.values[0]?.[0];
      if (typeof pages !== 'number' || typeof pageSize !== 'number') { throw new Error('Memory-limited engine could not report storage usage.'); }
      return pages * pageSize;
    }, finish: (path) => { writeFileSync(path, db.export(), { flag: 'wx' }); }, close: () => { db.close(); },
  } };
}

/** Runs only inside the supervised worker; never exposes a writable source engine. */
export async function importCsv(job: CsvImportJob, onProgress: (progress: Progress) => void): Promise<ImportedTable[]> {
  const sourceSnapshot = statSync(job.source, { bigint: true });
  const preview = detectedPreview(job.source, job.options);
  const { db, engine } = await openImportDatabase(job);
  let insert: Insert | undefined; let transaction = false; let rows = 0n; let first = true;
  const columns: string[] = []; const names = new Set<string>(); const types: (ColumnType | undefined)[] = [];
  let renamed = false; let ragged = false; let lastProgress = 0; let finalBytes = '0'; let totalBytes = preview.totalBytes;
  let orderColumn = '_rowid_'; let internalOrder = false;
  const modeNotice = engine === 'sql.js' ? 'Memory-limited mode: at most 20,000,000 source bytes and 64,000,000 SQLite bytes. Update VS Code for disk-backed imports.' : 'Disk-backed import; source file stays unchanged.';
  const guard = (): void => {
    if (engine === 'sql.js' && db.size() > FALLBACK_IMPORT_DATABASE_BYTES) { throw new Error('Memory-limited import exceeded 64,000,000 SQLite bytes. Update VS Code for disk-backed imports. No table was published.'); }
  };
  const addColumns = (headers: string[]): void => {
    insert?.close(); insert = undefined;
    const oldWidth = columns.length;
    for (const header of headers) {
      const base = header.trim() === '' ? `column_${String(columns.length + 1)}` : header;
      let name = base; let suffix = 2;
      const fold = (value: string): string => value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
      while (names.has(fold(name))) { name = `${base}_${String(suffix++)}`; }
      names.add(fold(name)); if (name !== header) { renamed = true; }
      columns.push(name); types.push(job.options.allText === true || rows >= 100n ? 'TEXT' : undefined);
    }
    if (oldWidth === 0) {
      const alias = ['_rowid_', 'rowid', 'oid'].find((name) => !names.has(name));
      internalOrder = alias === undefined; orderColumn = alias ?? '__lv_order';
      if (internalOrder) { while (names.has(orderColumn)) { orderColumn += '_'; } }
      db.exec(`CREATE TABLE "__stage" (${internalOrder ? `${quoteIdentifier(orderColumn)} INTEGER PRIMARY KEY,` : ''}${columns.map((name) => `${quoteIdentifier(name)} TEXT`).join(',')})`);
    } else {
      for (const name of columns.slice(oldWidth)) { db.exec(`ALTER TABLE "__stage" ADD COLUMN ${quoteIdentifier(name)} TEXT`); }
    }
    insert = db.insert(`INSERT INTO "__stage" (${columns.map(quoteIdentifier).join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
  };
  try {
    db.exec('PRAGMA cache_size=-8192; PRAGMA temp_store=FILE; PRAGMA trusted_schema=OFF; PRAGMA user_version=0');
    streamRecords(job.source, preview.delimiter, (fields) => {
      if (first) {
        first = false; addColumns(job.options.header !== false ? fields : fields.map((_, i) => `column_${String(i + 1)}`));
        if (job.options.header !== false) { return; }
        renamed = false;
      }
      if (fields.length !== columns.length) { ragged = true; }
      if (fields.length > columns.length) { addColumns(fields.slice(columns.length).map(() => '')); }
      const values: (string | null)[] = [...fields, ...Array.from({ length: columns.length - fields.length }, () => null)];
      values.forEach((value, i) => {
        if (value === null || types[i] === 'TEXT') { return; }
        const candidate = inferredType(value);
        if (types[i] === undefined) { types[i] = rows < 100n ? candidate : 'TEXT'; }
        else if (types[i] !== candidate) { types[i] = 'TEXT'; }
      });
      if (!transaction) { db.exec('BEGIN'); transaction = true; }
      insert?.run(values); rows++;
      if (rows % 1000n === 0n) { db.exec('COMMIT'); transaction = false; guard(); }
    }, (bytes, total) => {
      finalBytes = String(bytes); totalBytes = String(total);
      if (engine === 'sql.js' && total > BigInt(FALLBACK_IMPORT_SOURCE_BYTES)) { throw new Error('Memory-limited source exceeds 20,000,000 bytes. Update VS Code.'); }
      const now = performance.now();
      if (bytes === 0n || now - lastProgress >= 100 || bytes === total) {
        onProgress({ bytes: finalBytes, totalBytes, rows: String(rows), phase: 'reading', engine, notice: modeNotice, processId: process.pid }); lastProgress = now;
      }
    });
    insert?.close(); insert = undefined;
    if (transaction) { db.exec('COMMIT'); transaction = false; }
    onProgress({ bytes: finalBytes, totalBytes, rows: String(rows), phase: 'publishing', engine, notice: modeNotice, processId: process.pid });
    if (columns.length > 0) {
      if (!internalOrder && types.every((type) => type === 'TEXT' || type === undefined)) { db.exec('ALTER TABLE "__stage" RENAME TO "records"'); }
      else {
        db.exec('BEGIN'); transaction = true;
        db.exec(`CREATE TABLE "records" (${columns.map((name, i) => `${quoteIdentifier(name)} ${types[i] ?? 'TEXT'}`).join(',')})`);
        db.exec(`INSERT INTO "records" SELECT ${columns.map((name, i) => types[i] === 'INTEGER' || types[i] === 'REAL'
          ? `CAST(${quoteIdentifier(name)} AS ${types[i]})` : quoteIdentifier(name)).join(',')} FROM "__stage" ORDER BY ${quoteIdentifier(orderColumn)}`);
        guard(); db.exec('DROP TABLE "__stage"'); db.exec('COMMIT'); transaction = false;
      }
    }
    guard(); db.finish(job.path);
    const finalSnapshot = statSync(job.source, { bigint: true });
    if (['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].some((key) => sourceSnapshot[key as keyof typeof sourceSnapshot] !== finalSnapshot[key as keyof typeof finalSnapshot])) {
      throw new Error('The CSV changed during import finalization. Close its writer and reopen; no table was published.');
    }
    const notice = `${modeNotice} Missing fields are SQL NULL; empty fields and literal NULL remain text.${renamed ? ' Blank/duplicate headers received unique names.' : ''}${ragged ? ' Ragged rows retain all fields.' : ''} Inference preserves original values when a column widens to text.`;
    return columns.length === 0 ? [] : [{ name: 'records', columns, rowCount: String(rows), engine, notice }];
  } finally { insert?.close(); if (transaction) { db.exec('ROLLBACK'); } db.close(); }
}
