import { createHash } from 'node:crypto';

export async function digestChunks(read: (buffer: Buffer) => Promise<number>, signal?: AbortSignal): Promise<{ bytes: number; sha256: string }> {
  const hash = createHash('sha256'); let bytes = 0;
  // Reuse storage: stream chunk allocations can remain resident after hashing
  // and contaminate the next extension-host memory window, especially on macOS.
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  while (true) {
    signal?.throwIfAborted();
    const count = await read(buffer);
    signal?.throwIfAborted();
    if (!Number.isSafeInteger(count) || count < 0 || count > buffer.length) { throw new Error('Invalid source-hash read length.'); }
    if (count === 0) { break; }
    hash.update(buffer.subarray(0, count)); bytes += count;
  }
  return { bytes, sha256: hash.digest('hex') };
}
