import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { streamRecords } from '../../src/loaders/csv-records';

test.each([',', ';', '|', '\t'] as const)('FR-004: Given %j records alternating plain and quoted text across read boundaries, When streaming, Then every field, BOM, empty value and line ending survives exactly', async (delimiter) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-csv-records-')); const source = join(directory, 'source.csv');
  const quote = (value: string): string => `"${value.replaceAll('"', '""')}"`;
  const expected: string[][] = [['first', 'second', 'third']]; const lines = [expected[0]?.join(delimiter) ?? ''];
  for (let index = 0; index < 2000; index++) {
    const plain = [`\ufeff${String(index)}${'x'.repeat(130)}`, '', 'NULL'];
    const quoted = [`quote"${delimiter}\r\n${String(index)}`, '🙂\ufeff', ''];
    expected.push(plain, quoted); lines.push(plain.join(delimiter), quoted.map(quote).join(delimiter));
  }
  const contents = `\ufeff${lines.join('\r\n')}\r\n\r\n${delimiter}`;
  expected.push([''], ['', '']);
  try {
    await writeFile(source, contents); const rows: string[][] = [];
    streamRecords(source, delimiter, (fields) => { rows.push(fields); }, () => {});
    expect(rows).toEqual(expected); expect(await readFile(source, 'utf8')).toBe(contents);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test.each(['unquoted"bad', '"closed" trailing', 'bare\rending', 'nul\0data'])('FR-004: Given a malformed plain/quoted record %j after complete plain records, When streaming, Then strict validation still refuses it', async (malformed) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-csv-records-invalid-')); const source = join(directory, 'source.csv');
  const contents = `a\n${'valid\n'.repeat(12000)}${malformed}\n`;
  try {
    await writeFile(source, contents);
    expect(() => streamRecords(source, ',', () => {}, () => {})).toThrow(/Malformed|NUL/);
    expect(await readFile(source, 'utf8')).toBe(contents);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
