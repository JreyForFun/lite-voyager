import { quoteIdentifier } from '../engine/read-engine';
import { FALLBACK_IMPORT_DATABASE_BYTES, openImportDatabase, type CsvImportJob, type Insert } from './csv-import';
import type { ImportedTable, Progress } from './file-loader';
import { readXlsx, verifyXlsxSource, XLSX_NOTICE, type XlsxCell } from './xlsx-book';

/** Worker only: retain raw numeric tokens and use no column affinity. */
export async function importXlsx(job: CsvImportJob, progress: (value: Progress) => void): Promise<ImportedTable[]> {
  const snapshot = job.xlsxSnapshot;
  if (job.format !== 'xlsx' || snapshot === undefined) { throw new Error('XLSX import needs an approved source snapshot. Retry preview.'); }
  verifyXlsxSource(job.source, snapshot);
  const { db, engine } = await openImportDatabase(job); const tables: ImportedTable[] = [];
  let rows = 0n; let transaction = false; let insert: Insert | undefined; let signature = ''; let lastProgress = 0;
  const report = (bytes: string, phase: 'reading' | 'publishing', notice: string): void => { progress({ bytes, totalBytes: snapshot.size, rows: String(rows), engine, phase, notice, processId: process.pid }); };
  const guard = (): void => { if (engine === 'sql.js' && db.size() > FALLBACK_IMPORT_DATABASE_BYTES) { throw new Error('Memory-limited XLSX import exceeded 64,000,000 SQLite bytes. Update VS Code; no sheets were published.'); } };
  const commit = (): void => { if (transaction) { db.exec('COMMIT'); transaction = false; } guard(); };
  const expression = (value: XlsxCell): string => value.kind === 'integer' ? 'CAST(? AS INTEGER)' : value.kind === 'real' ? 'CAST(? AS REAL)' : value.text?.includes('\0') === true ? 'CAST(? AS TEXT)' : '?';
  try {
    db.exec('PRAGMA cache_size=-8192; PRAGMA temp_store=FILE; PRAGMA trusted_schema=OFF; PRAGMA user_version=0');
    report('0', 'reading', 'Reading workbook. ' + XLSX_NOTICE);
    const workbook = readXlsx(job.source, snapshot);
    for (let index = 0; index < workbook.names.length; index++) {
      const sheet = workbook.sheet(index); const name = quoteIdentifier(sheet.name); let count = 0n;
      db.exec(`CREATE TABLE ${name} (${sheet.columns.map(quoteIdentifier).join(',')})`);
      const write = (values: XlsxCell[]): void => {
        const next = values.map(expression).join(',');
        if (insert === undefined || signature !== next) { insert?.close(); signature = next; insert = db.insert(`INSERT INTO ${name} (${sheet.columns.map(quoteIdentifier).join(',')}) VALUES (${next})`); }
        if (!transaction) { db.exec('BEGIN'); transaction = true; } insert.run(values.map((value) => value.text));
      };
      for (let row = 1; row <= sheet.lastRow; row++) {
        write(sheet.columns.map((_, column) => sheet.rows.get(row)?.get(column) ?? { text: null, kind: 'null' })); rows++; count++;
        if (count % 1000n === 0n) { commit(); }
        const now = performance.now(); if (now - lastProgress >= 100) { report(snapshot.size, 'publishing', `Importing worksheet ${String(index + 1)} / ${String(workbook.names.length)}. ${sheet.notice}`); lastProgress = now; }
      }
      insert?.close(); insert = undefined; commit();
      tables.push({ name: sheet.name, columns: sheet.columns, rowCount: String(count), engine, notice: sheet.notice });
      report(snapshot.size, 'publishing', `Imported worksheet ${String(index + 1)} / ${String(workbook.names.length)}. ${sheet.notice}`);
    }
    verifyXlsxSource(job.source, snapshot); guard(); db.finish(job.path); verifyXlsxSource(job.source, snapshot); return tables;
  } finally { insert?.close(); try { if (transaction) { db.exec('ROLLBACK'); } } finally { db.close(); } }
}
