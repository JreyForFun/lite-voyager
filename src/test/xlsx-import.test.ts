import * as assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { CsvImportController, type CsvImportSession } from '../editor/csv-import';
import { EngineClient } from '../engine/engine-client';
import type { BrowserStatus } from '../protocol';
import { xlsxCell as cell, xlsxFixture } from './xlsx-fixture';

function wait(session: CsvImportSession, predicate: () => boolean): Promise<void> {
  if (predicate()) { return Promise.resolve(); }
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => { remove(); reject(new Error(`XLSX DOM deadline: ${session.state.phase}; ${session.state.message}; ${JSON.stringify(session.browserStatus)}`)); }, 15000);
    const remove = session.onStatus(() => { if (predicate()) { clearTimeout(timer); remove(); accept(); } });
  });
}
async function action(session: CsvImportSession, control: 'start' | 'refresh' | 'cancel', phase: string): Promise<void> {
  const before = session.state;
  await Promise.all([wait(session, () => session.state !== before && session.state.phase === phase),
    session.panel.webview.postMessage({ type: 'csvImportExercise', contextId: session.contextId, action: control, options: {} }).then((sent) => { assert.ok(sent); })]);
}
async function browser(session: CsvImportSession, action: 'sql' | 'run' | 'next' | 'select', predicate: (status: BrowserStatus) => boolean, value?: string): Promise<void> {
  const revision = session.browserStatus?.revision ?? 0;
  await Promise.all([wait(session, () => session.browserStatus !== undefined && session.browserStatus.revision > revision && predicate(session.browserStatus)),
    session.panel.webview.postMessage({ type: 'browserExercise', action, ...(value === undefined ? {} : { value }) }).then((sent) => { assert.ok(sent); })]);
}
const header = `<row r="1">${cell('A1', 'id', 'inlineStr')}${cell('B1', 'text', 'inlineStr')}${cell('C1', 'empty', 'inlineStr')}</row>`;
function data(rows: number): Buffer {
  return xlsxFixture([{ name: 'Data', rows: header + Array.from({ length: rows }, (_, i) => `<row r="${String(i + 2)}">${cell(`A${String(i + 2)}`, String(9007199254740993n + BigInt(i)))}${cell(`B${String(i + 2)}`, `row ${String(i)} 🙂 <script>literal</script>`, 'inlineStr')}${cell(`C${String(i + 2)}`, '', 'inlineStr')}</row>`).join('') },
    { name: 'Totals', rows: `<row r="1">${cell('A1', 'cached', 'inlineStr')}</row><row r="2">${cell('A2', '6.25', 'n', 'SUM(Data!A2:A4)')}</row>` }, { name: 'Empty', rows: '', hidden: true }], {}, true);
}
suite('T-024 XLSX production import', () => {
  for (const fallback of [false, true]) {
    test(`FR-006: Given XLSX controls with fallback=${String(fallback)}, When importing, paging, querying across sheets and saving, Then exact values, all sheets and source safety survive closure`, async function () {
      this.timeout(60000);
      const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-host-')); const source = join(directory, 'source.xlsx'); const contents = data(250); await writeFile(source, contents);
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0'; let session: CsvImportSession | undefined;
      try {
        session = await vscode.commands.executeCommand<CsvImportSession>('lite-voyager.xlsxImport', vscode.Uri.file(source)); assert.ok(session); const current = session;
        await session.finished; assert.equal(session.state.phase, 'ready', session.state.message); assert.equal(session.state.preview?.rows[0]?.[0], '9007199254740993');
        assert.ok(session.state.preview !== undefined && 'sheetCount' in session.state.preview); assert.equal(session.state.preview.sheetCount, 3);
        await wait(session, () => current.firstRowsMs !== undefined); await action(session, 'refresh', 'ready'); await action(session, 'start', 'importing'); await session.finished;
        assert.equal(session.state.phase, 'opened'); assert.match(session.state.message, /3 sheets.*251 rows/); assert.equal(session.state.progress?.engine, fallback ? 'sql.js' : 'node:sqlite');
        await wait(session, () => current.browserStatus?.editorReady === true && !current.browserStatus.busy && current.browserStatus.renderedRows > 0);
        await browser(session, 'next', (status) => !status.busy && status.offset === 100 && status.renderedRows > 0);
        assert.equal(session.browserStatus?.firstRow[0]?.text, '9007199254741093');
        const sql = 'SELECT id,typeof(id),text,empty,(SELECT cached FROM Totals) FROM Data WHERE rowid=250';
        await browser(session, 'sql', (status) => status.sqlLength === sql.length, sql);
        await browser(session, 'run', (status) => status.query === true && !status.busy && status.cachedRows === 1 && status.renderedRows > 0);
        assert.deepEqual(session.browserStatus?.firstRow.map((value) => value.text), ['9007199254741242', 'integer', 'row 249 🙂 <script>literal</script>', '(empty)', '6.25']);
        const destination = join(directory, 'saved.sqlite'); session.configureSqliteSave(() => Promise.resolve(destination)); await session.saveAsSqlite(); assert.equal(session.saveState.phase, 'saved');
        session.panel.dispose(); await session.closed; session = undefined;
        const client = new EngineClient({ directory: join(vscode.extensions.getExtension('jreyinnovarev.lite-voyager')!.extensionPath, 'dist'), forceFallback: fallback });
        try { await client.open(destination);
          assert.deepEqual((await client.query('SELECT count(*) FROM Data')).rows, [['250']]); assert.deepEqual((await client.query('SELECT cached FROM Totals')).rows, [['6.25']]); assert.deepEqual((await client.page('Empty')).rows, []);
        } finally { await client.close(); }
        assert.deepEqual(await readFile(source), contents);
        process.stdout.write(`T-024 fallback=${String(fallback)}: 3 sheets, 251 data rows, exact DOM paging/SQL and complete SQLite save PASS.\n`);
      } finally {
        session?.panel.dispose(); await session?.closed;
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; } await rm(directory, { recursive: true, force: true });
      }
    });
  }
  test('FR-006: Given malformed XLSX and two valid independent tabs, When retrying then cancelling a real import, Then errors are visible, helpers exit and recovery preserves the source', async function () {
    this.timeout(60000); const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension); await extension.activate();
    const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-cancel-')); const source = join(directory, 'source.xlsx'); const storage = join(directory, 'storage'); const sessions: CsvImportSession[] = [];
    const controller = new CsvImportController(extension.extensionPath, storage, 'xlsx');
    try {
      await writeFile(source, 'not an XLSX'); const first = await controller.open(vscode.Uri.file(source)); assert.ok(first); sessions.push(first); await first.finished;
      assert.equal(first.state.phase, 'error'); assert.match(first.state.message, /XLSX/);
      const contents = data(20000); await writeFile(source, contents); await action(first, 'refresh', 'ready');
      const second = await controller.open(vscode.Uri.file(source)); assert.ok(second); sessions.push(second); await second.finished; assert.equal(second.state.phase, 'ready');
      first.panel.reveal(vscode.ViewColumn.Active); await action(first, 'start', 'importing'); await wait(first, () => first.state.progress !== undefined);
      const started = performance.now(); await action(first, 'cancel', 'cancelled'); await first.finished; assert.ok(performance.now() - started < 1000);
      assert.equal(second.state.phase, 'ready'); assert.deepEqual(await readFile(source), contents);
      for (const session of sessions.splice(0)) { session.panel.dispose(); await session.closed; } assert.deepEqual(await readdir(storage), []);
      await writeFile(source, data(2)); const recovered = await controller.open(vscode.Uri.file(source)); assert.ok(recovered); sessions.push(recovered); await recovered.finished; await recovered.startImport(); assert.equal(recovered.state.phase, 'opened');
    } finally { for (const session of sessions) { session.panel.dispose(); await session.closed; } controller.dispose(); await rm(directory, { recursive: true, force: true }); }
  });
});
