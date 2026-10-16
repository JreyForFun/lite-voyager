import { closeSync, constants, fstatSync, openSync, readSync, realpathSync, statSync, type BigIntStats } from 'node:fs';
export { parseJsonObject, type JsonCell } from './json-values';
export type JsonFormat = 'json' | 'jsonl';
export interface JsonReadResult { bytesRead: string; totalBytes: string; reachedEnd: boolean; limit?: string; }
function same(a: BigIntStats, b: BigIntStats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}

/** Worker-only framing. Memory is proportional to one record, never the file. */
export function streamJsonRecords(path: string, format: JsonFormat, row: (raw: string) => boolean | void,
  progress: (bytes: bigint, total: bigint) => void, maxRecordCharacters?: number): JsonReadResult {
  const source = realpathSync(path); const initial = statSync(source, { bigint: true });
  if (!initial.isFile()) { throw new Error('Choose a regular local UTF-8 JSON / JSONL file.'); }
  const file = openSync(source, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NONBLOCK));
  try {
    const snapshot = fstatSync(file, { bigint: true });
    if (!snapshot.isFile() || !same(initial, snapshot)) { throw new Error('The JSON source changed before reading. Close its writer and reopen.'); }
    const decoder = new TextDecoder('utf-8', { fatal: true }); const buffer = Buffer.alloc(65536);
    let bytes = 0n; let parts: string[] = []; let characters = 0; let quoted = false; let escaped = false; let depth = 0; let lines = 0n; let records = 0n;
    let state: 'start' | 'first' | 'next' | 'record' | 'separator' | 'end' = 'start'; let stopped = false; let limit: string | undefined;
    const complete = (): boolean => state === 'end';
    const append = (part: string): void => {
      characters += part.length;
      if (maxRecordCharacters !== undefined && characters > maxRecordCharacters) { stopped = true; limit = 'Preview stopped before a record exceeding its record budget. Full import keeps complete records.'; }
      else { parts.push(part); }
    };
    const emit = (): void => {
      const raw = parts.join(''); parts = []; characters = 0;
      lines++;
      if (format === 'jsonl' && /^[\x20\t\r]*$/u.test(raw)) { return; }
      records++;
      try { if (row(raw) === false) { stopped = true; } }
      catch (error: unknown) { throw new Error(`${format === 'jsonl' ? `JSONL line ${String(lines)}` : `JSON record ${String(records)}`}: ${error instanceof Error ? error.message : 'Invalid object. Check complete values and retry.'}`); }
    };
    const consume = (text: string): void => {
      let start = 0;
      for (let index = 0; index < text.length && !stopped; index++) {
        const char = text[index] ?? '';
        if (format === 'jsonl') {
          if (char === '\n') { append(text.slice(start, index)); if (!stopped) { emit(); } start = index + 1; }
          continue;
        }
        if (state !== 'record') {
          start = index + 1;
          if (/[\x20\t\r\n]/.test(char)) { continue; }
          if (state === 'start' && char === '[') { state = 'first'; }
          else if ((state === 'first' || state === 'separator') && char === ']') { state = 'end'; }
          else if ((state === 'first' || state === 'next') && char === '{') { state = 'record'; start = index; depth = 1; }
          else if (state === 'separator' && char === ',') { state = 'next'; }
          else { throw new Error('Unsupported or malformed JSON. Use one top-level array of objects, with commas between complete objects.'); }
          continue;
        }
        if (quoted) {
          if (escaped) { escaped = false; }
          else if (char === '\\') { escaped = true; }
          else if (char === '"') { quoted = false; }
        } else if (char === '"') { quoted = true; }
        else if (char === '{' || char === '[') { depth++; }
        else if (char === '}' || char === ']') {
          depth--;
          if (depth === 0) { append(text.slice(start, index + 1)); if (!stopped) { emit(); } state = 'separator'; start = index + 1; }
        }
      }
      if (!stopped && start < text.length && (format === 'jsonl' || state === 'record')) { append(text.slice(start)); }
    };
    const decode = (input?: Uint8Array, stream = false): void => {
      let text: string;
      try { text = decoder.decode(input, { stream }); } catch { throw new Error('JSON is not valid UTF-8 or ends with incomplete UTF-8. Convert to UTF-8 and reopen.'); }
      consume(text);
    };
    progress(0n, snapshot.size);
    while (!stopped) {
      const count = readSync(file, buffer, 0, buffer.length, null); if (count === 0) { break; }
      bytes += BigInt(count); decode(buffer.subarray(0, count), true); progress(bytes, snapshot.size);
    }
    if (!stopped) {
      decode();
      if (format === 'jsonl') { if (characters > 0) { emit(); } }
      else if (!complete()) { throw new Error('Truncated or unsupported JSON. Complete the top-level array of objects before importing.'); }
    }
    if (!same(snapshot, fstatSync(file, { bigint: true })) || !same(snapshot, statSync(path, { bigint: true })) || (!stopped && bytes !== snapshot.size)) {
      throw new Error('The JSON source changed while reading. Close its writer and reopen; no table was published.');
    }
    return { bytesRead: String(bytes), totalBytes: String(snapshot.size), reachedEnd: !stopped, ...(limit === undefined ? {} : { limit }) };
  } finally { closeSync(file); }
}
