import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { parseJsonObject, streamJsonRecords } from '../../src/loaders/json-records';

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) { rmSync(path, { recursive: true, force: true }); } });
function file(contents: string | Uint8Array): string {
  const directory = mkdtempSync(join(tmpdir(), 'lv-json-reader-')); directories.push(directory);
  const path = join(directory, 'input.json'); writeFileSync(path, contents); return path;
}

test('FR-005: Given exact JSON scalars and nested values, When tokenizing, Then no numeric lexeme is rounded', () => {
  expect([...parseJsonObject('{"id":9007199254740993,"big":9223372036854775808,"tiny":1e-9999,"r":1.5,"b":true,"n":null,"s":"\\u263a","nested": { "n":9007199254740993 }}')]).toEqual([
    ['id', { text: '9007199254740993', kind: 'integer' }], ['big', { text: '9223372036854775808', kind: 'text' }],
    ['tiny', { text: '1e-9999', kind: 'text' }], ['r', { text: '1.5', kind: 'real' }],
    ['b', { text: '1', kind: 'integer' }], ['n', { text: null, kind: 'null' }], ['s', { text: '☺', kind: 'text' }],
    ['nested', { text: '{ "n":9007199254740993 }', kind: 'text' }],
  ]);
});

test.each(['{"a":1,"a":2}', '{"a":{"x":1,"x":2}}', '{"a":01}', '{"a":+1}', '{"a":NaN}', '{"a":undefined}', '{"a":1,}', '{"a" 1}', '{"a":"\\ud800"}', '{"a":[1,]}', '{}true', '[]', 'null'])('FR-005: Given malformed/ambiguous JSON %s, When parsing, Then an actionable error replaces silent data loss', (input) => {
  expect(() => parseJsonObject(input)).toThrow(/JSON|Unicode|duplicate/i);
});

test('FR-005: Given deeply nested valid input, When validating, Then the parser does not recurse on the JavaScript stack', () => {
  const nested = '['.repeat(15000) + '9007199254740993' + ']'.repeat(15000);
  expect(parseJsonObject(`{"deep":${nested}}`).get('deep')?.text).toBe(nested);
});

test.each(['json', 'jsonl'] as const)('FR-005: Given %s, BOM and chunk-split Unicode/escapes, When streaming, Then complete objects arrive in order', (format) => {
  const value = 'x'.repeat(65520) + '🙂"\\\n'; const raw = JSON.stringify({ value });
  const records: string[] = [];
  const input = format === 'json' ? `\ufeff[\n${raw}, {"late":2}\n]` : `\ufeff\r\n${raw}\r\n\n{"late":2}`;
  const result = streamJsonRecords(file(input), format, (record) => { records.push(record); }, () => {});
  expect(records.map((record) => [...parseJsonObject(record).keys()])).toEqual([['value'], ['late']]);
  expect(parseJsonObject(records[0] ?? '').get('value')?.text).toBe(value);
  expect(result).toMatchObject({ reachedEnd: true, bytesRead: String(Buffer.byteLength(input)), totalBytes: String(Buffer.byteLength(input)) });
});

test.each([['json', ''], ['json', '[{},]'], ['json', '[{} {}]'], ['json', '[{}'], ['json', '[1]'], ['json', '{}'], ['json', '[] garbage'], ['jsonl', '{}\n1'], ['jsonl', '{"a":"line\nbreak"}'] ] as const)('FR-005: Given %s invalid framing %j, When reading, Then the shape/syntax is rejected', (format, input) => {
  expect(() => streamJsonRecords(file(input), format, (record) => { parseJsonObject(record); }, () => {})).toThrow(/JSON/i);
});

test('FR-005: Given invalid or incomplete UTF-8, When reading, Then no replacement decoding occurs', () => {
  for (const bytes of [Buffer.from([91, 123, 34, 120, 34, 58, 34, 255, 34, 125, 93]), Buffer.from([91, 0xf0])]) {
    expect(() => streamJsonRecords(file(bytes), 'json', () => {}, () => {})).toThrow(/UTF-8/);
  }
});

test('FR-005: Given a preview bound, When stopping early or meeting a huge record, Then the reader keeps only complete records and reports the boundary', () => {
  const input = file('[{"a":1},{"b":2},{"c":"' + 'x'.repeat(10000) + '"}]');
  const records: string[] = [];
  expect(streamJsonRecords(input, 'json', (record) => { records.push(record); return records.length < 1; }, () => {}).reachedEnd).toBe(false);
  expect(records).toEqual(['{"a":1}']);
  expect(streamJsonRecords(input, 'json', () => {}, () => {}, 100).limit).toMatch(/record/i);
});

test('FR-005: Given a bad record after valid input, When reporting parsing failure, Then the record/line location is actionable without echoing contents', () => {
  expect(() => streamJsonRecords(file('\n{}\n{"secret":'), 'jsonl', (raw) => { parseJsonObject(raw); }, () => {})).toThrow(/JSONL line 3/);
  expect(() => streamJsonRecords(file('[{}, {"secret":}]'), 'json', (raw) => { parseJsonObject(raw); }, () => {})).toThrow(/JSON record 2/);
});
