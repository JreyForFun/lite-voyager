import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';

const destination = process.argv[2]; const raw = process.argv[3]; const minimum = Number(raw); const format = process.argv[4];
if (process.argv.length !== 5 || destination === undefined || raw === undefined || !/^\d+$/u.test(raw) || !Number.isSafeInteger(minimum) || minimum <= 0 || (format !== 'json' && format !== 'jsonl')) {
  throw new Error('Usage: node scripts/json-memory-fixture.mts <new-file> <minimum-bytes> <json|jsonl>');
}
const file = await open(resolve(destination), 'wx'); const hash = createHash('sha256'); let bytes = 0; let rows = 0;
const record = JSON.stringify({ payload: 'x'.repeat(4095) }); const chunk = Buffer.from((record + (format === 'json' ? ',' : '\n')).repeat(16));
async function write(buffer: Buffer): Promise<void> {
  let offset = 0;
  while (offset < buffer.length) { const result = await file.write(buffer, offset, buffer.length - offset, null); if (result.bytesWritten <= 0) { throw new Error('JSON fixture write made no progress.'); } offset += result.bytesWritten; }
  bytes += buffer.length; hash.update(buffer);
}
try {
  if (format === 'json') { await write(Buffer.from('[')); }
  while (bytes < minimum) { await write(chunk); rows += 16; }
  if (format === 'json') { await write(Buffer.from(record + ']')); rows++; }
} finally { await file.close(); }
process.stdout.write(`${JSON.stringify({ bytes, rows, sha256: hash.digest('hex') })}\n`);
