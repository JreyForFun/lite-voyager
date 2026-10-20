import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import type { SqliteDocument } from '../editor/sqlite-editor';
import type { BrowserExercise, BrowserStatus } from '../protocol';
import { closeEditor } from './sqlite-editor-lifecycle';
import { xlsxFixture, xlsxCell } from './xlsx-fixture';

interface Surface { readonly browserStatus: BrowserStatus | undefined; readonly panel: vscode.WebviewPanel | undefined; onBrowserStatus(listener: (status: BrowserStatus) => void): () => void; }

function wait(document: Surface, predicate: (status: BrowserStatus) => boolean): Promise<BrowserStatus> {
  if (document.browserStatus !== undefined && predicate(document.browserStatus)) { return Promise.resolve(document.browserStatus); }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error(`Autocomplete DOM deadline: ${JSON.stringify(document.browserStatus)}`)); }, 15000);
    const unsubscribe = document.onBrowserStatus((status) => { if (predicate(status)) { clearTimeout(timer); unsubscribe(); resolve(status); } });
  });
}
let exerciseId = 26000;
async function action(document: Surface, action: BrowserExercise['action'], value?: string): Promise<BrowserStatus> {
  const id = ++exerciseId; assert.ok(document.panel);
  const pending = wait(document, (status) => status.exerciseId === id);
  assert.equal(await document.panel.webview.postMessage({ type: 'browserExercise', action, exerciseId: id, ...(value === undefined ? {} : { value }) } satisfies BrowserExercise), true);
  return pending;
}

suite('T-026 schema autocomplete in real CodeMirror', () => {
  for (const fallback of [false, true]) {
    test(`FR-012: Given CSV, TSV, JSON, JSONL and XLSX imports fallback=${String(fallback)}, When completing their real schema, Then quoted columns execute exactly and sources remain unchanged`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
      const api = await extension.activate(); const directory = await mkdtemp(join(extension.extensionPath, 'out/t026-import-'));
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      try {
        for (const format of ['csv', 'tsv', 'json', 'jsonl', 'xlsx']) {
          const path = join(directory, `source.${format}`);
          const data = format === 'xlsx' ? xlsxFixture([{ name: 'Data', rows: `<row r="1">${xlsxCell('A1', 'id', 'inlineStr')}${xlsxCell('B1', 'first name', 'inlineStr')}</row><row r="2">${xlsxCell('A2', '9007199254740993')}${xlsxCell('B2', 'Ada', 'inlineStr')}</row>` }])
            : format === 'json' ? '[{"id":9007199254740993,"first name":"Ada"}]' : format === 'jsonl' ? '{"id":9007199254740993,"first name":"Ada"}\n'
              : `id${format === 'tsv' ? '\t' : ','}first name\n9007199254740993${format === 'tsv' ? '\t' : ','}Ada\n`;
          await writeFile(path, data); const before = await readFile(path); const uri = vscode.Uri.file(path);
          await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
          const controller = format === 'xlsx' ? api.xlsxImport : format.startsWith('json') ? api.jsonImport : api.csvImport;
          const session = controller.sessions(uri)[0]; assert.ok(session);
          try {
            await session.finished; assert.equal(session.state.phase, 'ready', session.state.message);
            await session.startImport(); assert.equal(session.state.phase, 'opened', session.state.message);
            const surface: Surface = { get browserStatus() { return session.browserStatus; }, panel: session.panel,
              onBrowserStatus: (listener) => session.onStatus(() => { if (session.browserStatus !== undefined) { listener(session.browserStatus); } }) };
            const ready = await wait(surface, (status) => status.editorReady === true && !status.busy && status.renderedRows === 1);
            assert.ok(ready.table !== null);
            const sql = `SELECT fi FROM "${ready.table.replaceAll('"', '""')}"`;
            await action(surface, 'sql', sql); await action(surface, 'selection', '9,9'); await action(surface, 'completionKey', 'Ctrl-Space');
            let status = await wait(surface, (status) => status.completion?.labels.includes('first name') === true && !status.busy);
            await new Promise<void>((resolve) => setTimeout(resolve, 100));
            for (let i = 0; i < 12 && status.completion?.selected !== 'first name'; i++) { status = await action(surface, 'completionKey', 'ArrowDown'); }
            assert.equal(status.completion?.selected, 'first name'); await action(surface, 'completionKey', 'Enter');
            await action(surface, 'run');
            await wait(surface, (status) => !status.busy && status.query === true && status.firstRow[0]?.text === 'Ada');
            assert.deepEqual(await readFile(path), before);
          } finally { session.panel.dispose(); await session.closed; }
        }
      } finally {
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await rm(directory, { recursive: true, force: true });
      }
    });
    test(`FR-012: Given the real webview fallback=${String(fallback)}, When completing keywords, tables and aliased quoted columns, Then keyboard insertion, undo, dismissal, Run and source safety hold`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
      const api = await extension.activate(); const path = join(extension.extensionPath, 'test/fixtures/sample.sqlite');
      const digest = async (): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex'); const before = await digest();
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      const uri = vscode.Uri.file(path); let document: SqliteDocument | undefined;
      try {
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document); const current = document;
        await wait(current, (status) => status.editorReady === true && !status.busy && status.renderedRows > 0);
        const edit = async (sql: string, position = sql.length): Promise<void> => { await action(current, 'sql', sql); await action(current, 'selection', `${String(position)},${String(position)}`); };
        const complete = async (label: string): Promise<BrowserStatus> => {
          await action(current, 'completionKey', 'Ctrl-Space');
          let status = await wait(current, (status) => !status.busy && status.completion?.labels.includes(label) === true);
          // CodeMirror's default interactionDelay is 75 ms after opening a list.
          // Model the user's time to read a suggestion before pressing Enter.
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
          for (let i = 0; i < 12 && status.completion?.selected !== label; i++) { status = await action(current, 'completionKey', 'ArrowDown'); }
          assert.equal(status.completion?.selected, label);
          return status;
        };
        await edit('SEL'); await complete('SELECT');
        await action(current, 'completionKey', 'Enter'); await wait(current, (status) => status.sqlLength === 6);
        await action(current, 'completionKey', 'Undo'); await wait(current, (status) => status.sqlLength === 3);
        await edit('SELECT * FROM rec'); await complete('records');
        await action(current, 'completionKey', 'ArrowDown'); await action(current, 'completionKey', 'Escape');
        await wait(current, (status) => status.completion?.open === false);
        await complete('records'); await action(current, 'completionKey', 'Enter');
        await wait(current, (status) => status.sqlLength === 'SELECT * FROM "records"'.length);
        await action(current, 'shortcut'); await wait(current, (status) => !status.busy && status.query === true && status.renderedRows > 0);
        const sql = 'SELECT s."quo" FROM "select" AS s';
        await edit(sql, 'SELECT s."quo'.length); await complete('quote"name');
        await action(current, 'completionKey', 'Enter');
        await wait(current, (status) => status.sqlLength === 'SELECT s."quote""name" FROM "select" AS s'.length);
        await action(current, 'run'); await wait(current, (status) => !status.busy && status.query === true && status.columns === 1);
        await edit('SELECT 1 -- rec'); await action(current, 'completionKey', 'Ctrl-Space');
        await wait(current, (status) => status.completion?.open === false && !status.busy);
        await closeEditor(current); document = undefined; assert.equal(await digest(), before);
      } finally {
        if (document !== undefined) { await closeEditor(document); }
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      }
    });
  }
});
