import { statSync } from 'node:fs';
import { quoteIdentifier } from '../engine/read-engine';
import type { ImportedTable, Progress } from './file-loader';
import { FALLBACK_IMPORT_DATABASE_BYTES, FALLBACK_IMPORT_SOURCE_BYTES, openImportDatabase, type CsvImportJob, type Insert } from './csv-import';
import { JsonColumns, JSON_NOTICE } from './json-columns';
import { parseJsonObject, streamJsonRecords, type JsonCell } from './json-records';

/** Worker only. No affinity: preserve mixed JSON scalar types within a column. */
export async function importJson(job: CsvImportJob, onProgress: (progress: Progress) => void): Promise<ImportedTable[]> {
  if (job.format !== 'json' && job.format !== 'jsonl') { throw new Error('Choose JSON array or JSONL import.'); }
  const sourceSnapshot = statSync(job.source, { bigint: true });
  const { db, engine } = await openImportDatabase(job); const columns = new JsonColumns();
  let insert: Insert | undefined; let signature = ''; let rows = 0n; let pendingEmpty = 0n; let transaction = false; let lastProgress = 0;
  const guard = (): void => { if (engine === 'sql.js' && db.size() > FALLBACK_IMPORT_DATABASE_BYTES) { throw new Error('Memory-limited JSON import exceeded 64,000,000 SQLite bytes. Update VS Code. No table was published.'); } };
  const begin = (): void => { if (!transaction) { db.exec('BEGIN'); transaction = true; } };
  const commit = (): void => { if (transaction) { db.exec('COMMIT'); transaction = false; guard(); } };
  const write = (record: Map<string, JsonCell>): void => {
    const values = [...columns.mapping.keys()].map((key) => record.get(key) ?? { text: null, kind: 'null' as const });
    const expression = (value: JsonCell): string => value.kind === 'integer' ? 'CAST(? AS INTEGER)' : value.kind === 'real' ? 'CAST(? AS REAL)' : value.text?.includes('\0') === true ? 'CAST(? AS TEXT)' : '?';
    const next = values.map(expression).join(',');
    if (insert === undefined || signature !== next) {
      insert?.close(); signature = next;
      insert = db.insert(`INSERT INTO records (${[...columns.mapping.values()].map(quoteIdentifier).join(',')}) VALUES (${next})`);
    }
    begin(); insert.run(values.map((value) => value.text));
  };
  const flushEmpty = (placeholder = false): void => {
    for (let index = 0n; index < pendingEmpty; index++) {
      write(placeholder ? new Map<string, JsonCell>([['__json_object', { text: '{}', kind: 'text' }]]) : new Map<string, JsonCell>());
      if (index % 1000n === 999n) { commit(); }
    }
    pendingEmpty = 0n;
  };
  try {
    db.exec('PRAGMA cache_size=-8192; PRAGMA temp_store=FILE; PRAGMA trusted_schema=OFF; PRAGMA user_version=0');
    const result = streamJsonRecords(job.source, job.format, (raw) => {
      const record = parseJsonObject(raw); const previousWidth = columns.mapping.size; const added = columns.add(record.keys());
      if (added.length > 0) {
        insert?.close(); insert = undefined;
        if (previousWidth === 0) { db.exec(`CREATE TABLE records (${added.map(quoteIdentifier).join(',')})`); }
        else { for (const name of added) { db.exec(`ALTER TABLE records ADD COLUMN ${quoteIdentifier(name)}`); } }
        flushEmpty();
      }
      if (columns.mapping.size === 0) { pendingEmpty++; } else { write(record); }
      rows++; if (rows % 1000n === 0n) { commit(); }
    }, (bytes, total) => {
      if (engine === 'sql.js' && total > BigInt(FALLBACK_IMPORT_SOURCE_BYTES)) { throw new Error('Memory-limited JSON source exceeds 20,000,000 bytes. Update VS Code. No table was published.'); }
      const now = performance.now();
      if (bytes === 0n || bytes === total || now - lastProgress >= 100) {
        onProgress({ bytes: String(bytes), totalBytes: String(total), rows: String(rows), phase: 'reading', engine, notice: JSON_NOTICE, processId: process.pid }); lastProgress = now;
      }
    });
    onProgress({ bytes: result.bytesRead, totalBytes: result.totalBytes, rows: String(rows), phase: 'publishing', engine, notice: JSON_NOTICE, processId: process.pid });
    if (pendingEmpty > 0n) { columns.add(['__json_object']); db.exec('CREATE TABLE records ("__json_object")'); flushEmpty(true); }
    insert?.close(); insert = undefined; commit(); guard(); db.finish(job.path);
    const finalSnapshot = statSync(job.source, { bigint: true });
    if (['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].some((key) => sourceSnapshot[key as keyof typeof sourceSnapshot] !== finalSnapshot[key as keyof typeof finalSnapshot])) {
      throw new Error('The JSON source changed during finalization. Close its writer and reopen; no table was published.');
    }
    return columns.mapping.size === 0 ? [] : [{ name: 'records', columns: [...columns.mapping.values()], rowCount: String(rows), engine,
      notice: `${JSON_NOTICE}${columns.renamed ? ' Some keys received unique column names.' : ''}${columns.mapping.has('__json_object') && pendingEmpty === 0n ? ' Keyless objects are retained as rows.' : ''}` }];
  } finally { insert?.close(); try { if (transaction) { db.exec('ROLLBACK'); } } finally { db.close(); } }
}
