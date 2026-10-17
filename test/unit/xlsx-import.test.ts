import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import { XlsxLoader } from '../../src/loaders/xlsx-loader';
import { isXlsxPreviewResult, MAX_PREVIEW_CHARACTERS } from '../../src/protocol';
import { xlsxCell as cell, xlsxFixture, zipFixture } from '../../src/test/xlsx-fixture';

const roots: string[] = [];
beforeAll(async () => { const build = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']); expect(build.stderr).toBe(''); }, 30000);
afterEach(async () => { for (const path of roots.splice(0)) { await rm(path, { recursive: true, force: true }); } });
async function fixture(bytes: Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-')); roots.push(directory);
  const source = join(directory, 'source.xlsx'); const target = join(directory, 'result.sqlite'); await writeFile(source, bytes);
  return { directory, source, target };
}
const loader = () => new XlsxLoader(resolve('dist'));
const header = (names: string[]) => `<row r="1">${names.map((name, i) => cell(String.fromCharCode(65 + i) + '1', name, 'inlineStr')).join('')}</row>`;

test('FR-006: Given implicit row/cell addresses, When importing, Then the first physical row is still the header', async () => {
  const f = await fixture(xlsxFixture([{ name: 'Implicit', rows: '<row><c t="inlineStr"><is><t>head</t></is></c></row><row><c><v>9007199254740993</v></c></row>' }]));
  const preview = await loader().preview(f.source); expect(preview.columns).toEqual(['head']); expect(preview.rows).toEqual([['9007199254740993']]);
});

test('FR-006: Given a Windows URI with a lower-case drive letter, When previewing its unchanged source, Then canonical spelling differences cannot masquerade as a source mutation', async () => {
  const f = await fixture(xlsxFixture([{ name: 'Data', rows: header(['a']) }]));
  const path = f.source.replace(/^[A-Z]:/u, (drive) => drive.toLowerCase());
  expect((await loader().preview(path)).columns).toEqual(['a']);
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-006: Given %s and an exponential integer outside int64, When importing, Then the complete lexical token remains TEXT', async (engine) => {
  const f = await fixture(xlsxFixture([{ name: 'Exact', rows: header(['value']) + `<row r="2">${cell('A2', '1.0000000000000001e+21')}</row>` }]));
  await loader().import(f.source, { path: f.target, engine }, {}, () => {}, new AbortController().signal);
  const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
  try { await client.open(f.target); expect((await client.query('SELECT value,typeof(value) FROM Exact')).rows).toEqual([['1.0000000000000001e+21', 'text']]); }
  finally { await client.close(); }
});

test.each(['first', 'later'])('FR-006: Given duplicate XML value elements in the %s sheet, When parsing them, Then malformed data cannot manufacture a new value or publish a partial workbook', async (position) => {
  const corrupt = { name: 'Bad', rows: header(['a']) + '<row r="2"><c r="A2"><v>4</v><v>2</v></c></row>' };
  const f = await fixture(xlsxFixture(position === 'first' ? [corrupt] : [{ name: 'Good', rows: header(['a']) }, corrupt])); const load = loader();
  if (position === 'first') { await expect(load.preview(f.source)).rejects.toThrow(/XML|value|cell/); }
  await expect(load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/XML|value|cell/);
  expect(await readdir(f.directory)).toEqual(['source.xlsx']);
});

test('FR-006: Given malformed shared-string XML with valid ZIP checksums, When reading a referenced string, Then parsing refuses it instead of accepting repaired text', async () => {
  const ns = 'http://schemas.openxmlformats.org';
  const f = await fixture(xlsxFixture([{ name: 'Strings', rows: header(['value']) + `<row r="2">${cell('A2', '0', 's')}</row>` }], {
    '[Content_Types].xml': `<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rStrings" Type="${ns}/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    'xl/sharedStrings.xml': `<sst xmlns="${ns}/spreadsheetml/2006/main"><si><t>hello</sst>`,
  })); const load = loader();
  await expect(load.preview(f.source)).rejects.toThrow(/XML|XLSX/);
  await expect(load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/XML|XLSX/);
  expect(await readdir(f.directory)).toEqual(['source.xlsx']);
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-006: Given %s and typed empty/absent formula caches, When importing, Then missing caches are NULL and explicitly cached empty text stays empty with accurate notices', async (engine) => {
  const cells = ['n', 'b', 'e', 'str'].map((type, i) => `<c r="${String.fromCharCode(65 + i)}2" t="${type}"><f>NOW()</f><v/></c>`).join('');
  const absent = ['n', 'b', 'e', 'str'].map((type, i) => `<c r="${String.fromCharCode(65 + i)}3" t="${type}"><f>NOW()</f></c>`).join('');
  const f = await fixture(xlsxFixture([{ name: 'Caches', rows: header(['n', 'b', 'e', 's']) + `<row r="2">${cells}</row><row r="3">${absent}</row>` },
    { name: 'EmptyText', rows: header(['value']) + '<row r="2"><c r="A2" t="str"><f>""</f><v/></c></row>' }]));
  const tables = await loader().import(f.source, { path: f.target, engine }, {}, () => {}, new AbortController().signal);
  expect(tables[0]?.notice).toContain('This sheet has formulas with missing caches'); expect(tables[1]?.notice).not.toContain('This sheet has formulas with missing caches');
  const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
  try { await client.open(f.target); expect((await client.query('SELECT n,b,e,s FROM Caches')).rows).toEqual([[null, null, null, ''], [null, null, null, null]]); }
  finally { await client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-006: Given %s and a real curated workbook, When importing, Then all three sheets, headers, cached formulas and exact text integers survive', async (engine) => {
  const f = await fixture(await readFile('test/fixtures/sample.xlsx')); const before = await readFile(f.source); const load = loader();
  const preview = await load.preview(f.source); expect(isXlsxPreviewResult(preview)).toBe(true); expect(preview.format).toBe('xlsx'); expect(preview.sheetCount).toBe(3);
  const tables = await load.import(f.source, { path: f.target, engine }, {}, () => {}, new AbortController().signal);
  expect(tables.map((table) => table.name)).toEqual(['Data', 'Totals', 'Empty']);
  const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
  try { await client.open(f.target);
    expect((await client.query('SELECT * FROM Totals')).rows.flat()).toContain('6.25');
    expect((await client.page('Data')).rows.flat()).toContain('9007199254740993');
    expect((await client.page('Empty')).rows).toEqual([]); expect(await readFile(f.source)).toEqual(before);
  } finally { await client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-006: Given %s raw int64 and mixed Excel cell types, When importing, Then no JavaScript rounding, affinity coercion or formula calculation occurs', async (engine) => {
  const rows = header(['id', 'value', 'error', 'bool', 'date', 'cache'])
    + `<row r="2">${cell('A2', '9007199254740993')}${cell('B2', '', 'inlineStr')}${cell('C2', '#DIV/0!', 'e')}${cell('D2', '1', 'b')}${cell('E2', '45352.5')}${cell('F2', '6.25', 'n', '1+2')}</row>`
    + `<row r="3">${cell('A3', '-9223372036854775808')}${cell('B3', 'NULL', 'inlineStr')}${cell('D3', '0', 'b')}<c r="F3"><f>NOW()</f></c></row>`
    + `<row r="4">${cell('A4', '9223372036854775807')}${cell('B4', 'before_x0000_after 🙂', 'inlineStr')}</row>`
    + `<row r="5">${cell('A5', '9223372036854775808')}${cell('B5', '1.00', 'n')}</row>`
    + `<row r="6">${cell('A6', '1e9999')}${cell('B6', '1e-9999')}</row>`;
  const f = await fixture(xlsxFixture([{ name: 'select "🙂', rows }])); const load = loader();
  const preview = await load.preview(f.source); expect(preview.rows[0]?.[0]).toBe('9007199254740993'); expect(preview.notice).toMatch(/cache|formula/i);
  const tables = await load.import(f.source, { path: f.target, engine }, {}, () => {}, new AbortController().signal); expect(tables[0]?.notice).toMatch(/missing.*cache|cache.*missing/i);
  const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
  try { await client.open(f.target);
    expect((await client.query('SELECT id,typeof(id),value,error,bool,date,cache FROM "select ""🙂"')).rows).toEqual([
      ['9007199254740993', 'integer', '', '#DIV/0!', '1', '45352.5', '6.25'],
      ['-9223372036854775808', 'integer', 'NULL', null, '0', null, null],
      ['9223372036854775807', 'integer', 'before\0after 🙂', null, null, null, null],
      ['9223372036854775808', 'text', '1.00', null, null, null, null], ['1e9999', 'text', '1e-9999', null, null, null, null],
    ]);
  } finally { await client.close(); }
});

test.each(['node:sqlite', 'sql.js'] as const)('FR-006: Given %s sparse sheets and colliding headers/names, When importing, Then every supported cell and interior empty row survives', async (engine) => {
  const rows = header(['', 'A', 'a', 'select', '_rowid_', 'rowid', 'oid']) + `<row r="3">${cell('A3', 'tail', 'inlineStr')}${cell('H3', '9')}</row>`;
  const f = await fixture(xlsxFixture([{ name: 'sqlite_master', rows, dimension: 'A1:A1' }, { name: 'Header', rows: header(['only']) }, { name: 'Hidden', rows: '', hidden: true }]));
  const tables = await loader().import(f.source, { path: f.target, engine }, {}, () => {}, new AbortController().signal);
  expect(tables[0]?.name).not.toBe('sqlite_master'); expect(tables[0]?.columns).toEqual(['column_1', 'A', 'a_2', 'select', '_rowid_', 'rowid', 'oid', 'column_8']);
  expect(tables.map((t) => t.rowCount)).toEqual(['2', '0', '0']);
  const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
  try { await client.open(f.target); const name = tables[0]?.name; expect(name).toBeTruthy();
    expect((await client.query(`SELECT column_1,column_8 FROM "${name ?? ''}"`)).rows).toEqual([[null, null], ['tail', '9']]);
  } finally { await client.close(); }
});

test.each(['zero bytes', 'CSV masquerade', 'corrupt ZIP', 'truncated ZIP', 'missing workbook', 'unsupported width'])('FR-006: Given %s, When loading, Then clear failure publishes nothing and valid retry works', async (input) => {
  const load = loader();
  const bytes = input === 'zero bytes' ? Buffer.alloc(0) : input === 'CSV masquerade' ? Buffer.from('a,b\n1,2')
    : input === 'corrupt ZIP' ? await readFile('test/fixtures/corrupt.xlsx') : input === 'truncated ZIP' ? await readFile('test/fixtures/truncated.xlsx')
      : input === 'missing workbook' ? zipFixture({ 'test.xml': '<broken>' }) : xlsxFixture([{ name: 'Wide', rows: `<row r="1">${cell('CAY1', 'too wide', 'inlineStr')}</row>` }]);
    const f = await fixture(bytes);
    await expect(load.preview(f.source)).rejects.toThrow(/XLSX|Excel|column|workbook/i);
    await expect(load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow();
    expect(await readdir(f.directory)).toEqual(['source.xlsx']);
  const valid = await fixture(xlsxFixture([{ name: 'Okay', rows: header(['a']) }])); expect((await load.preview(valid.source)).columns).toEqual(['a']);
});

test('FR-006: Given 1,000 columns, 32,767-character text and 120 rows, When previewing then fully importing, Then preview stays bounded and import retains the full supported data', async () => {
  const names = Array.from({ length: 1000 }, (_, i) => `c${String(i)}`); const { utils } = await import('xlsx');
  const top = `<row r="1">${names.map((name, i) => cell(utils.encode_cell({ r: 0, c: i }), name, 'inlineStr')).join('')}</row>`;
  const rows = top + Array.from({ length: 120 }, (_, i) => `<row r="${String(i + 2)}">${cell(`A${String(i + 2)}`, 'x'.repeat(32767), 'inlineStr')}${cell(`ALL${String(i + 2)}`, 'last', 'inlineStr')}</row>`).join('');
  const f = await fixture(xlsxFixture([{ name: 'Wide', rows }])); const load = loader(); const preview = await load.preview(f.source);
  expect(isXlsxPreviewResult(preview)).toBe(true); expect(preview.columns.length).toBeLessThanOrEqual(256); expect(preview.rows.length).toBeLessThanOrEqual(100);
  expect(JSON.stringify(preview.rows).length).toBeLessThan(MAX_PREVIEW_CHARACTERS + 10000); expect(preview.reachedEnd).toBe(false); expect(preview.notice).toMatch(/preview/i);
  await chmod(f.source, 0o444);
  const client = new EngineClient({ directory: resolve('dist') });
  try { await load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal); await client.open(f.target);
    expect((await client.query('SELECT count(*),length(c0),c999 FROM Wide')).rows).toEqual([['120', '32767', 'last']]);
  } finally { await client.close(); await chmod(f.source, 0o644); }
}, 30000);

test('FR-006: Given cancellation, observer failure, existing targets and fallback source refusal, When importing, Then helpers exit, source/targets survive and retry succeeds', async () => {
  const f = await fixture(xlsxFixture([{ name: 'Data', rows: header(['a']) + `<row r="2">${cell('A2', '7')}</row>` }])); const load = loader(); const before = await readFile(f.source);
  const abort = new AbortController();
  await expect(load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => { abort.abort(); }, abort.signal)).rejects.toThrow(/cancel/i);
  await expect(load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => { throw new Error('observer'); }, new AbortController().signal)).rejects.toThrow('observer');
  expect(await readdir(f.directory)).toEqual(['source.xlsx']); await writeFile(f.target, 'keep');
  for (const path of [f.source, f.target]) { await expect(load.import(f.source, { path, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(); }
  expect(await readFile(f.target, 'utf8')).toBe('keep'); expect(await readFile(f.source)).toEqual(before); await rm(f.target);
  expect((await load.import(f.source, { path: f.target, engine: 'sql.js' }, {}, () => {}, new AbortController().signal))[0]?.rowCount).toBe('1'); await rm(f.target);
  await truncate(f.source, 20_000_001);
  await expect(load.import(f.source, { path: f.target, engine: 'sql.js' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/Memory-limited.*20,000,000/);
});

test('FR-006: Given source mutation during parsing or a malformed later sheet, When importing, Then no partial workbook is published', async () => {
  const bytes = xlsxFixture([{ name: 'Good', rows: header(['a']) }, { name: 'Bad', rows: header(['b']) }], {
    'xl/worksheets/sheet2.xml': '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>broken</t></is></row></sheetData></worksheet>',
  }); const f = await fixture(bytes); const load = loader();
  await expect(load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/XLSX|XML/);
  expect(await readdir(f.directory)).toEqual(['source.xlsx']);
  await writeFile(f.source, xlsxFixture([{ name: 'Good', rows: header(['a']) }]));
  let mutation: Promise<void> | undefined;
  await expect(load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => { mutation ??= writeFile(f.source, 'changed'); }, new AbortController().signal)).rejects.toThrow(/chang|XLSX/);
  await mutation; expect(await readdir(f.directory)).toEqual(['source.xlsx']); expect(await readFile(f.source, 'utf8')).toBe('changed');
});

test('FR-006: Given a compact XLSX expanding beyond fallback SQLite capacity, When importing, Then the unchanged 64,000,000-byte guard refuses all sheets', async () => {
  const rows = header(['payload']) + Array.from({ length: 2100 }, (_, i) => `<row r="${String(i + 2)}">${cell(`A${String(i + 2)}`, 'x'.repeat(32767), 'inlineStr')}</row>`).join('');
  const f = await fixture(xlsxFixture([{ name: 'Expanded', rows }], {}, true)); expect((await readFile(f.source)).length).toBeLessThan(20_000_000);
  await expect(loader().import(f.source, { path: f.target, engine: 'sql.js' }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/64,000,000/);
  expect(await readdir(f.directory)).toEqual(['source.xlsx']);
}, 30000);

test('FR-006: Given a live XLSX helper crash or cancelled preview, When recovering, Then every helper exits, no partial database survives and a valid import still succeeds', async () => {
  const f = await fixture(xlsxFixture([{ name: 'Data', rows: header(['a']) + `<row r="2">${cell('A2', '7')}</row>` }])); const load = loader(); const before = await readFile(f.source); let killed = false;
  await expect(load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, (progress) => {
    if (!killed && progress.processId !== undefined && progress.processId !== process.pid) { killed = true; process.kill(progress.processId, 'SIGKILL'); }
  }, new AbortController().signal)).rejects.toThrow(/helper|worker/i);
  expect(killed).toBe(true); expect(await readdir(f.directory)).toEqual(['source.xlsx']);
  const abort = new AbortController(); const preview = load.preview(f.source, {}, abort.signal); abort.abort(); await expect(preview).rejects.toThrow(/cancel/i);
  expect((await load.import(f.source, { path: f.target, engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal))[0]?.rowCount).toBe('1'); expect(await readFile(f.source)).toEqual(before);
}, 30000);
