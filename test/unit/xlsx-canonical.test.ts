import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { readXlsx, verifyXlsxSource } from '../../src/loaders/xlsx-book';
import { xlsxSnapshot } from '../../src/loaders/xlsx-consent';
import { xlsxCell, xlsxFixture } from '../../src/test/xlsx-fixture';

test('FR-006: Given an unchanged XLSX reached with different Windows component casing, When the worker validates native canonical identity, Then exact cells load and all mutation guards remain active', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-canonical-'));
  const folder = join(directory, 'MiXeD'); const source = join(folder, 'Book.xlsx');
  const bytes = xlsxFixture([{ name: 'Data', rows: `<row r="1">${xlsxCell('A1', 'value', 'inlineStr')}</row><row r="2">${xlsxCell('A2', '9007199254740993')}</row>` }]);
  try {
    await mkdir(folder); await writeFile(source, bytes);
    const alias = process.platform === 'win32' ? source.toLowerCase() : source;
    const snapshot = await xlsxSnapshot(alias);
    expect(readXlsx(alias, snapshot).sheet(0).rows.get(1)?.get(0)?.text).toBe('9007199254740993');
    for (const field of ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'] as const) {
      expect(() => verifyXlsxSource(alias, { ...snapshot, [field]: `${snapshot[field]}1` })).toThrow('The XLSX source changed');
    }
    expect(await xlsxSnapshot(source)).toEqual(snapshot); expect(await readFile(source)).toEqual(bytes);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
