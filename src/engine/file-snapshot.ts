import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, statSync, type BigIntStats } from 'node:fs';
import { constants as bufferConstants } from 'node:buffer';

export interface FileSnapshot { path: string; stat: BigIntStats; }
const changed = 'The file changed while being opened. Retry after its writer closes it.';
const journals = 'Memory-limited mode cannot safely open WAL-mode databases or journal sidecars. Use a host with node:sqlite; source files are not modified.';

function same(before: BigIntStats, after: BigIntStats): boolean {
  return before.dev === after.dev && before.ino === after.ino && before.size === after.size
    && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}

export function inspectFile(path: string): FileSnapshot {
  const source = realpathSync(path);
  const file = openSync(source, constants.O_RDONLY);
  try {
    const stat = fstatSync(file, { bigint: true });
    if (!stat.isFile()) { throw new Error('Not a regular SQLite file.'); }
    const header = Buffer.alloc(16);
    if (readSync(file, header, 0, 16, 0) !== 16 || !header.equals(Buffer.from('SQLite format 3\0'))) {
      throw new Error('Not a SQLite database.');
    }
    if (!same(stat, fstatSync(file, { bigint: true }))) { throw new Error(changed); }
    return { path: source, stat };
  } finally { closeSync(file); }
}

function checkJournals(path: string): void {
  for (const suffix of ['-wal', '-journal']) {
    try { lstatSync(`${path}${suffix}`); }
    catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') { continue; }
      throw error;
    }
    throw new Error(journals);
  }
}

/** Called only in the worker, after any required consent, against the approved snapshot. */
export function readFallback(snapshot: FileSnapshot): Uint8Array {
  const file = openSync(snapshot.path, 'r');
  try {
    const before = fstatSync(file, { bigint: true });
    if (!same(snapshot.stat, before)) { throw new Error(changed); }
    checkJournals(snapshot.path);
    if (before.size >= BigInt(bufferConstants.MAX_LENGTH)) {
      throw new Error('Memory-limited mode cannot allocate this file on this host. Update VS Code or use a host with node:sqlite.');
    }
    const size = Number(before.size); // Checked against the actual host Buffer limit before conversion.
    const buffer = Buffer.alloc(size + 1);
    let length = 0;
    while (length < buffer.length) {
      const bytes = readSync(file, buffer, length, Math.min(1024 * 1024, buffer.length - length), null);
      if (bytes === 0) { break; }
      length += bytes;
    }
    checkJournals(snapshot.path);
    if (length !== size || !same(before, fstatSync(file, { bigint: true }))
      || !same(before, statSync(snapshot.path, { bigint: true }))) { throw new Error(changed); }
    if (buffer[18] === 2 || buffer[19] === 2) { throw new Error(journals); }
    return buffer.subarray(0, size);
  } finally { closeSync(file); }
}
