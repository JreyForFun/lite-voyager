import { threadId } from 'node:worker_threads';
import { MAX_PREVIEW_CHARACTERS, MAX_PREVIEW_COLUMNS, MAX_PREVIEW_ROWS, type XlsxPreviewResult } from '../protocol';
import { readXlsx, verifyXlsxSource, XLSX_NOTICE } from './xlsx-book';
import type { XlsxSnapshot } from './xlsx-consent';

/** Workbook parsing is memory-bound; only bounded complete preview rows leave this worker. */
export function previewXlsx(path: string, snapshot: XlsxSnapshot): XlsxPreviewResult {
  const book = readXlsx(path, snapshot); const sheet = book.sheet(0);
  const columns: string[] = []; const rows: (string | null)[][] = []; let size = 0; let limited = false;
  for (const column of sheet.columns) {
    if (columns.length >= Math.min(256, MAX_PREVIEW_COLUMNS) || size + column.length > Math.min(1024 * 1024, MAX_PREVIEW_CHARACTERS)) { limited = true; break; }
    columns.push(column); size += column.length;
  }
  // Do not send partial wide rows: SQL after import exposes every column.
  if (columns.length === sheet.columns.length) {
    for (let row = 1; row <= sheet.lastRow; row++) {
      if (rows.length >= MAX_PREVIEW_ROWS) { limited = true; break; }
      const values = columns.map((_, column) => sheet.rows.get(row)?.get(column)?.text ?? null);
      const characters = values.reduce<number>((total, value) => total + (value === null ? 1 : value.length + 1), 0);
      if (size + characters > Math.min(1024 * 1024, MAX_PREVIEW_CHARACTERS)) { limited = true; break; }
      rows.push(values); size += characters;
    }
  }
  verifyXlsxSource(path, snapshot);
  return { format: 'xlsx', sheetName: sheet.name, sheetCount: book.names.length, columns, rows, bytesRead: snapshot.size, totalBytes: snapshot.size,
    reachedEnd: !limited, threadId,
    notice: `Preview of first worksheet (${String(book.names.length)} sheets total); Import workbook loads every sheet.${sheet.notice.slice(XLSX_NOTICE.length)}${limited ? ' Preview budget reached: complete rows were omitted; full import and SQL preserve supported data.' : ''}` };
}
