import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import type { CsvImportSession } from '../editor/csv-import';
import type { BrowserExercise, BrowserStatus } from '../protocol';
import { browserAction, painted, runSql, sourceDigest, waitBrowser } from './sqlite-exercise';
import { closeEditor } from './sqlite-editor-lifecycle';
import { xlsxCell, xlsxFixture } from './xlsx-fixture';

async function externalSql(path: string, sql: string): Promise<void> {
  const result = await promisify(execFile)(process.execPath, ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec(process.argv[2]);db.close();`, path, sql], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }); assert.equal(result.stderr, '');
}
function waitImport(session: CsvImportSession, predicate: () => boolean): Promise<void> {
  if (predicate()) { return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { remove(); reject(new Error(`History/refresh import deadline: ${session.state.phase}; ${session.state.message}; ${JSON.stringify(session.browserStatus)}`)); }, 15000);
    const remove = session.onStatus(() => { if (predicate()) { clearTimeout(timer); remove(); resolve(); } });
  });
}
async function importAction(session: CsvImportSession, action: BrowserExercise['action'], predicate: (status: BrowserStatus) => boolean, value?: string): Promise<void> {
  const revision = session.browserStatus?.revision ?? 0;
  await Promise.all([waitImport(session, () => session.browserStatus !== undefined && session.browserStatus.revision > revision && predicate(session.browserStatus)),
    session.panel.webview.postMessage({ type: 'browserExercise', action, ...(value === undefined ? {} : { value }) }).then(sent => { assert.ok(sent); })]);
}
suite('T-032 T-033 history and source refresh', () => {
  for (const fallback of [false, true]) {
    test(`FR-013 FR-040: Given SQLite fallback=${String(fallback)}, When running, loading, reopening, externally changing and explicitly refreshing, Then history persists and source safety holds`, async function () {
      this.timeout(60000);
      const directory = await mkdtemp(join(tmpdir(), 'lv-history-refresh-host-')); const path = join(directory, 'source.sqlite'); const uri = vscode.Uri.file(path);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension); const api = await extension.activate();
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      try {
        await externalSql(path, "CREATE TABLE data(id INTEGER PRIMARY KEY,value);INSERT INTO data VALUES(1,'original'),(2,'second')");
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        let document = api.sqliteEditor.getDocument(uri); assert.ok(document); await waitBrowser(document, status => painted(status) && status.editorReady === true && status.source !== undefined);
        const before = await sourceDigest(path); const sql = ' SELECT id,value FROM data ORDER BY id; ';
        await browserAction(document, 'size', status => !status.busy && status.cachedRows === 1, '1');
        await runSql(document, sql); await browserAction(document, 'next', status => !status.busy && status.offset === 1);
        await browserAction(document, 'historyShow', status => !status.busy && status.history?.count === 1);
        const draft = 'SELECT 123456789 AS unexecuted_draft';
        await browserAction(document, 'sql', status => status.sqlLength === draft.length, draft);
        await browserAction(document, 'historyLoad', status => !status.busy && status.sqlLength === sql.length);
        assert.equal(document.browserStatus?.offset, 1); assert.deepEqual(await sourceDigest(path), before);
        await browserAction(document, 'completionKey', status => status.sqlLength === draft.length, 'Undo');
        await closeEditor(document); await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document); await waitBrowser(document, status => painted(status) && status.editorReady === true);
        await browserAction(document, 'historyShow', status => !status.busy && status.history?.count === 1);
        await externalSql(path, "UPDATE data SET value='external' WHERE id=1"); await document.source?.check();
        await waitBrowser(document, status => status.source?.changed === true && status.source.offered);
        await browserAction(document, 'sourceKeep', status => status.source?.changed === true && !status.source.offered);
        await externalSql(path, "UPDATE data SET value='external again' WHERE id=1"); await document.source?.check();
        await waitBrowser(document, status => status.source?.offered === true);
        await browserAction(document, 'sourceRefresh', status => !status.source?.changed && !status.source?.busy && painted(status) && status.firstRow[1]?.text === 'external again');
        await browserAction(document, 'editMode', status => !status.busy && painted(status) && status.editing?.writeMode === true, 'true');
        await browserAction(document, 'cell', status => status.cell?.row === 0 && status.cell.column === 1, '0,1');
        await browserAction(document, 'editValue', status => status.editing?.valuePreview === 'saved explicitly', 'saved explicitly');
        await browserAction(document, 'editCell', status => !status.busy && !status.editing?.busy && /1 pending operations/u.test(status.editing?.message ?? ''));
        await browserAction(document, 'editSave', status => painted(status) && /Saved all/u.test(status.editing?.message ?? ''));
        await document.source?.check(); assert.equal(document.source?.state.changed, false, 'Own committed Save must update the monitor baseline');
        await browserAction(document, 'historyShow', status => !status.busy && status.history?.count === 1);
        await closeEditor(document);
      } finally {
        const document = api.sqliteEditor.getDocument(uri); if (document !== undefined) { await vscode.commands.executeCommand('workbench.action.files.revert', uri); await closeEditor(document); }
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await rm(directory, { recursive: true, force: true });
      }
    });
    for (const format of ['csv', 'json', 'jsonl', 'xlsx'] as const) {
      test(`FR-013 FR-040: Given ${format} fallback=${String(fallback)}, When querying then refreshing a changed source, Then original-file history survives explicit reimport without source writes`, async function () {
        this.timeout(60000); const directory = await mkdtemp(join(tmpdir(), 'lv-import-history-host-')); const path = join(directory, `source.${format}`);
        const contents = (value: string): string | Buffer => format === 'xlsx' ? xlsxFixture([{ name: 'Data', rows: `<row r="1">${xlsxCell('A1', 'value', 'inlineStr')}</row><row r="2">${xlsxCell('A2', value, 'inlineStr')}</row>` }])
          : format === 'csv' ? `value\n${value}\n` : format === 'json' ? JSON.stringify([{ value }]) : JSON.stringify({ value }) + '\n';
        const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0'; let session: CsvImportSession | undefined;
        try {
          await writeFile(path, contents('original')); session = await vscode.commands.executeCommand<CsvImportSession>(format === 'csv' ? 'lite-voyager.csvImport' : format === 'xlsx' ? 'lite-voyager.xlsxImport' : 'lite-voyager.jsonImport', vscode.Uri.file(path)); assert.ok(session); const current = session;
          await session.finished; assert.equal(session.state.phase, 'ready', session.state.message);
          const start = async (): Promise<void> => {
            // Host 'ready' can precede the (re)loaded frame; Start is only real once this frame painted preview rows.
            await waitImport(current, () => current.state.phase === 'ready' && (current.previewStatus?.renderedRows ?? 0) > 0 && (current.previewStatus?.renderedColumns ?? 0) > 0);
            await current.panel.webview.postMessage({ type: 'csvImportExercise', contextId: current.contextId, action: 'start' });
            await waitImport(current, () => current.state.phase === 'opened' && current.browserStatus?.editorReady === true && !current.browserStatus.busy);
          }; await start(); const before = await sourceDigest(path);
          const sql = 'SELECT 9223372036854775807 AS exact_value';
          await importAction(session, 'sql', status => status.sqlLength === sql.length, sql);
          await importAction(session, 'run', status => !status.busy && status.firstRow[0]?.text === '9223372036854775807');
          await importAction(session, 'historyShow', status => !status.busy && status.history?.count === 1); assert.deepEqual(await sourceDigest(path), before);
          await writeFile(path, contents('external')); const external = await sourceDigest(path); await session.source?.check(); await waitImport(session, () => current.browserStatus?.source?.changed === true);
          await session.panel.webview.postMessage({ type: 'browserExercise', action: 'sourceRefresh' }); await waitImport(session, () => current.state.phase === 'ready');
          assert.equal(session.state.preview?.rows[0]?.[0], 'external'); await start();
          await importAction(session, 'historyShow', status => !status.busy && status.history?.count === 1);
          assert.deepEqual(await sourceDigest(path), external);
        } finally { session?.panel.dispose(); await session?.closed; if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; } await rm(directory, { recursive: true, force: true }); }
      });
    }
  }
});
