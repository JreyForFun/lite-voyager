import { crc32, inflateRawSync } from 'node:zlib';

function invalid(): never { throw new Error('Corrupt or truncated XLSX ZIP directory/data. Re-save a valid unencrypted XLSX and retry.'); }
/** PKWARE APPNOTE 4.3: validate bounds before the pinned reader touches ZIP data. */
export function validateXlsxZip(bytes: Buffer): void {
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50) { invalid(); }
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50 && index + 22 + bytes.readUInt16LE(index + 20) === bytes.length) { end = index; break; }
  }
  if (end < 0) { invalid(); }
  const count = bytes.readUInt16LE(end + 10); const length = bytes.readUInt32LE(end + 12); const start = bytes.readUInt32LE(end + 16);
  if (count === 0xffff || length === 0xffffffff || start === 0xffffffff || end >= 20 && bytes.readUInt32LE(end - 20) === 0x07064b50) {
    throw new Error('ZIP64 XLSX containers are unsupported by this reader. Export sheets as CSV for streaming import, or re-save a conventional XLSX.');
  }
  if (bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0 || bytes.readUInt16LE(end + 8) !== count || start + length > end || count === 0) { invalid(); }
  let index = start; const names = new Set<string>();
  for (let entry = 0; entry < count; entry++) {
    if (index + 46 > start + length || bytes.readUInt32LE(index) !== 0x02014b50) { invalid(); }
    const flags = bytes.readUInt16LE(index + 8); const method = bytes.readUInt16LE(index + 10); const checksum = bytes.readUInt32LE(index + 16);
    const compressed = bytes.readUInt32LE(index + 20); const expanded = bytes.readUInt32LE(index + 24);
    const nameLength = bytes.readUInt16LE(index + 28); const extra = bytes.readUInt16LE(index + 30); const comment = bytes.readUInt16LE(index + 32); const offset = bytes.readUInt32LE(index + 42);
    const next = index + 46 + nameLength + extra + comment;
    if (compressed === 0xffffffff || expanded === 0xffffffff || offset === 0xffffffff) { throw new Error('ZIP64 XLSX entries are unsupported. Export sheets as CSV or re-save a conventional XLSX.'); }
    if (next > start + length || offset + 30 > start || bytes.readUInt32LE(offset) !== 0x04034b50 || bytes.readUInt16LE(index + 34) !== 0) { invalid(); }
    const name = bytes.subarray(index + 46, index + 46 + nameLength);
    // Pinned SheetJS reads ZIP names bytewise, adds the CFB root and resolves
    // parts ignoring case and slash direction. Refuse aliases before decoding.
    const decoded = name.toString('latin1');
    const stored = decoded.startsWith('Root Entry/') ? decoded : (`Root Entry/${decoded}`).replace('//', '/');
    const key = stored.replace(/^Root Entry[\\/]/u, '').toLowerCase().replaceAll('\\', '/');
    if (names.has(key)) { throw new Error('XLSX ZIP contains duplicate or ambiguous parts. Re-save the workbook; no sheets were imported.'); } names.add(key);
    const localFlags = bytes.readUInt16LE(offset + 6); const localNameLength = bytes.readUInt16LE(offset + 26); const localExtra = bytes.readUInt16LE(offset + 28);
    if ((flags | localFlags) & 0x2041) { throw new Error('Encrypted XLSX ZIP data is unsupported. Save an unencrypted XLSX copy.'); }
    if (flags !== localFlags || method !== bytes.readUInt16LE(offset + 8) || ![0, 8].includes(method)) { invalid(); }
    const data = offset + 30 + localNameLength + localExtra;
    if (data + compressed > start || !bytes.subarray(offset + 30, offset + 30 + localNameLength).equals(name)) { invalid(); }
    if ((flags & 8) === 0 && (bytes.readUInt32LE(offset + 14) !== checksum || bytes.readUInt32LE(offset + 18) !== compressed || bytes.readUInt32LE(offset + 22) !== expanded)) { invalid(); }
    if ((flags & 8) !== 0) {
      let descriptor = data + compressed; if (descriptor + 4 > start) { invalid(); }
      if (bytes.readUInt32LE(descriptor) === 0x08074b50) { descriptor += 4; }
      if (descriptor + 12 > start || bytes.readUInt32LE(descriptor) !== checksum || bytes.readUInt32LE(descriptor + 4) !== compressed || bytes.readUInt32LE(descriptor + 8) !== expanded) { invalid(); }
    }
    // The pinned reader's JS inflater is not a validator. Native zlib rejects
    // truncated/invalid streams before they can enter that decoder's loop.
    const payload = bytes.subarray(data, data + compressed);
    let content: Uint8Array;
    try { content = method === 8 ? inflateRawSync(payload, { maxOutputLength: Math.max(1, expanded) }) : payload; } catch { invalid(); }
    if (content.length !== expanded || crc32(content) !== checksum) { invalid(); }
    index = next;
  }
  if (index !== start + length) { invalid(); }
}
