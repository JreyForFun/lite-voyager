import * as assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import type { CsvImportSession } from '../editor/csv-import';
import { xlsxFixture, xlsxCell } from './xlsx-fixture';
import { closeEditor } from './sqlite-editor-lifecycle';
import { OpeningLifecycleTrace } from './opening-lifecycle-diagnostics';

async function api() {
  const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension); return extension.activate();
}
function wait(session: CsvImportSession, predicate: () => boolean): Promise<void> {
  if (predicate()) { return Promise.resolve(); }
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => { remove(); reject(new Error(`D-5 DOM timeout: ${session.state.phase}; ${JSON.stringify(session.browserStatus)}`)); }, 15000);
    const remove = session.onStatus(() => { if (predicate()) { clearTimeout(timer); remove(); accept(); } });
  });
}
function content(extension: string): string | Buffer {
  if (extension === 'xlsx') { return xlsxFixture([{ name: 'Data', rows: `<row r="1">${xlsxCell('A1', 'id', 'inlineStr')}${xlsxCell('B1', 'text', 'inlineStr')}</row><row r="2">${xlsxCell('A2', '9007199254740993')}${xlsxCell('B2', 'literal <script>🙂', 'inlineStr')}</row>` }]); }
  if (extension === 'json') { return '[{"id":9007199254740993,"text":"literal <script>🙂"}]\n'; }
  if (extension === 'jsonl') { return '{"id":9007199254740993,"text":"literal <script>🙂"}\n'; }
  const delimiter = extension === 'tsv' ? '\t' : ','; return `id${delimiter}text\n9007199254740993${delimiter}literal <script>🙂\n`;
}
async function close(uri: vscode.Uri): Promise<void> {
  const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs).filter((tab) =>
    (tab.input instanceof vscode.TabInputCustom || tab.input instanceof vscode.TabInputText) && tab.input.uri.toString() === uri.toString());
  if (tabs.length > 0) { assert.equal(await vscode.window.tabGroups.close(tabs), true); }
}
function isVoyager(): boolean {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input; return input instanceof vscode.TabInputCustom && input.viewType === 'lite-voyager.sqlite';
}
suite('T-025 production file opening', () => {
  for (const fallback of [false, true]) {
    test(`D-5: Given all five local tabular formats and fallback=${String(fallback)}, When using Open With and the menu command, Then their real editor panels preview/import exact values and close safely`, async function () {
      this.timeout(90000); const application = await api(); const directory = await mkdtemp(join(tmpdir(), 'lv-opening-'));
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      const trace = new OpeningLifecycleTrace(process.env['LITE_VOYAGER_INTERVAL_DIAGNOSTICS'] === '1'); let view = 0;
      try {
        for (const extension of ['csv', 'tsv', 'json', 'jsonl', 'xlsx']) {
          const scope = { fallback, format: extension, kind: 'tabular', view: ++view };
          const uri = vscode.Uri.file(join(directory, `awkward ' 🙂.${extension}`)); const source = content(extension); await writeFile(uri.fsPath, source);
          const before = await readFile(uri.fsPath);
          trace.record(scope, 'text:start');
          await vscode.commands.executeCommand('vscode.open', uri, { preview: false }); assert.equal(isVoyager(), false, `default off for ${extension}`); await close(uri);
          trace.record(scope, 'text:complete'); trace.record(scope, 'open:start');
          if (extension === 'csv' || extension === 'xlsx') { await vscode.commands.executeCommand('lite-voyager.open', uri); }
          else { await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false }); }
          assert.ok(isVoyager());
          trace.record(scope, 'open:complete');
          const controller = extension === 'xlsx' ? application.xlsxImport : extension.startsWith('json') ? application.jsonImport : application.csvImport;
          const session = controller.sessions(uri)[0]; assert.ok(session); await session.finished; assert.equal(session.state.phase, 'ready', session.state.message);
          assert.equal(session.state.preview?.rows[0]?.[0], '9007199254740993'); await wait(session, () => session.firstRowsMs !== undefined);
          trace.record(scope, 'preview:ready'); trace.record(scope, 'import:start');
          await session.startImport(); assert.equal(session.state.phase, 'opened', session.state.message);
          trace.record(scope, 'import:complete');
          await wait(session, () => session.browserStatus?.renderedRows === 1 && session.browserStatus.editorReady === true && !session.browserStatus.busy);
          assert.equal(session.browserStatus?.firstRow[0]?.text, '9007199254740993'); assert.equal(session.browserStatus?.firstRow[1]?.text, 'literal <script>🙂');
          assert.equal(session.state.progress?.engine, fallback ? 'sql.js' : 'node:sqlite');
          trace.record(scope, 'browser:ready');
          const context = session.browserStatus?.contextId;
          trace.record(scope, 'hide:start');
          await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ content: 'D-5 hide/show' }), { preview: false });
          trace.record(scope, 'hide:complete'); trace.record(scope, 'reveal:start');
          await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
          await wait(session, () => session.browserStatus?.contextId !== context && session.browserStatus?.renderedRows === 1 && !session.browserStatus.busy);
          assert.equal(session.browserStatus?.firstRow[0]?.text, '9007199254740993');
          trace.record(scope, 'reveal:complete'); trace.record(scope, 'close:start');
          await close(uri); trace.record(scope, 'tab:closed'); await session.closed; trace.record(scope, 'session:closed');
          assert.deepEqual(await readFile(uri.fsPath), before); assert.equal(controller.sessions(uri).length, 0);
        }
        const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension);
        for (const suffix of ['csv', 'tsv', 'json', 'jsonl', 'xlsx']) {
          const scope = { fallback, format: suffix, kind: 'sqlite', view: ++view };
          const uri = vscode.Uri.file(join(directory, `renamed-sqlite.${suffix}`)); await copyFile(join(extension.extensionPath, 'test/fixtures/sample.sqlite'), uri.fsPath); const before = await readFile(uri.fsPath);
          trace.record(scope, 'open:start');
          await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
          const document = application.sqliteEditor.getDocument(uri); assert.ok(document); assert.equal(document.session.state.phase, 'opened');
          assert.equal(document.session.state.opened?.engine, fallback ? 'sql.js' : 'node:sqlite');
          trace.record(scope, 'open:complete'); trace.record(scope, 'close:start');
          await closeEditor(document, undefined, () => close(uri)); assert.deepEqual(await readFile(uri.fsPath), before);
          trace.record(scope, 'close:complete');
        }
        trace.record({ fallback, format: 'all', kind: 'cleanup', view: 0 }, 'cleanup:start');
      } finally {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await rm(directory, { recursive: true, force: true });
        trace.record({ fallback, format: 'all', kind: 'cleanup', view: 0 }, 'cleanup:complete');
      }
    });
  }
  test('D-5: Given two custom views of one source, When cancelling and closing one, Then the other imports independently and closure preserves source bytes', async function () {
    this.timeout(45000); const application = await api(); const directory = await mkdtemp(join(tmpdir(), 'lv-opening-split-'));
    const uri = vscode.Uri.file(join(directory, 'split.csv')); const source = content('csv'); await writeFile(uri.fsPath, source);
    try {
      await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
      const firstTab = vscode.window.tabGroups.activeTabGroup.activeTab; assert.ok(firstTab);
      const first = application.csvImport.sessions(uri)[0]; assert.ok(first); await first.finished; await wait(first, () => first.firstRowsMs !== undefined);
      await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { viewColumn: vscode.ViewColumn.Beside, preview: false });
      const second = application.csvImport.sessions(uri).find((session) => session !== first); assert.ok(second); await second.finished; await wait(second, () => second.firstRowsMs !== undefined);
      assert.notEqual(first.contextId, second.contextId);
      const importing = first.startImport(); await first.cancel(); await importing; assert.equal(first.state.phase, 'cancelled'); assert.equal(second.state.phase, 'ready');
      assert.equal(await vscode.window.tabGroups.close(firstTab), true); await first.closed; assert.equal(application.csvImport.sessions(uri).length, 1);
      await second.startImport(); assert.equal(second.state.phase, 'opened', second.state.message);
      await wait(second, () => second.browserStatus?.renderedRows === 1 && !second.browserStatus.busy); assert.equal(second.browserStatus?.firstRow[0]?.text, '9007199254740993');
      await close(uri); await second.closed; assert.equal(application.csvImport.sessions(uri).length, 0); assert.equal(await readFile(uri.fsPath, 'utf8'), source);
    } finally { await close(uri); await rm(directory, { recursive: true, force: true }); }
  });
  test('D-5: Given explicit associations and a dirty text buffer, When enabling/disabling opt-in defaults, Then choices, unsaved text and source bytes survive and subsequent opens follow the setting', async function () {
    this.timeout(60000); const application = await api(); const directory = await mkdtemp(join(tmpdir(), 'lv-opening-setting-'));
    const settings = vscode.workspace.getConfiguration('liteVoyager'); const workbench = vscode.workspace.getConfiguration('workbench');
    const previous = settings.inspect<boolean>('openCsvByDefault')?.globalValue; const associations = workbench.inspect<Record<string, string>>('editorAssociations')?.globalValue;
    try {
      await workbench.update('editorAssociations', { ...associations, '*.json': 'default' }, vscode.ConfigurationTarget.Global);
      const dirtyUri = vscode.Uri.file(join(directory, 'dirty.csv')); await writeFile(dirtyUri.fsPath, 'id\n1\n');
      const text = await vscode.workspace.openTextDocument(dirtyUri); const editor = await vscode.window.showTextDocument(text, { preview: false });
      await editor.edit((edit) => { edit.insert(new vscode.Position(2, 0), 'unsaved\n'); }); assert.ok(text.isDirty);
      await settings.update('openCsvByDefault', true, vscode.ConfigurationTarget.Global); await application.openingDefaults.settled;
      assert.equal(text.getText(), 'id\n1\nunsaved\n'); assert.ok(text.isDirty); assert.equal(isVoyager(), false); assert.equal(await readFile(dirtyUri.fsPath, 'utf8'), 'id\n1\n');
      for (const extension of ['csv', 'tsv', 'json', 'jsonl', 'xlsx']) {
        const uri = vscode.Uri.file(join(directory, `default.${extension}`)); await writeFile(uri.fsPath, content(extension));
        await vscode.commands.executeCommand('vscode.open', uri, { preview: false }); assert.equal(isVoyager(), extension !== 'json', extension);
        const sessions = [...application.csvImport.sessions(uri), ...application.jsonImport.sessions(uri), ...application.xlsxImport.sessions(uri)];
        for (const session of sessions) {
          await session.finished; assert.equal(session.state.phase, 'ready', session.state.message);
          await wait(session, () => session.firstRowsMs !== undefined);
        }
        await close(uri); await Promise.all(sessions.map((session) => session.closed));
      }
      await settings.update('openCsvByDefault', false, vscode.ConfigurationTarget.Global); await application.openingDefaults.settled;
      assert.deepEqual(workbench.inspect<Record<string, string>>('editorAssociations')?.globalValue, { ...associations, '*.json': 'default' });
      const uri = vscode.Uri.file(join(directory, 'off.csv')); await writeFile(uri.fsPath, content('csv')); await vscode.commands.executeCommand('vscode.open', uri, { preview: false }); assert.equal(isVoyager(), false); await close(uri);
      await vscode.window.showTextDocument(text); await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    } finally {
      await settings.update('openCsvByDefault', previous, vscode.ConfigurationTarget.Global); await application.openingDefaults.settled;
      await workbench.update('editorAssociations', associations, vscode.ConfigurationTarget.Global);
      const dirty = vscode.workspace.textDocuments.find((document) => document.uri.fsPath === join(directory, 'dirty.csv') && document.isDirty);
      if (dirty !== undefined) { await vscode.window.showTextDocument(dirty); await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor'); }
      await vscode.commands.executeCommand('workbench.action.closeAllEditors'); await rm(directory, { recursive: true, force: true });
    }
  });
});
