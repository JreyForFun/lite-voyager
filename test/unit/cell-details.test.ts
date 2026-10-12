import { expect, test } from 'vitest';
import { cellDetails, selectionTsv } from '../../src/worker/cell-transform';

test('FR-018: Given JSON numeric tokens and duplicate keys, When formatting details, Then numbers, escapes, order and keys remain exact', () => {
  const raw = '{"n":9223372036854775807,"n":1e999,"x":[-0,1.2300,"\\u0041",{},[]]}';
  expect(cellDetails(raw)).toEqual({ text: '{\n  "n": 9223372036854775807,\n  "n": 1e999,\n  "x": [\n    -0,\n    1.2300,\n    "\\u0041",\n    {},\n    []\n  ]\n}', kind: 'JSON', notice: '' });
});

test.each([null, '', 'NULL', '[BLOB 24 bytes]', '<script>alert(1)</script>', '{broken}', '9223372036854775807', '2026-10-12', '🚀\t\n\0'])('FR-018: Given literal %s, When inspecting details, Then complete stored text and type distinctions survive', (value) => {
  const details = cellDetails(value);
  expect(details.text).toBe(value ?? 'NULL');
  // A standalone decimal is valid JSON too; classification cannot recover SQLite storage types.
  expect(details.kind).toBe(value === null ? 'SQL NULL' : value === '' ? 'Empty string' : value === '9223372036854775807' ? 'JSON' : 'Stored text');
});

test('FR-018: Given escaped strings, whitespace and JSON scalars, When formatted, Then whitespace inside tokens and original number spellings survive', () => {
  expect(cellDetails(' { "a\\\"b": "[ } , : \\n ", "b":true,"c":null } ').text).toBe('{\n  "a\\\"b": "[ } , : \\n ",\n  "b": true,\n  "c": null\n}');
  expect(cellDetails(' 1.2300 ').text).toBe('1.2300');
  expect(cellDetails('"hi"').kind).toBe('JSON');
});

test('FR-018: Given nullable, escaped and exact cells, When copying a row or rectangle, Then TSV preserves original values and documented NULL/empty tokens', () => {
  expect(selectionTsv([[null, '', 'NULL', '\\N', 'a\tb', 'a\rb\nc', 'a"b', '9223372036854775807', '[BLOB 24 bytes]'], ['{"n":1.2300}', '🚀', 'x', 'y', 'z', '1', '2', '3', '4']])).toBe([
    '\\N\t""\tNULL\t"\\N"\t"a\tb"\t"a\rb\nc"\t"a""b"\t9223372036854775807\t[BLOB 24 bytes]',
    '"{""n"":1.2300}"\t🚀\tx\ty\tz\t1\t2\t3\t4',
  ].join('\n'));
  expect(selectionTsv([['one']])).toBe('one');
});

test('FR-018: Given a cell larger than 1 MiB and 1000 columns, When inspecting/copying, Then full values survive without truncation', () => {
  const text = '🚀'.repeat(300000);
  expect(cellDetails(text).text).toBe(text);
  const rows = [Array.from({ length: 1000 }, (_, i) => i === 999 ? text : String(i))];
  expect(selectionTsv(rows).split('\t').at(-1)).toBe(text);
});

test('FR-018: Given excessive JSON expansion, When formatting exceeds its budget, Then raw text survives with an explanation and oversized copy fails explicitly', () => {
  const raw = '['.repeat(40) + '1' + ']'.repeat(40);
  expect(cellDetails(raw, 100)).toMatchObject({ text: raw, kind: 'Stored text' });
  expect(cellDetails(raw, 100).notice).toContain('raw');
  expect(() => selectionTsv([['"'.repeat(100)]], 100)).toThrow(/Nothing was truncated/);
});

test('FR-018: Given embedded NUL text, When copying TSV, Then preparation rejects explicitly without stripping any data', () => {
  expect(() => selectionTsv([['before\0after']])).toThrow(/NUL.*clipboard/);
  expect(cellDetails('before\0after').text).toBe('before\0after');
});
