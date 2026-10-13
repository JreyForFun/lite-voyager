import { expect, test, vi } from 'vitest';
import type { Cursor } from '../../src/engine/engine';
import { serializeResults } from '../../src/worker/result-export';

function cursor(columns: string[], rows: unknown[][]) {
  return { columns, rows, close: vi.fn() } satisfies Cursor;
}
test('FR-014: Given duplicate headers and exact SQLite values, When exporting JSON, Then strings, NULL, large integers and BLOB notices survive', async () => {
  const input = cursor(['', 'a', 'a', '🚀', 'json', 'blob'], [[null, '', 'NULL', 9223372036854775807n, '{"n":9223372036854775807}', new Uint8Array(24)]]);
  const chunks: Buffer[] = [];
  const report = await serializeResults(input, 'json', (chunk) => { chunks.push(Buffer.from(chunk)); return Promise.resolve(); });
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toEqual({ columns: input.columns, rows: [[null, '', 'NULL', '9223372036854775807', '{"n":9223372036854775807}', '[BLOB 24 bytes]']] });
  expect(report).toMatchObject({ rows: '1', blobs: '1' }); expect(input.close).toHaveBeenCalledOnce();
});
test('FR-014: Given CSV escaping and NULL collisions, When exporting, Then quoted text and CRLF records preserve complete fields', async () => {
  const input = cursor(['a"', 'b', 'c', 'd', 'e'], [[null, '', '\\N', 'comma,\r\n"🚀', '=1+1'], [-9223372036854775808n, 1e-200, 1e200, '\0\uFEFF', 'NULL']]);
  const chunks: Buffer[] = [];
  await serializeResults(input, 'csv', (chunk) => { chunks.push(Buffer.from(chunk)); return Promise.resolve(); });
  expect(Buffer.concat(chunks).toString('utf8')).toBe('"a""","b","c","d","e"\r\n\\N,"","\\N","comma,\r\n""🚀","=1+1"\r\n"-9223372036854775808","1e-200","1e+200","\0\uFEFF","NULL"\r\n');
});
test.each(['csv', 'json'] as const)('FR-014: Given empty and wide results, When exporting %s, Then every header is retained without fabricated rows', async (format) => {
  const input = cursor(Array.from({ length: 1000 }, (_, index) => String(index)), []); const chunks: Buffer[] = [];
  const result = await serializeResults(input, format, (chunk) => { chunks.push(Buffer.from(chunk)); return Promise.resolve(); });
  expect(result.rows).toBe('0');
  const text = Buffer.concat(chunks).toString('utf8');
  if (format === 'json') { expect(JSON.parse(text)).toEqual({ columns: input.columns, rows: [] }); }
  else { expect(text).toBe(input.columns.map((name) => `"${name}"`).join(',') + '\r\n'); }
});
test.each(['csv', 'json'] as const)('FR-014: Given a multi-MiB cell and a slow sink, When exporting %s, Then chunks stay bounded, writes never overlap and Unicode survives boundaries', async (format) => {
  const text = '"\\\n🚀\0'.repeat(250000); const input = cursor(['value'], [[text]]); const chunks: Buffer[] = [];
  let outstanding = 0; let maximum = 0;
  await serializeResults(input, format, async (chunk) => {
    maximum = Math.max(maximum, ++outstanding); expect(chunk.byteLength).toBeLessThanOrEqual(65536);
    await Promise.resolve(); chunks.push(Buffer.from(chunk)); --outstanding;
  });
  expect(maximum).toBe(1); const output = Buffer.concat(chunks).toString('utf8');
  if (format === 'json') { expect(JSON.parse(output)).toEqual({ columns: ['value'], rows: [[text]] }); }
  else { expect(output).toBe('"value"\r\n"' + text.replaceAll('"', '""') + '"\r\n'); }
});
test('FR-014: Given a write failure or unsupported value, When serializing, Then the cursor is closed and the failure propagates', async () => {
  const input = cursor(['a'], [['x']]);
  await expect(serializeResults(input, 'csv', () => Promise.reject(new Error('disk full')))).rejects.toThrow('disk full');
  expect(input.close).toHaveBeenCalledOnce();
  const invalid = cursor(['a'], [[{}]]);
  await expect(serializeResults(invalid, 'json', async () => {})).rejects.toThrow('Unsupported'); expect(invalid.close).toHaveBeenCalledOnce();
});
