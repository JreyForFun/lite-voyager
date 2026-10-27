import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import { browserAction, painted, sourceDigest, waitBrowser } from './sqlite-exercise';
import { closeEditor } from './sqlite-editor-lifecycle';

suite('T-030 staged SQLite editing', () => {
  for (const fallback of [false, true]) {
    test(`FR-020: Given the real custom editor and fallback=${String(fallback)}, When staging, undoing, reverting and explicitly saving, Then dirty state, exact DOM values and source safety agree`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
      const api = await extension.activate(); const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t030-host-'));
      const path = join(directory, 'editing.sqlite');
      const created = await promisify(execFile)(process.execPath, ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec("CREATE TABLE data(id INTEGER PRIMARY KEY,value,other);INSERT INTO data VALUES(9223372036854775807,'old',NULL),(2,'second','NULL')");db.close();`, path], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      assert.equal(created.stderr, '');
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      const uri = vscode.Uri.file(path);
      try {
        const before = await sourceDigest(path);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        const document = api.sqliteEditor.getDocument(uri); assert.ok(document);
        await waitBrowser(document, (status) => painted(status) && status.editorReady === true && status.editing !== undefined);
        assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab?.isDirty, false);
        await browserAction(document, 'editMode', (status) => !status.busy && status.editing?.writeMode === true, 'true');
        await browserAction(document, 'cell', (status) => status.cell?.column === 1 && status.cell.row === 0, '0,1');
        await browserAction(document, 'editValue', (status) => status.editing?.valuePreview === 'staged 😀', 'staged 😀');
        await browserAction(document, 'editCell', (status) => painted(status) && status.firstRow[1]?.text === 'staged 😀' && /pending/u.test(status.editing?.message ?? ''));
        assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab?.isDirty, true);
        assert.deepEqual(await sourceDigest(path), before);
        const copyUri = vscode.Uri.file(join(directory, 'staged-copy.sqlite'));
        const cancellation = new vscode.CancellationTokenSource();
        try { await api.sqliteEditor.saveCustomDocumentAs(document, copyUri, cancellation.token); } finally { cancellation.dispose(); }
        assert.deepEqual(await sourceDigest(path), before);
        const inspected = await promisify(execFile)(process.execPath, ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1],{readOnly:true});process.stdout.write(JSON.stringify(db.prepare('SELECT value FROM data WHERE id=2').get()));db.close();`, copyUri.fsPath], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
        assert.equal(inspected.stderr, ''); assert.deepEqual(JSON.parse(inspected.stdout), { value: 'staged 😀' });
        let revision = document.browserStatus?.revision ?? 0;
        await vscode.commands.executeCommand('undo');
        await waitBrowser(document, (status) => painted(status) && status.firstRow[1]?.text === 'second', revision);
        assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab?.isDirty, false);
        revision = document.browserStatus?.revision ?? 0;
        await vscode.commands.executeCommand('redo');
        await waitBrowser(document, (status) => painted(status) && status.firstRow[1]?.text === 'staged 😀', revision);
        await browserAction(document, 'editRevert', (status) => painted(status) && !status.editing?.writeMode && status.firstRow[1]?.text === 'second');
        assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab?.isDirty, false); assert.deepEqual(await sourceDigest(path), before);
        await browserAction(document, 'editMode', (status) => painted(status) && status.editing?.writeMode === true, 'true');
        await browserAction(document, 'cell', (status) => status.cell?.row === 0 && status.cell.column === 1, '0,1');
        await browserAction(document, 'editType', (status) => status.editing?.kind === 'integer', 'integer');
        await browserAction(document, 'editValue', (status) => status.editing?.valuePreview === '9223372036854775807', '9223372036854775807');
        await browserAction(document, 'editCell', (status) => painted(status) && status.firstRow[1]?.text === '9223372036854775807');
        await browserAction(document, 'editSave', (status) => painted(status) && /Saved all/u.test(status.editing?.message ?? ''));
        assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab?.isDirty, false);
        assert.notDeepEqual(await sourceDigest(path), before);
        const saved = await document.session.engine.query('SELECT typeof(value),value FROM data WHERE id=2');
        assert.deepEqual(saved.rows, [['integer', '9223372036854775807']]);
        await closeEditor(document);
      } finally {
        const document = api.sqliteEditor.getDocument(uri);
        if (document !== undefined) { await vscode.commands.executeCommand('workbench.action.files.revert', uri); await closeEditor(document); }
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
});
