import { expect, test, vi } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { validateXlsxZip } from '../../src/loaders/xlsx-zip';
import { zipFixture } from '../../src/test/xlsx-fixture';
vi.mock('node:zlib', async (original) => {
  const zlib = await original<typeof import('node:zlib')>(); return { ...zlib, inflateRawSync: vi.fn(zlib.inflateRawSync) };
});

test('FR-006: Given truncated or inconsistent ZIP metadata, When validating before SheetJS, Then malformed containers fail before decompression', () => {
  const valid = zipFixture({ 'sheet.xml': '<sheet/>' }); expect(() => validateXlsxZip(valid)).not.toThrow();
  const noEnd = valid.subarray(0, -22); const badOffset = Buffer.from(valid); badOffset.writeUInt32LE(0xfffffff0, badOffset.length - 6);
  const badLocal = Buffer.from(valid); badLocal.writeUInt32LE(0, 0); const badCount = Buffer.from(valid); badCount.writeUInt16LE(100, badCount.length - 12);
  const encrypted = Buffer.from(valid); encrypted.writeUInt16LE(1, 6);
  for (const bytes of [Buffer.alloc(0), noEnd, badOffset, badLocal, badCount, encrypted]) { expect(() => validateXlsxZip(bytes)).toThrow(/XLSX|ZIP/); }
  const zip64 = Buffer.from(valid); zip64.writeUInt16LE(0xffff, zip64.length - 12); expect(() => validateXlsxZip(zip64)).toThrow(/ZIP64.*unsupported/);
});

test('FR-006: Given corrupt ZIP data expanding beyond its declared length, When validating it, Then native inflation is bounded by that declared length before allocation', () => {
  const bytes = zipFixture({ 'payload': 'x'.repeat(1024 * 1024) }, true); const central = bytes.readUInt32LE(bytes.length - 6);
  bytes.writeUInt32LE(1, 22); bytes.writeUInt32LE(1, central + 24); vi.mocked(inflateRawSync).mockClear();
  expect(() => validateXlsxZip(bytes)).toThrow(/XLSX|ZIP/);
  expect(inflateRawSync).toHaveBeenCalledWith(expect.anything(), { maxOutputLength: 1 });
});

test.each(['XL/worksheets/sheet1.xml', 'xl\\worksheets\\sheet1.xml', 'Root Entry/xl/worksheets/sheet1.xml', '/xl/worksheets/sheet1.xml'])('FR-006: Given ZIP part %s beside its decoder-equivalent canonical name, When validating, Then reject ambiguous parts before text and numeric sources can differ', (alias) => {
  const input = zipFixture({ [alias]: '<auxiliary/>', 'xl/worksheets/sheet1.xml': '<main/>' });
  expect(() => validateXlsxZip(input)).toThrow(/duplicate|ambiguous/iu);
});
