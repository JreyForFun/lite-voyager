import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, test } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import { readXlsx } from '../../src/loaders/xlsx-book';
import { xlsxSnapshot } from '../../src/loaders/xlsx-consent';
import { XlsxLoader } from '../../src/loaders/xlsx-loader';
import { xlsxCell as cell, xlsxFixture } from '../../src/test/xlsx-fixture';

function competingParts(parts: Record<string, string> = {}): Buffer {
  const ns = 'http://schemas.openxmlformats.org';
  const header = `<row r="1">${cell('A1', 'value', 'inlineStr')}</row>`;
  return xlsxFixture([{ name: 'Data', rows: header + `<row r="2">${cell('A2', '9007199254740993')}</row>` }], parts, false, {
    'customXml/workbook.xml': `<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'customXml/_rels/workbook.xml.rels': `<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="sheet.xml"/></Relationships>`,
    'customXml/sheet.xml': `<worksheet xmlns="${ns}/spreadsheetml/2006/main"><sheetData>${header}<row r="2">${cell('A2', '9007199254740995')}</row></sheetData></worksheet>`,
  });
}

function ambiguousParts(): Buffer {
  const header = `<row r="1">${cell('A1', 'value', 'inlineStr')}${cell('B1', 'label', 'inlineStr')}</row>`;
  return xlsxFixture([{ name: 'Data', rows: header + `<row r="2">${cell('A2', '9007199254740993')}${cell('B2', 'main text', 'inlineStr')}</row>` }], {}, false, {
    'XL/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${header}<row r="2">${cell('A2', '9007199254740995')}${cell('B2', 'auxiliary text', 'inlineStr')}</row></sheetData></worksheet>`,
  });
}
test('FR-006: Given case-colliding worksheet parts with different numbers and text, When reading raw numeric cells, Then refuse the archive instead of mixing sources', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-case-parts-')); const source = join(directory, 'source.xlsx'); const input = ambiguousParts();
  try {
    await writeFile(source, input); const snapshot = await xlsxSnapshot(source); expect(() => readXlsx(source, snapshot)).toThrow(/ambiguous parts/iu);
    expect(await readFile(source)).toEqual(input);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('FR-006: Given auxiliary workbook.xml before the declared main part, When reading raw numeric cells, Then only the declared main workbook supplies the value', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-raw-parts-')); const source = join(directory, 'source.xlsx'); const input = competingParts();
  try {
    await writeFile(source, input); const book = readXlsx(source, await xlsxSnapshot(source));
    expect(book.sheet(0).rows.get(1)?.get(0)).toEqual({ text: '9007199254740993', kind: 'integer' }); expect(await readFile(source)).toEqual(input);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const relation = (target: string, extra = '', id = 'rId1'): string => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${target}" ${extra}/>`;
test.each([['xl/workbook.xml', true], ['customXml/workbook.xml', false]] as const)('FR-006: Given a Default XML content type and main target %s, When reading raw numeric cells, Then accept only the canonical workbook selected by the decoder fallback', async (target, accepted) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-default-type-')); const source = join(directory, 'source.xlsx');
  const input = competingParts({
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relation(target)}</Relationships>`,
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>',
  });
  try {
    await writeFile(source, input); const snapshot = await xlsxSnapshot(source);
    if (accepted) { expect(readXlsx(source, snapshot).sheet(0).rows.get(1)?.get(0)?.text).toBe('9007199254740993'); }
    else { expect(() => readXlsx(source, snapshot)).toThrow(/workbook.*declarations/iu); }
    expect(await readFile(source)).toEqual(input);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test.each([['/xl/workbook.xml', '9007199254740993'], ['customXml/workbook.xml', '9007199254740995']])('FR-006: Given a consistent main target %s, When reading raw numeric cells, Then respect package-root targets and alternate main locations', async (target, expected) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-main-target-')); const source = join(directory, 'source.xlsx'); const path = target.startsWith('/') ? target : `/${target}`;
  const input = competingParts({
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relation(target)}</Relationships>`,
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`,
  });
  try {
    await writeFile(source, input); expect(readXlsx(source, await xlsxSnapshot(source)).sheet(0).rows.get(1)?.get(0)?.text).toBe(expected);
    expect(await readFile(source)).toEqual(input);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('FR-006: Given an earlier macro-workbook Override beside the XLSX main Override, When reading raw numeric cells, Then refuse conflicting decoder workbook declarations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-types-')); const source = join(directory, 'source.xlsx');
  const input = competingParts({ '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/customXml/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>' });
  try {
    await writeFile(source, input); const snapshot = await xlsxSnapshot(source); expect(() => readXlsx(source, snapshot)).toThrow(/workbook.*(?:declaration|content type)/iu);
    expect(await readFile(source)).toEqual(input);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test.each([
  ['missing', ''], ['external', relation('xl/workbook.xml', 'TargetMode="External"')],
  ['multiple', relation('xl/workbook.xml') + relation('xl/workbook.xml', '', 'rId2')],
  ['inconsistent with content types', relation('customXml/workbook.xml')],
])('FR-006: Given %s main-workbook package declarations, When reading raw numeric cells, Then refuse ambiguity instead of mixing decoded text and numeric sources', async (_name, relationships) => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-invalid-parts-')); const source = join(directory, 'source.xlsx');
  const input = competingParts({ '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>` });
  try {
    await writeFile(source, input); const snapshot = await xlsxSnapshot(source); expect(() => readXlsx(source, snapshot)).toThrow(/workbook.*(?:relationship|declaration|content type)/iu);
    expect(await readFile(source)).toEqual(input);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

describe('FR-006: declared workbook through production workers', () => {
  beforeAll(async () => { const built = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']); expect(built.stderr).toBe(''); }, 30000);
  test.each(['node:sqlite', 'sql.js'] as const)('FR-006: Given %s and an earlier auxiliary workbook.xml part, When previewing and importing, Then only the declared main workbook supplies exact cell values', async (engine) => {
    const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-parts-')); const source = join(directory, 'source.xlsx'); const target = join(directory, 'result.sqlite'); const input = competingParts();
    const loader = new XlsxLoader(resolve('dist')); const client = new EngineClient({ directory: resolve('dist'), forceFallback: engine === 'sql.js' });
    try {
      await writeFile(source, input); expect((await loader.preview(source)).rows).toEqual([['9007199254740993']]);
      await loader.import(source, { path: target, engine }, {}, () => {}, new AbortController().signal); await client.open(target);
      expect((await client.query('SELECT value,typeof(value) FROM Data')).rows).toEqual([['9007199254740993', 'integer']]); expect(await readFile(source)).toEqual(input);
    } finally { await client.close(); await rm(directory, { recursive: true, force: true }); }
  });
  test.each(['node:sqlite', 'sql.js'] as const)('FR-006: Given %s and case-colliding ZIP parts, When previewing and importing, Then refuse both operations without publishing mixed data or changing source bytes', async (engine) => {
    const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-refuse-parts-')); const source = join(directory, 'source.xlsx'); const target = join(directory, 'result.sqlite'); const input = ambiguousParts();
    const loader = new XlsxLoader(resolve('dist'));
    try {
      await writeFile(source, input); await expect(loader.preview(source)).rejects.toThrow(/ambiguous parts/iu);
      await expect(loader.import(source, { path: target, engine }, {}, () => {}, new AbortController().signal)).rejects.toThrow(/ambiguous parts/iu);
      await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' }); expect(await readFile(source)).toEqual(input);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
