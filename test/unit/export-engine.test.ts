import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, test } from 'vitest';
import { EngineClient } from '../../src/engine/engine-client';
import type { ExportReport } from '../../src/engine/engine';
import { ExportService } from '../../src/editor/export-service';
import { SqliteBrowser } from '../../src/editor/sqlite-browser';
import type { BrowserResponse } from '../../src/protocol';

beforeAll(async () => { expect((await promisify(execFile)(process.execPath, ['esbuild.js', '--production'])).stderr).toBe(''); }, 30000);
describe.each([false, true])('T-015 engine fallback=%s', (fallback) => {
  async function run(task: (engine: EngineClient, directory: string, processId: number) => Promise<void>): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t015-engine-'));
    const engine = new EngineClient({ directory: resolve('dist'), forceFallback: fallback });
    const source = resolve('test/fixtures/sample.sqlite'); const before = await readFile(source);
    try { const opened = await engine.open(source); await task(engine, directory, opened.processId); expect(await readFile(source)).toEqual(before); }
    finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
  }
  test('FR-014: Given more than a page and a large cell, When streaming both formats, Then every row and exact value survives beyond paging limits', async () => {
    await run(async (engine, directory) => {
      const progress: ExportReport[] = []; const path = join(directory, 'rows.json');
      const result = await engine.exportResults('WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<25000) SELECT x AS "", 9223372036854775807 AS "", zeroblob(24) AS "🚀" FROM n', 'json', path, (value) => { progress.push(value); });
      const text = await readFile(path, 'utf8'); const parsed: unknown = JSON.parse(text);
      expect(parsed).toMatchObject({ columns: ['', '', '🚀'] });
      if (typeof parsed !== 'object' || parsed === null || !('rows' in parsed) || !Array.isArray(parsed.rows)) { throw new Error('Expected rows'); }
      expect(parsed.rows).toHaveLength(25000); expect(parsed.rows.at(-1)).toEqual(['25000', '9223372036854775807', '[BLOB 24 bytes]']);
      expect(result).toEqual({ rows: '25000', bytes: String(Buffer.byteLength(text)), blobs: '25000' });
      expect(progress[0]?.rows).toBe('0'); expect(progress.at(-1)).toEqual(result);
      const large = join(directory, 'large.csv');
      await engine.exportResults("SELECT printf('%.*c', 4300000, 'x') AS huge, -9223372036854775808 AS minimum", 'csv', large);
      expect(await readFile(large, 'utf8')).toBe('"huge","minimum"\r\n"' + 'x'.repeat(4300000) + '","-9223372036854775808"\r\n');
      expect(await engine.query('SELECT 7')).toMatchObject({ rows: [['7']] });
    });
  }, 30000);
  test('FR-014: Given executing export SQL, When cancelled, Then the helper stops, export rejects and a fresh query works', async () => {
    await run(async (engine, directory) => {
      let began!: () => void; const started = new Promise<void>((resolveStart) => { began = resolveStart; });
      const task = engine.exportResults('WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<20000000) SELECT sum(x) FROM n', 'json', join(directory, 'cancel.json'), began);
      const rejected = expect(task).rejects.toThrow(/cancelled/u);
      await started; await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 150));
      await expect(engine.query('SELECT 9')).rejects.toThrow(/already running/u);
      await engine.cancel(); await rejected;
      expect(await engine.query('SELECT 42')).toMatchObject({ rows: [['42']] });
    });
  }, 30000);
  test('FR-014: Given invalid SQL or an existing temporary path, When exporting, Then failures reject without overwriting and subsequent reads work', async () => {
    await run(async (engine, directory) => {
      const path = join(directory, 'output'); await engine.exportResults('SELECT 1', 'csv', path); const before = await readFile(path);
      await expect(engine.exportResults('SELECT 2', 'csv', path)).rejects.toThrow(/export/iu); expect(await readFile(path)).toEqual(before);
      await expect(engine.exportResults('DELETE FROM items', 'json', join(directory, 'invalid'))).rejects.toThrow(/read-only/iu);
      expect(await engine.query('SELECT 3')).toMatchObject({ rows: [['3']] });
    });
  }, 30000);
  test('FR-014: Given a streamed export writing rows, When cancelling, crashing or closing, Then cleanup waits for helper exit and existing output survives', async () => {
    await run(async (engine, directory, initialPid) => {
      const output = join(directory, 'result.json'); await writeFile(output, 'old');
      const browser = new SqliteBrowser(engine); const service = new ExportService(resolve('test/fixtures/sample.sqlite'), engine, () => Promise.resolve(output)); browser.setExporter(service);
      const sent: BrowserResponse[] = []; const send = (message: BrowserResponse): void => { sent.push(message); };
      const sql = 'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10000000) SELECT x, printf(\'%.*c\',1024,\'x\') FROM n';
      await browser.handle({ type: 'browserQuery', requestId: 1, sql, offset: 0, limit: 1 }, send);
      let processId = initialPid;
      for (const [index, operation] of ['cancel', 'crash', 'close'].entries()) {
        if (index > 0) { processId = (await engine.open(resolve('test/fixtures/sample.sqlite'))).processId; }
        let start!: () => void; const started = new Promise<void>((resolveStart) => { start = resolveStart; });
        const pending = browser.handle({ type: 'browserExport', requestId: 2 + index * 2, format: 'json' }, (message) => {
          send(message); if (message.type === 'browserExportProgress' && BigInt(message.bytes) >= 65536n) { start(); }
        });
        await started;
        if (operation === 'cancel') { await browser.handle({ type: 'browserCancel', requestId: 3, }, send); await engine.close(); }
        else if (operation === 'crash') {
          process.kill(processId, 'SIGKILL');
        } else { browser.dispose(); await engine.close(); }
        await pending; await service.settled();
        if (operation === 'crash') { expect(sent.at(-1)).toMatchObject({ type: 'browserError' }); }
        expect(await readFile(output, 'utf8')).toBe('old'); expect(await readdir(directory)).toEqual(['result.json']);
      }
    });
  }, 30000);
});
