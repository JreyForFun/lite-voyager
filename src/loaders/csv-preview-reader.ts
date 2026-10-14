import { closeSync, constants, fstatSync, openSync, readSync, realpathSync, statSync, type BigIntStats } from 'node:fs';
import { extname } from 'node:path';
import { threadId } from 'node:worker_threads';
import Papa from 'papaparse';
import { MAX_PREVIEW_CHARACTERS, MAX_PREVIEW_COLUMNS, MAX_PREVIEW_RECORD_CHARACTERS, MAX_PREVIEW_ROWS, type CsvPreviewResult } from '../protocol';
import { previewOptions, type LoadOptions } from './file-loader';

function parseRecord(text: string, delimiter: string): string[] {
  if (text === '') { return ['']; }
  const result = Papa.parse<string[]>(text, { delimiter, newline: '\n', header: false, dynamicTyping: false, skipEmptyLines: false });
  if (result.errors.length !== 0 || result.data.length !== 1) { throw new Error('Malformed CSV record. Check quotes and delimiters.'); }
  const row: unknown = result.data[0];
  if (!Array.isArray(row) || !Array.from(row).every((field: unknown) => typeof field === 'string')) { throw new Error('Invalid CSV parser response. Rebuild and reopen the preview.'); }
  return row as string[];
}
function same(a: BigIntStats, b: BigIntStats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}
const fold = (name: string): string => name.replace(/[A-Z]/g, (character) => character.toLowerCase());
const limited = 'Preview limit reached; only complete rows are shown. Values were not truncated. The rest of the file has not been validated.';

/** Worker-only: retain one bounded raw record and one bounded result page. */
export function readCsvPreview(path: string, input: LoadOptions = {}, chunkBytes = 65_536): CsvPreviewResult {
  const options = previewOptions(input);
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 65_536) { throw new Error('Invalid preview read size.'); }
  const delimiter = options.delimiter ?? (extname(path).toLowerCase() === '.tsv' ? '\t' : ',');
  const source = realpathSync(path);
  const initial = statSync(source, { bigint: true });
  if (!initial.isFile()) { throw new Error('Choose a regular local CSV or TSV file.'); }
  // POSIX nonblocking open also protects a regular file replaced by a FIFO
  // between stat and open. Windows does not expose O_NONBLOCK.
  const file = openSync(source, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NONBLOCK));
  try {
    const snapshot = fstatSync(file, { bigint: true });
    if (!snapshot.isFile()) { throw new Error('Choose a regular local CSV or TSV file.'); }
    if (!same(initial, snapshot)) { throw new Error('The CSV changed during preview. Close its writer and reopen it.'); }
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const buffer = Buffer.alloc(chunkBytes);
    const columns: string[] = [];
    const names = new Set<string>();
    const rows: (string | null)[][] = [];
    let payload = 0; let bytesRead = 0n; let reachedEnd = false;
    let first = true; let stopped = false; let renamed = false; let ragged = false;
    let quoted = false; let afterQuote = false; let fieldStart = true; let pendingCr = false;
    let crRecord = '';
    let parts: string[] = []; let characters = 0;
    const notices = new Set<string>();
    const stop = (): void => { notices.add(limited); stopped = true; };
    const addColumns = (headers: string[]): boolean => {
      const added: string[] = [];
      let budget = payload;
      for (const header of headers) {
        const index = columns.length + added.length;
        const base = header.trim() === '' ? `column_${String(index + 1)}` : header;
        let name = base; let suffix = 2;
        while (names.has(fold(name))) { name = `${base}_${String(suffix++)}`; }
        if (name !== header) { renamed = true; }
        if (index >= MAX_PREVIEW_COLUMNS || budget + name.length + rows.length > MAX_PREVIEW_CHARACTERS) { stop(); return false; }
        added.push(name); names.add(fold(name)); budget += name.length + rows.length;
      }
      columns.push(...added); payload = budget;
      for (const row of rows) { row.push(...added.map(() => null)); }
      return true;
    };
    const record = (text: string): void => {
      const row = parseRecord(text, delimiter);
      if (first) {
        first = false;
        if (options.header !== false) { addColumns(row); return; }
        if (!addColumns(row.map((_, index) => `column_${String(index + 1)}`))) { return; }
        // Generated header-off names are expected, not renamed source headers.
        renamed = false;
      }
      if (row.length !== columns.length) { ragged = true; }
      const width = Math.max(columns.length, row.length);
      const cost = row.reduce((sum, field) => sum + field.length + 1, 0) + width - row.length;
      if (payload + cost > MAX_PREVIEW_CHARACTERS) { stop(); return; }
      if (row.length > columns.length && !addColumns(row.slice(columns.length).map(() => ''))) { return; }
      if (payload + cost > MAX_PREVIEW_CHARACTERS) { stop(); return; }
      rows.push([...row, ...Array.from({ length: columns.length - row.length }, () => null)]); payload += cost;
      if (rows.length === MAX_PREVIEW_ROWS) { stopped = true; notices.add(`Preview of the first ${String(MAX_PREVIEW_ROWS)} rows. The rest of the file has not been validated.`); }
    };
    const consume = (text: string): void => {
      let start = 0;
      for (let index = 0; index < text.length && !stopped; index++) {
        const character = text[index];
        if (pendingCr) {
          pendingCr = false;
          if (character !== '\n') { throw new Error('Malformed CSV: bare CR record endings are unsupported; use LF or CRLF.'); }
          record(crRecord); crRecord = '';
          start = index + 1; continue;
        }
        if (character === '\0') { throw new Error('CSV contains NUL bytes or binary data. Choose a UTF-8 text file.'); }
        let ending = false;
        if (quoted) {
          if (character === '"') { quoted = false; afterQuote = true; }
        } else if (afterQuote) {
          if (character === '"') { quoted = true; afterQuote = false; }
          else if (character === delimiter) { afterQuote = false; fieldStart = true; }
          else if (character === '\r' || character === '\n') { ending = true; afterQuote = false; }
          else { throw new Error('Malformed CSV: a closing quote must be followed by a delimiter or record ending.'); }
        } else if (character === '\r' || character === '\n') { ending = true; }
        else if (character === delimiter) { fieldStart = true; }
        else if (character === '"') {
          if (!fieldStart) { throw new Error('Malformed CSV: quote inside an unquoted field.'); }
          quoted = true; fieldStart = false;
        } else { fieldStart = false; }
        if (ending) {
          parts.push(text.slice(start, index));
          if (character === '\r') { crRecord = parts.join(''); pendingCr = true; }
          else { record(parts.join('')); }
          parts = []; characters = 0; start = index + 1; fieldStart = true;
        } else {
          characters++;
          if (characters > MAX_PREVIEW_RECORD_CHARACTERS) { stop(); }
        }
      }
      if (!stopped) { parts.push(text.slice(start)); }
    };
    while (!stopped) {
      const count = readSync(file, buffer, 0, buffer.length, null);
      if (count === 0) {
        let tail: string;
        try { tail = decoder.decode(); } catch { throw new Error('CSV ends with incomplete UTF-8. Encoding selection is not available in this preview.'); }
        consume(tail);
        if (quoted) { throw new Error('Malformed CSV: an unterminated quoted field.'); }
        if (pendingCr) { throw new Error('Malformed CSV: bare CR record ending. Use LF or CRLF.'); }
        if (characters > 0) { record(parts.join('')); }
        reachedEnd = !stopped; break;
      }
      bytesRead += BigInt(count);
      let offset = 0;
      while (offset < count && !stopped) {
        // ASCII LF cannot occur inside a UTF-8 code point. Decode through
        // one physical line at a time so a completed sample can stop before
        // validating its fetched-but-unscanned tail, including quoted lines.
        const newline = buffer.indexOf(10, offset);
        const lineEnd = newline < 0 ? count : Math.min(count, newline + 1);
        // A carried astral code point can emit two UTF-16 units from one
        // new byte. Leave one unit of slack, then decode byte-by-byte near
        // the limit so the scanner stops before any subsequent bad bytes.
        const end = Math.min(lineEnd, offset + Math.max(1, MAX_PREVIEW_RECORD_CHARACTERS - characters - 1));
        let text: string;
        try { text = decoder.decode(buffer.subarray(offset, end), { stream: true }); }
        catch { throw new Error('CSV is not valid UTF-8. Encoding selection is not available in this preview.'); }
        consume(text); offset = end;
      }
    }
    if (!same(snapshot, fstatSync(file, { bigint: true })) || !same(snapshot, statSync(path, { bigint: true }))) { throw new Error('The CSV changed during preview. Close its writer and reopen it.'); }
    if (renamed) { notices.add('Blank or duplicate headers use unique display names; no fields were dropped.'); }
    if (ragged) { notices.add('Ragged rows retain extra fields; missing fields are marked separately from empty text.'); }
    if (rows.length === 0 && reachedEnd) { notices.add(columns.length === 0 ? 'The file is empty.' : 'The file has headers but no data rows.'); }
    return { columns, rows, delimiter, header: options.header !== false, bytesRead: String(bytesRead), totalBytes: String(snapshot.size), reachedEnd,
      notice: [...notices].join(' '), threadId };
  } finally { closeSync(file); }
}
