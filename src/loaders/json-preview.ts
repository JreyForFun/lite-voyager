import { threadId } from 'node:worker_threads';
import { MAX_PREVIEW_CHARACTERS, MAX_PREVIEW_COLUMNS, MAX_PREVIEW_RECORD_CHARACTERS, MAX_PREVIEW_ROWS, type JsonPreviewResult } from '../protocol';
import { JsonColumns } from './json-columns';
import { parseJsonObject, streamJsonRecords, type JsonFormat } from './json-records';

export function jsonPreview(path: string, format: JsonFormat): JsonPreviewResult {
  const columns = new JsonColumns(); const rows: (string | null)[][] = []; let characters = 0; let notice = '';
  const result = streamJsonRecords(path, format, (raw) => {
    const record = parseJsonObject(raw); const added = [...record.keys()].filter((key) => !columns.mapping.has(key));
    // Account for new names and padding every already-collected row before mutation.
    const nextColumns = new JsonColumns(); nextColumns.add(columns.mapping.keys()); const names = nextColumns.add(added);
    const values = [...nextColumns.mapping.keys()].map((key) => record.get(key)?.text ?? null);
    const nextCharacters = characters + names.reduce((sum, name) => sum + name.length, 0) + rows.length * names.length
      + values.reduce<number>((sum, value) => sum + (value === null ? 1 : value.length + 1), 0);
    if (nextColumns.mapping.size > MAX_PREVIEW_COLUMNS || nextCharacters > MAX_PREVIEW_CHARACTERS) {
      notice = 'Preview stopped before a complete row exceeding its column/payload budget. Full import retains complete data.'; return false;
    }
    columns.add(added); for (const row of rows) { row.push(...names.map(() => null)); }
    characters = nextCharacters; rows.push(values);
    if (rows.length === MAX_PREVIEW_ROWS) { notice = 'Preview stops at 100 complete rows; full import validates the whole file.'; return false; }
    return true;
  }, () => {}, MAX_PREVIEW_RECORD_CHARACTERS);
  const boundary = notice || result.limit || 'Preview read the complete input.'; let keyless = '';
  if (columns.mapping.size === 0 && rows.length > 0) {
    columns.add(['__json_object']); for (const row of rows) { row.push('{}'); }
    keyless = ' Keyless objects appear as {} in the generated __json_object column.';
  }
  return { format, columns: [...columns.mapping.values()], rows, bytesRead: result.bytesRead, totalBytes: result.totalBytes,
    reachedEnd: result.reachedEnd, notice: `${boundary}${keyless} Memory-limited fallback allows 20,000,000 source bytes and 64,000,000 SQLite bytes; update VS Code for disk-backed imports.${columns.renamed ? ' Some keys received unique column names.' : ''}`, threadId };
}
