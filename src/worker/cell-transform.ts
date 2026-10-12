import { MAX_CELL_OUTPUT, type CellDetail } from '../protocol';

/** Worker-only whitespace formatter. JSON.parse validates; its coerced values
 * are discarded. Tokens are copied from the original, including duplicate keys. */
export function cellDetails(value: string | null, budget = MAX_CELL_OUTPUT): CellDetail {
  const raw: CellDetail = { text: value ?? 'NULL', kind: value === null ? 'SQL NULL' : value === '' ? 'Empty string' : 'Stored text', notice: '' };
  if (value === null || value === '') { return raw; }
  try { JSON.parse(value); } catch { return raw; }
  try { return { text: prettyJson(value, budget), kind: 'JSON', notice: '' }; }
  catch { return { ...raw, notice: 'JSON formatting exceeds the 16-Mi-character display budget. Showing the complete raw value; nothing was truncated.' }; }
}

function prettyJson(value: string, budget: number): string {
  let output = ''; let size = 0; let depth = 0; let previous = '';
  const append = (text: string): void => {
    size += text.length;
    if (size > budget) { throw new Error('JSON expansion budget exceeded'); }
    output += text;
  };
  const newline = (): void => {
    if (size + 1 + depth * 2 > budget) { throw new Error('JSON indentation budget exceeded'); }
    append('\n' + '  '.repeat(depth));
  };
  for (let i = 0; i < value.length;) {
    const character = value[i] ?? '';
    if (/\s/u.test(character)) { i++; continue; }
    if (character === '"') {
      const start = i++;
      while (i < value.length) {
        const current = value[i++];
        if (current === '\\') { i++; }
        else if (current === '"') { break; }
      }
      append(value.slice(start, i)); previous = 'token'; continue;
    }
    if (character === '{' || character === '[') {
      append(character); depth++; i++;
      let next = i; while (next < value.length && /\s/u.test(value[next] ?? '')) { next++; }
      if (value[next] !== '}' && value[next] !== ']') { newline(); }
    } else if (character === '}' || character === ']') {
      depth--;
      if (previous !== '{' && previous !== '[') { newline(); }
      append(character); i++;
    } else if (character === ',') { append(','); newline(); i++; }
    else if (character === ':') { append(': '); i++; }
    else {
      const start = i++;
      while (i < value.length && !/[\s,}\]]/u.test(value[i] ?? '')) { i++; }
      append(value.slice(start, i)); previous = 'token'; continue;
    }
    previous = character;
  }
  return output;
}

export function selectionTsv(rows: (string | null)[][], budget = MAX_CELL_OUTPUT): string {
  let output = ''; let size = 0;
  const append = (text: string): void => {
    size += text.length;
    if (size > budget) { throw new Error('Copy exceeds the 16-Mi-character clipboard budget. Copy fewer cells. Nothing was truncated; the clipboard was not changed.'); }
    output += text;
  };
  rows.forEach((row, r) => {
    if (r > 0) { append('\n'); }
    row.forEach((value, c) => {
      if (c > 0) { append('\t'); }
      if (value?.includes('\0')) { throw new Error('Cannot copy text containing NUL to the system clipboard without possible data loss. Select other cells. Nothing was truncated; the clipboard was not changed.'); }
      append(value === null ? '\\N' : value === '' || value === '\\N' || /[\t\r\n"]/u.test(value)
        ? `"${value.replaceAll('"', '""')}"` : value);
    });
  });
  return output;
}
