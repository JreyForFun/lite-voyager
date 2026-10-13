import { open } from 'node:fs/promises';
import type { Cursor, ExportFormat, ExportReport, ReadBackend } from '../engine/engine';
import { checkReadStatement } from '../engine/read-engine';

const CHUNK_BYTES = 64 * 1024;
type Sink = (chunk: Uint8Array) => Promise<void>;
type Progress = (report: ExportReport) => void;

/** One fixed output buffer, one awaited sink call, never a collected result. */
class ChunkWriter {
  private readonly buffer = Buffer.allocUnsafe(CHUNK_BYTES);
  private used = 0;
  bytes = 0n;
  constructor(private readonly sink: Sink) {}
  async text(text: string): Promise<void> {
    const bytes = Buffer.from(text, 'utf8');
    for (let offset = 0; offset < bytes.length;) {
      const length = Math.min(CHUNK_BYTES - this.used, bytes.length - offset);
      bytes.copy(this.buffer, this.used, offset, offset + length);
      this.used += length; offset += length;
      if (this.used === CHUNK_BYTES) { await this.flush(); }
    }
  }
  async flush(): Promise<void> {
    if (this.used === 0) { return; }
    await this.sink(this.buffer.subarray(0, this.used));
    this.bytes += BigInt(this.used); this.used = 0;
  }
}

async function quoted(writer: ChunkWriter, text: string, format: ExportFormat): Promise<void> {
  await writer.text('"');
  // Bound escaping/UTF-8 temporaries too. Never split a UTF-16 surrogate pair.
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 8192, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) { --end; }
    const part = text.slice(start, end);
    await writer.text(format === 'json' ? JSON.stringify(part).slice(1, -1) : part.replaceAll('"', '""'));
    start = end;
  }
  await writer.text('"');
}

export async function serializeResults(cursor: Cursor, format: ExportFormat, sink: Sink, progress: Progress = () => {}): Promise<ExportReport> {
  const writer = new ChunkWriter(sink); let rows = 0n; let blobs = 0n; let lastProgress = performance.now();
  const report = (): ExportReport => ({ rows: String(rows), bytes: String(writer.bytes), blobs: String(blobs) });
  try {
    if (format !== 'csv' && format !== 'json') { throw new Error('Invalid export format. Choose CSV or JSON.'); }
    progress(report());
    if (format === 'json') { await writer.text('{"columns":['); }
    for (let column = 0; column < cursor.columns.length; ++column) {
      if (column > 0) { await writer.text(','); }
      await quoted(writer, cursor.columns[column] ?? '', format);
    }
    await writer.text(format === 'json' ? '],"rows":[' : '\r\n');
    for (const row of cursor.rows) {
      if (row.length !== cursor.columns.length) { throw new Error('Invalid SQLite export row shape. Nothing was truncated.'); }
      if (format === 'json') { await writer.text(rows === 0n ? '[' : ',['); }
      for (let column = 0; column < row.length; ++column) {
        if (column > 0) { await writer.text(','); }
        const value = row[column];
        if (value === null) { await writer.text(format === 'json' ? 'null' : '\\N'); }
        else if (value instanceof Uint8Array) {
          ++blobs; await quoted(writer, `[BLOB ${String(value.byteLength)} bytes]`, format);
        } else if (typeof value === 'string' || typeof value === 'bigint' || typeof value === 'number') {
          await quoted(writer, String(value), format);
        } else { throw new Error('Unsupported SQLite export value. Nothing was truncated.'); }
      }
      await writer.text(format === 'json' ? ']' : '\r\n'); ++rows;
      if (performance.now() - lastProgress >= 250) { progress(report()); lastProgress = performance.now(); }
    }
    if (format === 'json') { await writer.text(']}\n'); }
    await writer.flush(); progress(report()); return report();
  } finally { cursor.close(); }
}

/** The host chooses a fresh private temporary path; publication belongs to host. */
export async function writeResults(backend: ReadBackend, sql: string, format: ExportFormat, path: string, progress: Progress): Promise<ExportReport> {
  checkReadStatement(sql);
  const file = await open(path, 'wx', 0o600);
  try {
    const result = await serializeResults(backend.cursor(sql, []), format, async (chunk) => {
      let offset = 0;
      while (offset < chunk.byteLength) {
        const { bytesWritten } = await file.write(chunk, offset, chunk.byteLength - offset, null);
        if (bytesWritten === 0) { throw new Error('Export write made no progress. Check free disk space and retry.'); }
        offset += bytesWritten;
      }
    }, progress);
    await file.sync(); return result;
  } finally { await file.close(); }
}
