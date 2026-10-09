import { createHash, type Hash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { parentPort, workerData } from 'node:worker_threads';
import Papa from 'papaparse';
import type { ImportMessage, ImportOptions, ImportReport } from './csv-import-spike.mts';

interface Job extends ImportOptions { batchRows: number; chunkBytes: number }
const job = workerData as Job;
function send(message: ImportMessage): void { parentPort?.postMessage(message); }
function quote(name: string): string { return `"${name.replaceAll('"', '""')}"`; }
function fold(name: string): string { return name.replace(/[A-Z]/g, (letter) => letter.toLowerCase()); }
function hashRow(hash: Hash, row: string[]): void { hash.update(JSON.stringify(row)); hash.update('\n'); }

async function run(): Promise<ImportReport> {
  const initial = await stat(job.input);
  if (!initial.isFile()) { throw new Error('CSV input must be a regular file.'); }
  if (initial.size === 0) { throw new Error('CSV input is empty; a header row is required.'); }
  const path = join(job.output, 'import.sqlite');
  const reservation = await open(path, 'wx');
  await reservation.close();
  const db = new DatabaseSync(path);
  const sourceHash = createHash('sha256');
  const valuesHash = createHash('sha256');
  const importStart = performance.now();
  let bytes = 0;
  let characters = 0;
  let lastCharacter = '';
  let ended = false;
  let rows = 0;
  let transactions = 0;
  let inTransaction = false;
  let insert: StatementSync | undefined;
  let headers: string[] = [];
  let rowOrderColumn = '__lite_voyager_row';
  let previewRows = 0;
  let previewParseMs: number | null = null;
  let lastProgress = 0;
  let previousCursor = 0;
  let newline: '\n' | '\r\n' = '\n';
  const progress = (force = false): void => {
    const now = performance.now();
    if (force || now - lastProgress >= 1000) {
      send({ kind: 'progress', progress: { phase: 'import', bytes, totalBytes: initial.size, rows } });
      lastProgress = now;
    }
  };
  // TextDecoder is fatal and streaming: split UTF-8 sequences are retained, and
  // invalid bytes are never silently replaced. Its initial BOM is removed.
  async function* textChunks(): AsyncGenerator<string> {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let first = '';
    let firstSent = false;
    let quoted = false;
    let quotePending = false;
    let fieldStart = true;
    let pendingCr = false;
    let newlineKnown = false;
    const checkRecordEndings = (text: string): void => {
      // The generated LF benchmark has no quotes: validate those chunks in
      // bulk, while quoted/CRLF input uses the state machine across chunks.
      if (newlineKnown && newline === '\n' && !quoted && !quotePending && !pendingCr && !text.includes('"')) {
        if (text.includes('\r')) { throw new Error('CSV spike requires consistent LF or CRLF endings; mixed/bare CR endings are unsupported.'); }
        if (text.length > 0) { fieldStart = text.endsWith(',') || text.endsWith('\n'); }
        return;
      }
      for (const character of text) {
        if (quoted) {
          if (quotePending) {
            quotePending = false;
            if (character === '"') { continue; }
            quoted = false;
          } else {
            if (character === '"') { quotePending = true; }
            continue;
          }
        }
        if (pendingCr && character !== '\n') { throw new Error('CSV spike supports LF or CRLF record endings; bare CR is unsupported.'); }
        if (character === '\n') {
          const ending = pendingCr ? '\r\n' : '\n';
          if (newlineKnown && ending !== newline) { throw new Error('CSV spike requires consistent LF or CRLF record endings; mixed endings are unsupported.'); }
          newline = ending;
          newlineKnown = true;
          pendingCr = false;
          fieldStart = true;
        } else if (character === '\r') { pendingCr = true; }
        else if (character === '"' && fieldStart) { quoted = true; fieldStart = false; }
        else { fieldStart = character === ','; }
      }
    };
    const source = createReadStream(job.input, { highWaterMark: job.chunkBytes });
    try {
      for await (const raw of source) {
        const chunk: unknown = raw;
        if (!Buffer.isBuffer(chunk)) { throw new Error('CSV reader returned non-byte input.'); }
        sourceHash.update(chunk);
        bytes += chunk.length;
        let text: string;
        try { text = decoder.decode(chunk, { stream: true }); }
        catch { throw new Error('CSV input is not valid UTF-8. Encoding selection belongs to the production loader.'); }
        if (text.includes('\0')) { throw new Error('CSV input contains NUL bytes; binary text is unsupported.'); }
        characters += text.length;
        if (text.length > 0) { lastCharacter = text.slice(-1); }
        checkRecordEndings(text);
        // Detect the header's record terminator, outside quoted fields. Buffer
        // only that first record (plus one read chunk), regardless of its size.
        if (!firstSent) {
          first += text;
          if (!newlineKnown) { continue; }
          firstSent = true;
          yield first;
          first = '';
        } else { yield text; }
      }
      let tail: string;
      try { tail = decoder.decode(); }
      catch { throw new Error('CSV input ends with an incomplete UTF-8 sequence.'); }
      characters += tail.length;
      if (tail.length > 0) { lastCharacter = tail.slice(-1); }
      checkRecordEndings(tail);
      if (pendingCr) { throw new Error('CSV spike supports LF or CRLF record endings; bare CR is unsupported.'); }
      if (!firstSent) { yield first + tail; }
      else if (tail !== '') { yield tail; }
      ended = true;
    } finally { source.destroy(); }
  }
  let input: Readable | undefined;
  try {
    const chunks = textChunks();
    const first = await chunks.next();
    const inputStream = Readable.from((async function* () {
      try {
        if (!first.done) { yield first.value; }
        yield* chunks;
      } finally { await chunks.return(undefined); }
    })(), { objectMode: false, encoding: 'utf8', highWaterMark: job.chunkBytes });
    input = inputStream;
    // Keep durable SQLite defaults; no journal/synchronous-off benchmark tricks.
    // Negative cache_size is KiB, and temp structures stay on disk.
    db.exec('PRAGMA cache_size=-8192; PRAGMA temp_store=FILE; PRAGMA trusted_schema=OFF;');
    await new Promise<void>((accept, reject) => {
      Papa.parse<string[]>(inputStream, {
        delimiter: ',', newline, header: false, dynamicTyping: false, skipEmptyLines: false,
        step: (result, parser) => {
          try {
            if (result.errors.length > 0) { throw new Error(`Malformed CSV: ${result.errors[0]?.message ?? 'parse error'}.`); }
            const row = result.data;
            const recordCharacters = result.meta.cursor - previousCursor;
            previousCursor = result.meta.cursor;
            if (ended && recordCharacters === 0 && row.length === 1 && row[0] === '' && result.meta.cursor === characters && /[\r\n]/.test(lastCharacter)) { return; }
            if (row.some((value) => value.includes('\0'))) { throw new Error('CSV header or field contains NUL.'); }
            if (insert === undefined) {
              const names = new Set(row.map(fold));
              if (row.some((name) => name.trim() === '') || names.size !== row.length) {
                throw new Error('CSV header names must be nonblank and unique (SQLite ASCII case-insensitive names).');
              }
              headers = row;
              while (names.has(rowOrderColumn)) { rowOrderColumn += '_'; }
              db.exec(`CREATE TABLE "records" (${quote(rowOrderColumn)} INTEGER PRIMARY KEY, ${headers.map((name) => `${quote(name)} TEXT`).join(',')})`);
              insert = db.prepare(`INSERT INTO "records" (${headers.map(quote).join(',')}) VALUES (${headers.map(() => '?').join(',')})`);
              return;
            }
            if (row.length === 1 && row[0] === '' && recordCharacters <= newline.length) { throw new Error('CSV contains an ambiguous blank record; no rows are silently skipped.'); }
            if (row.length !== headers.length) { throw new Error(`CSV record ${String(rows + 1)} has ${String(row.length)} fields; expected ${String(headers.length)}.`); }
            if (rows >= Number.MAX_SAFE_INTEGER) { throw new Error('CSV row counter exceeds the exact reporting range.'); }
            if (!inTransaction) { db.exec('BEGIN'); inTransaction = true; }
            insert.run(...row);
            hashRow(valuesHash, row);
            rows += 1;
            if (previewRows < 100) { previewRows += 1; previewParseMs = performance.now() - importStart; }
            if (rows % job.batchRows === 0) {
              db.exec('COMMIT'); inTransaction = false; transactions += 1;
              progress();
            }
          } catch (error: unknown) {
            reject(error instanceof Error ? error : new Error(String(error)));
            parser.abort();
            inputStream.destroy();
          }
        },
        complete: () => accept(),
        error: (error) => reject(error),
      });
      inputStream.once('error', reject);
    });
    if (insert === undefined) { throw new Error('CSV input is empty; a header row is required.'); }
    if (inTransaction) { db.exec('COMMIT'); inTransaction = false; transactions += 1; }
    const importMs = performance.now() - importStart;
    progress(true);
    const verificationStart = performance.now();
    await new Promise<void>((accept) => {
      parentPort?.once('message', () => accept());
      send({ kind: 'progress', acknowledge: true, progress: { phase: 'verify', stage: 'source', bytes: 0, totalBytes: initial.size, rows: 0 } });
    });
    let lastVerificationProgress = performance.now();
    const verificationProgress = (stage: 'source' | 'rows' | 'integrity', processedBytes: number, verified: number, force = false): void => {
      const now = performance.now();
      if (force || now - lastVerificationProgress >= 1000) {
        send({ kind: 'progress', progress: { phase: 'verify', stage, bytes: processedBytes, totalBytes: initial.size, rows: verified } });
        lastVerificationProgress = now;
      }
    };
    const sourceSha256Before = sourceHash.digest('hex');
    const afterHash = createHash('sha256');
    let verifiedBytes = 0;
    for await (const raw of createReadStream(job.input, { highWaterMark: job.chunkBytes })) {
      const chunk: unknown = raw;
      if (!Buffer.isBuffer(chunk)) { throw new Error('CSV verification reader returned non-byte input.'); }
      afterHash.update(chunk);
      verifiedBytes += chunk.length;
      verificationProgress('source', verifiedBytes, 0);
    }
    const sourceSha256After = afterHash.digest('hex');
    const final = await stat(job.input);
    if (bytes !== initial.size || final.size !== initial.size || final.mtimeMs !== initial.mtimeMs || sourceSha256Before !== sourceSha256After) {
      throw new Error('CSV source changed during the spike; the result cannot be trusted.');
    }
    const storedHash = createHash('sha256');
    let verifiedRows = 0;
    verificationProgress('rows', verifiedBytes, 0, true);
    for (const record of db.prepare(`SELECT ${headers.map(quote).join(',')} FROM "records" ORDER BY ${quote(rowOrderColumn)}`).iterate()) {
      const row = headers.map((name) => {
        const value = record[name];
        if (typeof value !== 'string') { throw new Error('Stored CSV value is not exact text.'); }
        return value;
      });
      hashRow(storedHash, row);
      verifiedRows += 1;
      if (verifiedRows % 1000 === 0) { verificationProgress('rows', verifiedBytes, verifiedRows); }
    }
    const parsedValuesSha256 = valuesHash.digest('hex');
    const storedValuesSha256 = storedHash.digest('hex');
    if (verifiedRows !== rows || parsedValuesSha256 !== storedValuesSha256) { throw new Error('SQLite row/value verification failed.'); }
    verificationProgress('integrity', verifiedBytes, verifiedRows, true);
    if (db.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') { throw new Error('SQLite integrity check failed.'); }
    const version = db.prepare('SELECT sqlite_version() AS version').get()?.version;
    if (typeof version !== 'string') { throw new Error('SQLite did not report its version.'); }
    db.close();
    return {
      task: 'T-004', input: job.input, output: job.output, inputBytes: bytes,
      sqliteBytes: (await stat(path)).size, rowOrderColumn, rows, verifiedRows, transactions,
      batchRows: job.batchRows, chunkBytes: job.chunkBytes, importMs,
      verificationMs: performance.now() - verificationStart, totalMs: 0,
      previewRows, previewParseMs,
      previewScope: 'Time to up to 100 parsed rows during import; not visible first paint. Includes parsing/inserts, excludes worker startup.',
      peakRssBytes: 0, sampledPeakRssBytes: 0,
      memoryScope: 'The standalone CLI process including its worker, SQLite and verification; OS lifetime peak RSS plus 10 ms sampling. Not VS Code extension memory.',
      sourceSha256Before, sourceSha256After, parsedValuesSha256, storedValuesSha256,
      runtime: process.version, sqliteVersion: version, platform: `${process.platform}/${process.arch}`,
    };
  } finally {
    input?.destroy();
    if (db.isOpen) {
      if (inTransaction) { db.exec('ROLLBACK'); }
      db.close();
    }
  }
}

try { send({ kind: 'result', report: await run() }); }
catch (error: unknown) { send({ kind: 'failure', message: error instanceof Error ? error.message : String(error) }); }
