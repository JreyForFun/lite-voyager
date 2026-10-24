import { execFile } from 'node:child_process';
import { link, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, expect, test } from 'vitest';
import { ExportService } from '../../src/editor/export-service';
import { captureOriginalSource } from '../../src/editor/sqlite-save';
import { EngineClient } from '../../src/engine/engine-client';
import { CsvLoader } from '../../src/loaders/csv-loader';
import { JsonLoader } from '../../src/loaders/json-loader';
import { XlsxLoader } from '../../src/loaders/xlsx-loader';
import { xlsxCell, xlsxFixture } from '../../src/test/xlsx-fixture';

beforeAll(async () => {
  expect((await promisify(execFile)(process.execPath, ['esbuild.js', '--production'])).stderr).toBe('');
}, 20000);

for (const fallback of [false, true]) {
  test.each(['csv', 'tsv', 'json', 'jsonl', 'xlsx'])(
    `NFR-001: Given a real %s import with fallback=${String(fallback)}, When exporting to source aliases then an unrelated file, Then exact source bytes survive and complete query output remains available`, async (format) => {
      const root = await mkdtemp(join(tmpdir(), 'lv-export-worker-')); const source = join(root, `source.${format}`); const database = join(root, 'table.sqlite');
      const data = format === 'xlsx' ? xlsxFixture([{ name: 'Data', rows: `<row r="1">${xlsxCell('A1', 'id', 'inlineStr')}</row><row r="2">${xlsxCell('A2', '9007199254740993')}</row>` }])
        : format === 'json' ? '[{"id":9007199254740993}]' : format === 'jsonl' ? '{"id":9007199254740993}\n' : 'id\n9007199254740993\n';
      const client = new EngineClient({ directory: resolve('dist'), forceFallback: fallback });
      try {
        await writeFile(source, data); const before = await readFile(source); const snapshot = await captureOriginalSource(source);
        const loader = format === 'xlsx' ? new XlsxLoader(resolve('dist')) : format.startsWith('json') ? new JsonLoader(resolve('dist')) : new CsvLoader(resolve('dist'));
        const tables = await loader.import(source, { path: database, engine: fallback ? 'sql.js' : 'node:sqlite' }, {}, () => {}, new AbortController().signal);
        const table = tables[0]?.name; expect(table).toBeDefined(); if (table === undefined) { throw new Error('Fixture table missing.'); }
        await client.open(database); const sql = `SELECT id FROM "${table.replaceAll('"', '""')}"`;
        let destination = source;
        const service = new ExportService(database, client, () => Promise.resolve(destination), { path: source, snapshot });
        await expect(service.run(sql, 'json', () => {})).rejects.toThrow(/source/iu);
        const moved = source + '.moved'; const alias = source + '.alias'; await rename(source, moved); await link(moved, alias);
        for (const path of [moved, alias]) { destination = path; await expect(service.run(sql, 'csv', () => {})).rejects.toThrow(/source/iu); expect(await readFile(path)).toEqual(before); }
        destination = join(root, 'result.json'); await service.run(sql, 'json', () => {});
        expect(JSON.parse(await readFile(destination, 'utf8'))).toEqual({ columns: ['id'], rows: [['9007199254740993']] });
        expect(await readFile(moved)).toEqual(before);
      } finally { await client.close(); await rm(root, { recursive: true, force: true }); }
    });
}
