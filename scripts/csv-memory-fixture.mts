import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';

const raw = process.argv[3]; const minimum = Number(raw); const destination = process.argv[2];
if (process.argv.length !== 4 || destination === undefined || raw === undefined || !/^\d+$/u.test(raw) || !Number.isSafeInteger(minimum) || minimum <= 0) {
  throw new Error('Usage: node scripts/csv-memory-fixture.mts <new-file.csv> <minimum-bytes>');
}
const path = resolve(destination); const file = await open(path, 'wx'); const hash = createHash('sha256');
const header = Buffer.from('payload\n'); const chunk = Buffer.from(`${'x'.repeat(4095)}\n`.repeat(16));
let bytes = 0; let rows = 0;
async function write(buffer: Buffer): Promise<void> {
  let offset = 0;
  while (offset < buffer.length) { const result = await file.write(buffer, offset, buffer.length - offset, null); if (result.bytesWritten <= 0) { throw new Error('CSV fixture write made no progress.'); } offset += result.bytesWritten; }
  hash.update(buffer); bytes += buffer.length;
}
try {
  await write(header);
  while (bytes < minimum) { await write(chunk); rows += 16; }
} finally { await file.close(); }
process.stdout.write(`${JSON.stringify({ bytes, rows, recordBytes: 4096, sha256: hash.digest('hex') })}\n`);
