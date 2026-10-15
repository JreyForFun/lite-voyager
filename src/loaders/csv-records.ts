import { closeSync, constants, fstatSync, openSync, readSync, realpathSync, statSync, type BigIntStats } from 'node:fs';
import Papa from 'papaparse';
import type { CsvDelimiter } from '../protocol';

function same(a: BigIntStats, b: BigIntStats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}

/** Worker-only full scan, one raw record plus one 64-KiB read. No preview limits. */
export function streamRecords(path: string, delimiter: CsvDelimiter, row: (fields: string[]) => void,
  progress: (bytes: bigint, total: bigint) => void): void {
  const source = realpathSync(path); const initial = statSync(source, { bigint: true });
  if (!initial.isFile()) { throw new Error('Choose a regular local UTF-8 CSV / TSV file.'); }
  const file = openSync(source, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NONBLOCK));
  try {
    const snapshot = fstatSync(file, { bigint: true });
    if (!snapshot.isFile() || !same(initial, snapshot)) { throw new Error('The CSV changed before import. Close its writer and reopen.'); }
    const decoder = new TextDecoder('utf-8', { fatal: true }); const buffer = Buffer.alloc(65536);
    let quoted = false; let afterQuote = false; let fieldStart = true; let pendingCr = false;
    let parts: string[] = []; let characters = 0; let bytes = 0n;
    const record = (): void => {
      const text = parts.join(''); parts = []; characters = 0;
      if (text === '') { row(['']); return; }
      // Papa's string API strips a leading BOM each time. Only the streaming
      // decoder may remove the file-start BOM; protect later data BOMs.
      const protectBom = text.charCodeAt(0) === 0xfeff;
      const parsed = Papa.parse<string[]>(protectBom ? `x${delimiter}${text}` : text, { delimiter, newline: '\n', header: false, dynamicTyping: false, skipEmptyLines: false });
      if (parsed.errors.length !== 0 || parsed.data.length !== 1 || parsed.data[0] === undefined) { throw new Error('Malformed CSV record. Check quoting and delimiter.'); }
      row(protectBom ? parsed.data[0].slice(1) : parsed.data[0]);
    };
    const consume = (text: string): void => {
      let start = 0;
      for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (pendingCr) {
          pendingCr = false;
          if (character !== '\n') { throw new Error('Malformed CSV: bare CR ending. Use LF or CRLF.'); }
          record(); start = index + 1; continue;
        }
        if (character === '\0') { throw new Error('CSV contains NUL or binary data. Choose UTF-8 text.'); }
        let ending = false;
        if (quoted) { if (character === '"') { quoted = false; afterQuote = true; } }
        else if (afterQuote) {
          if (character === '"') { quoted = true; afterQuote = false; }
          else if (character === delimiter) { afterQuote = false; fieldStart = true; }
          else if (character === '\r' || character === '\n') { ending = true; afterQuote = false; }
          else { throw new Error('Malformed CSV: closing quote must be followed by delimiter or record ending.'); }
        } else if (character === '\r' || character === '\n') { ending = true; }
        else if (character === delimiter) { fieldStart = true; }
        else if (character === '"') {
          if (!fieldStart) { throw new Error('Malformed CSV: quote inside unquoted field.'); }
          quoted = true; fieldStart = false;
        } else { fieldStart = false; }
        if (ending) {
          parts.push(text.slice(start, index)); start = index + 1; fieldStart = true;
          if (character === '\r') { pendingCr = true; } else { record(); }
        } else { characters++; }
      }
      if (start < text.length) { parts.push(text.slice(start)); }
    };
    progress(0n, snapshot.size);
    while (true) {
      const count = readSync(file, buffer, 0, buffer.length, null);
      if (count === 0) { break; }
      bytes += BigInt(count);
      try { consume(decoder.decode(buffer.subarray(0, count), { stream: true })); }
      catch (error: unknown) { if (error instanceof TypeError) { throw new Error('CSV is not valid UTF-8. Encoding selection is not available; convert to UTF-8.'); } throw error; }
      progress(bytes, snapshot.size);
    }
    try { consume(decoder.decode()); } catch (error: unknown) { if (error instanceof TypeError) { throw new Error('CSV ends with incomplete UTF-8. Convert to UTF-8.'); } throw error; }
    if (quoted) { throw new Error('Malformed CSV: unterminated quoted field.'); }
    if (pendingCr) { throw new Error('Malformed CSV: bare CR ending.'); }
    if (characters > 0) { record(); }
    if (!same(snapshot, fstatSync(file, { bigint: true })) || !same(snapshot, statSync(path, { bigint: true })) || bytes !== snapshot.size) {
      throw new Error('The CSV changed during import. Close its writer and reopen; no table was published.');
    }
    progress(bytes, snapshot.size);
  } finally { closeSync(file); }
}
