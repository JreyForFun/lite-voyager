import * as assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import type { CsvImportSession } from '../editor/csv-import';
import type { BrowserStatus, CsvImportState } from '../protocol';

function waitFor(session: CsvImportSession, predicate: () => boolean, description: string): Promise<void> {
  if (predicate()) { return Promise.resolve(); }
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => { remove(); reject(new Error(`${description}: ${JSON.stringify(session.state)}; browser=${JSON.stringify(session.browserStatus)}`)); }, 15000);
    const remove = session.onStatus(() => { if (predicate()) { clearTimeout(timer); remove(); accept(); } });
  });
}
async function open(path: string): Promise<CsvImportSession> {
  const session = await vscode.commands.executeCommand<CsvImportSession>('lite-voyager.csvImport', vscode.Uri.file(path)); assert.ok(session); await session.finished;
  assert.equal(session.state.phase, 'ready'); return session;
}
async function exercise(session: CsvImportSession, action: 'start' | 'refresh' | 'cancel', predicate: (state: CsvImportState) => boolean, options?: { delimiter: ',' | '\t' | ';' | '|'; header: boolean; allText: boolean }): Promise<void> {
  const previous = session.state;
  await Promise.all([
    waitFor(session, () => session.state !== previous && predicate(session.state), `Import ${action} deadline`),
    session.panel.webview.postMessage({ type: 'csvImportExercise', contextId: session.contextId, action, ...(options === undefined ? {} : { options }) }).then((sent) => { assert.equal(sent, true); }),
  ]);
}
async function browserAction(session: CsvImportSession, action: 'sql' | 'run' | 'next', predicate: (status: BrowserStatus) => boolean, value?: string): Promise<void> {
  const revision = session.browserStatus?.revision ?? 0;
  await Promise.all([
    waitFor(session, () => session.browserStatus !== undefined && session.browserStatus.revision > revision && predicate(session.browserStatus), `SQL ${action} deadline`),
    session.panel.webview.postMessage({ type: 'browserExercise', action, ...(value === undefined ? {} : { value }) }).then((sent) => { assert.equal(sent, true); }),
  ]);
}

suite('T-021 real CSV / TSV import', () => {
  for (const fallback of [false, true]) {
    test(`FR-004: Given real import controls and fallback=${String(fallback)}, When previewing/importing/querying, Then DOM controls, exact int64, pages and source safety work`, async function () {
      this.timeout(45000);
      const directory = await mkdtemp(join(tmpdir(), 'lv-import-host-')); const path = join(directory, 'source.csv');
      const contents = `\ufeffid;text\r\n${Array.from({ length: 250 }, (_, i) => `${i === 1 ? '\ufeff' : ''}${String(9007199254740993n + BigInt(i))};"row ${String(i)}\r\nline"`).join('\r\n')}\r\n`;
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      let session: CsvImportSession | undefined;
      try {
        await writeFile(path, contents); session = await open(path); const current = session;
        assert.ok(session.state.preview !== undefined && 'delimiter' in session.state.preview);
        assert.equal(session.state.preview.delimiter, ';'); assert.equal(session.state.preview.rows[0]?.[0], '9007199254740993');
        assert.equal(session.state.preview.rows[1]?.[0], '\ufeff9007199254740994');
        await waitFor(session, () => current.firstRowsMs !== undefined, 'Preview DOM deadline');
        assert.ok(session.firstRowsMs !== undefined && session.firstRowsMs < 2000, `first-row DOM ${String(session.firstRowsMs)}ms`);
        await exercise(session, 'refresh', (state) => state.phase === 'ready' && state.options.allText === true, { delimiter: ';', header: true, allText: true });
        await exercise(session, 'start', (state) => state.phase === 'importing'); await session.finished;
        assert.equal(session.state.phase, 'opened'); assert.equal(session.state.progress?.engine, fallback ? 'sql.js' : 'node:sqlite');
        assert.equal(session.state.progress?.rows, '250'); assert.equal(session.state.progress.bytes, String(Buffer.byteLength(contents)));
        await waitFor(session, () => current.browserStatus?.renderedRows !== undefined && current.browserStatus.renderedRows > 0 && !current.browserStatus.busy, 'Imported grid DOM deadline');
        assert.equal(session.browserStatus?.firstRow[0]?.text, '9007199254740993');
        await browserAction(session, 'next', (status) => !status.busy && status.offset === 100 && status.renderedRows > 0);
        const sql = 'SELECT count(*) AS n, typeof(id) AS kind FROM records';
        await browserAction(session, 'sql', (status) => status.sqlLength === sql.length, sql);
        await browserAction(session, 'run', (status) => status.query === true && !status.busy && status.firstRow[0]?.text === '250');
        assert.equal(session.browserStatus?.firstRow[1]?.text, 'text'); assert.equal(await readFile(path, 'utf8'), contents);
        const bomSql = 'SELECT id FROM records WHERE rowid=2';
        await browserAction(session, 'sql', (status) => status.sqlLength === bomSql.length, bomSql);
        await browserAction(session, 'run', (status) => status.query === true && !status.busy && status.firstRow[0]?.text === '\ufeff9007199254740994');
        process.stdout.write(`T-021 fallback=${String(fallback)}: first-row DOM ${String(session.firstRowsMs)}ms; 250 rows, paged SQL and exact values PASS.\n`);
      } finally {
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        session?.panel.dispose(); await session?.closed; await rm(directory, { recursive: true, force: true });
      }
    });
  }
  test('FR-004: Given two imports and a running primary import, When clicking Cancel and closing, Then source safety and independent worker cleanup permit recovery', async function () {
    this.timeout(45000);
    const directory = await mkdtemp(join(tmpdir(), 'lv-import-cancel-host-')); const path = join(directory, 'source.csv');
    const contents = `a,b\n${'123456789,abcdefghijk\n'.repeat(200000)}`;
    const sessions: CsvImportSession[] = [];
    try {
      await writeFile(path, contents); const first = await open(path); sessions.push(first); const current = first;
      await waitFor(first, () => current.firstRowsMs !== undefined, 'Preview DOM');
      const second = await open(path); sessions.push(second); first.panel.reveal(vscode.ViewColumn.Active);
      await exercise(first, 'start', (state) => state.phase === 'importing');
      await waitFor(first, () => current.state.progress !== undefined && current.state.phase === 'importing', 'Import progress');
      const start = performance.now(); await exercise(first, 'cancel', (state) => state.phase === 'cancelled'); await first.finished;
      const cancelMs = performance.now() - start; assert.ok(cancelMs < 1000, `cancel took ${String(cancelMs)}ms`);
      first.panel.dispose(); await first.closed; assert.equal(second.state.phase, 'ready');
      assert.equal(await readFile(path, 'utf8'), contents);
      second.panel.dispose(); await second.closed; assert.deepEqual(await readdir(directory), ['source.csv']);
      await writeFile(path, 'a,b\n1,2\n'); const recovered = await open(path); sessions.push(recovered); await recovered.startImport(); assert.equal(recovered.state.phase, 'opened');
      process.stdout.write(`T-021 primary cancel: ${String(cancelMs)}ms; independent preview and recovery PASS.\n`);
    } finally { for (const session of sessions) { session.panel.dispose(); await session.closed; } await rm(directory, { recursive: true, force: true }); }
  });
});
