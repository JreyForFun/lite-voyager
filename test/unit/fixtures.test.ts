import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { inflateRawSync } from 'node:zlib';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createSmallFixtures, fixtureCases, fixtureNames } from '../../scripts/fixtures.mts';

let directory: string;
let temporary: string;
beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'lite-voyager-fixtures-test-'));
  directory = join(temporary, 'small');
  await createSmallFixtures(directory);
});
afterAll(async () => { await rm(temporary, { recursive: true, force: true }); });

test('T-005: Given the small fixture set, When inspected, Then every advertised file exists and generated hashes match its bytes', async () => {
  const manifest: unknown = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  expect(manifest).toMatchObject({ task: 'T-005', cases: fixtureCases });
  for (const name of fixtureNames) {
    const bytes = await readFile(join(directory, name));
    expect(manifest).toHaveProperty(['files', name, 'sha256'], createHash('sha256').update(bytes).digest('hex'));
    expect(manifest).toHaveProperty(['files', name, 'bytes'], bytes.length);
  }
});

test('T-005: Given committed fixtures, When checked, Then the inventory matches the actual committed bytes', async () => {
  const root = resolve('test/fixtures');
  const manifest: unknown = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  for (const name of fixtureNames) {
    const bytes = await readFile(join(root, name));
    expect(manifest).toHaveProperty(['files', name, 'sha256'], createHash('sha256').update(bytes).digest('hex'));
  }
});

// Independently read ZIP central-directory metadata and decompress fixture XML.
function zipXml(bytes: Buffer): Map<string, string> {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(end).toBeGreaterThanOrEqual(0);
  const entries = bytes.readUInt16LE(end + 10);
  let position = bytes.readUInt32LE(end + 16);
  const xml = new Map<string, string>();
  for (let index = 0; index < entries; index += 1) {
    expect(bytes.readUInt32LE(position)).toBe(0x02014b50);
    const method = bytes.readUInt16LE(position + 10);
    const size = bytes.readUInt32LE(position + 20);
    const nameLength = bytes.readUInt16LE(position + 28);
    const extraLength = bytes.readUInt16LE(position + 30);
    const commentLength = bytes.readUInt16LE(position + 32);
    const local = bytes.readUInt32LE(position + 42);
    const name = bytes.subarray(position + 46, position + 46 + nameLength).toString('utf8');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const data = bytes.subarray(start, start + size);
    expect([0, 8]).toContain(method);
    xml.set(name, (method === 8 ? inflateRawSync(data) : data).toString('utf8'));
    position += 46 + nameLength + extraLength + commentLength;
  }
  return xml;
}

test('T-005: Given the committed XLSX, When its independent ZIP/XML structure is read, Then multiple sheets, exact text integers, and a cached formula value exist', async () => {
  const xml = zipXml(await readFile(resolve('test/fixtures/sample.xlsx')));
  expect(xml.get('xl/workbook.xml')).toContain('name="Data"');
  expect(xml.get('xl/workbook.xml')).toContain('name="Totals"');
  expect(xml.get('xl/workbook.xml')).toContain('name="Empty"');
  const allXml = [...xml.values()].join('\n');
  expect(allXml).toContain('9007199254740993');
  expect(allXml).toContain('9223372036854775807');
  expect(allXml).toContain('-9223372036854775808');
  expect(allXml).toContain('SUM(Data!D2:D4)');
  expect(xml.get('xl/worksheets/sheet1.xml')).toMatch(/<x:c r="A2"[^>]*t="str"><x:v>9007199254740993<\/x:v>/);
  expect(xml.get('xl/worksheets/sheet2.xml')).toMatch(/<x:f>SUM\(Data!D2:D4\)<\/x:f><x:v>6\.25<\/x:v>/);
});

test('T-005: Given sample SQLite, When opened read-only, Then integrity, BLOB bytes, no-primary-key, composite WITHOUT ROWID, and schema metadata are valid', () => {
  const db = new DatabaseSync(join(directory, 'sample.sqlite'), { readOnly: true });
  try {
    expect(db.prepare('PRAGMA integrity_check').get()).toMatchObject({ integrity_check: 'ok' });
    expect(db.prepare('SELECT hex(payload) AS bytes FROM records WHERE id = ?').get(1)).toMatchObject({ bytes: '0001FF' });
    expect(db.prepare('PRAGMA table_info(no_primary_key)').all().every((row) => row.pk === 0)).toBe(true);
    expect(db.prepare('SELECT wr FROM pragma_table_list WHERE name = ?').get('composite')).toMatchObject({ wr: 1 });
    expect(db.prepare('SELECT * FROM composite').get()).toMatchObject({ region: 'PH', code: 'A', value: 'composite key' });
    expect(db.prepare('PRAGMA table_info(records)').all()).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'label', notnull: 1, dflt_value: "'default'" })]));
    expect(db.prepare('SELECT name FROM sqlite_schema WHERE type IN (?, ?)').all('view', 'index')).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'record_labels' }), expect.objectContaining({ name: 'records_label_idx' }),
    ]));
  } finally { db.close(); }
});

test('T-005: Given fidelity data, When read with BigInt enabled, Then int64 extrema, REAL extremes, NULL, empty string, and text NULL stay distinct', () => {
  const db = new DatabaseSync(join(directory, 'sample.sqlite'), { readOnly: true });
  try {
    const query = db.prepare('SELECT integer_value, real_value, text_value FROM fidelity ORDER BY rowid');
    query.setReadBigInts(true);
    expect(query.all()).toEqual([
      { integer_value: 9223372036854775807n, real_value: 1e300, text_value: null },
      { integer_value: -9223372036854775808n, real_value: 1e-300, text_value: '' },
      { integer_value: 9007199254740993n, real_value: -1e300, text_value: 'NULL' },
    ]);
    expect(db.prepare('SELECT "quote""name", "😀", "order" FROM "select"').get()).toMatchObject({ 'quote"name': 'quoted', '😀': 'emoji', order: 'keyword' });
  } finally { db.close(); }
});

test('T-005: Given an empty SQLite database, When its schema is queried, Then it is valid and contains no tables', () => {
  const db = new DatabaseSync(join(directory, 'empty.sqlite'), { readOnly: true });
  try { expect(db.prepare('SELECT name FROM sqlite_schema').all()).toEqual([]); } finally { db.close(); }
});

test.each(['corrupt.sqlite', 'truncated.sqlite'])('T-005: Given %s, When SQLite queries it, Then it rejects the invalid database', (name) => {
  const db = new DatabaseSync(join(directory, name), { readOnly: true });
  try { expect(() => db.prepare('PRAGMA integrity_check').all()).toThrow(); } finally { db.close(); }
});

test.each(['zero-byte.sqlite', 'empty.csv', 'empty.tsv', 'empty.json', 'empty.jsonl', 'empty.xlsx'])(
  'T-005: Given %s, When its size is inspected, Then it is genuinely zero bytes',
  async (name) => { expect((await stat(join(directory, name))).size).toBe(0); },
);

test('T-005: Given CSV and TSV edge fixtures, When raw bytes are inspected, Then BOM, CRLF, quotes, multiline fields, ragged rows, duplicate headers, and bad encoding exist', async () => {
  const bom = await readFile(join(directory, 'bom-crlf.csv'));
  expect([...bom.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bom.toString('utf8')).toContain('"comma, value"');
  expect(bom.toString('utf8')).toContain('"two\r\nlines"');
  expect(await readFile(join(directory, 'sample.tsv'), 'utf8')).toContain('id\tname\tvalue');
  expect(await readFile(join(directory, 'ragged.csv'), 'utf8')).toBe('a,b,c\n1,2\n3,4,5,6\n');
  expect(await readFile(join(directory, 'duplicate-blank-headers.csv'), 'utf8')).toBe('id,id,,select\n1,2,3,4\n');
  expect(await readFile(join(directory, 'header-only.csv'), 'utf8')).toBe('id,name\n');
  expect([...await readFile(join(directory, 'non-utf8.csv'))]).toContain(0xe9);
  expect([...await readFile(join(directory, 'binary.csv'))]).toContain(0);
  expect(await readFile(join(directory, 'unterminated.csv'), 'utf8')).toBe('id,name\n1,"unfinished');
});

test('T-005: Given JSON fixtures, When decoded without numeric coercion, Then heterogeneous keys, nesting, exact integer tokens, and unsupported/corrupt shapes are available', async () => {
  const raw = await readFile(join(directory, 'sample.json'), 'utf8');
  expect(raw).toContain('9007199254740993');
  const parsed: unknown = JSON.parse(raw);
  expect(parsed).toEqual(expect.arrayContaining([expect.objectContaining({ nested: { active: true }, missing: null }), expect.objectContaining({ extra: 'union key' })]));
  const lines = (await readFile(join(directory, 'sample.jsonl'), 'utf8')).trimEnd().split('\n');
  expect(lines).toHaveLength(3);
  lines.forEach((line) => { expect(() => { JSON.parse(line); }).not.toThrow(); });
  expect(await readFile(join(directory, 'unsupported.json'), 'utf8')).toBe('42\n');
  expect(() => { JSON.parse('{"unfinished":'); }).toThrow();
  expect(await readFile(join(directory, 'corrupt.json'), 'utf8')).toBe('{"unfinished":');
  expect(await readFile(join(directory, 'truncated.jsonl'), 'utf8')).toBe('{"id":1}\n{"id":');
});

test('T-005: Given fixture generation into an occupied directory, When attempted, Then existing files are preserved', async () => {
  const occupied = join(temporary, 'occupied');
  await mkdir(occupied);
  await expect(createSmallFixtures(occupied)).rejects.toThrow('already exists');
});

test('T-005: Given validation section 5, When the inventory is reviewed, Then every edge category has static data, a generator, or a runtime setup', async () => {
  expect(fixtureCases.map((item) => item.id)).toEqual([
    'empty', 'invalid', 'encoding', 'large-cell', 'wide-table', 'many-rows', 'awkward-names',
    'null-empty-text', 'numeric-fidelity', 'headers', 'read-only', 'locked-file', 'deleted-file',
    'cancel-query', 'cancel-import', 'worker-crash',
  ]);
  const instructions = await readFile(resolve('test/fixtures/README.md'), 'utf8');
  for (const scenario of ['Read-only', 'Locked file', 'Deleted file', 'Cancel query', 'Cancel import', 'Worker crash']) {
    expect(instructions).toContain(scenario);
  }
});
