import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import { browserAction, painted, sourceDigest, waitBrowser } from './sqlite-exercise';
import { closeEditor } from './sqlite-editor-lifecycle';

suite('T-031 SQLite row operations', () => {
  for (const fallback of [false, true]) {
    test(`FR-021: Given empty and populated Browse tables fallback=${String(fallback)}, When adding, confirming deletion, undoing, backing up and saving, Then source safety and exact row data agree`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
      const api = await extension.activate(); const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t031-host-'));
      const path = join(directory, 'rows.sqlite');
      const created = await promisify(execFile)(process.execPath, ['-e', `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec("CREATE TABLE data(id INTEGER PRIMARY KEY,value);INSERT INTO data VALUES(9223372036854775807,'last'),(2,'second');CREATE TABLE empty(id INTEGER PRIMARY KEY,value,other TEXT DEFAULT 'default',generated TEXT GENERATED ALWAYS AS (other || '!'))");db.close();`, path], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      assert.equal(created.stderr, '');
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      const uri = vscode.Uri.file(path);
      try {
        const before = await sourceDigest(path);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        const document = api.sqliteEditor.getDocument(uri); assert.ok(document);
        await waitBrowser(document, (status) => painted(status) && status.editorReady === true && status.rowEditing !== undefined);
        assert.equal(document.browserStatus?.rowEditing?.addDisabled, true);
        await browserAction(document, 'editMode', (status) => !status.busy && status.editing?.writeMode === true, 'true');
        const add = async (): Promise<void> => {
          await browserAction(document, 'select', (status) => status.table === 'empty' && !status.busy && status.cachedRows === 0, 'empty');
          await browserAction(document, 'rowAdd', (status) => status.rowEditing?.form === true && !status.editing?.busy);
          await browserAction(document, 'rowColumn', (status) => status.rowEditing?.column === 'value', 'value');
          await browserAction(document, 'rowType', (status) => status.rowEditing?.kind === 'integer', 'integer');
          await browserAction(document, 'rowValue', (status) => status.rowEditing?.valuePreview === '9223372036854775807', '9223372036854775807');
          await browserAction(document, 'rowStage', (status) => !status.busy && !status.editing?.busy && status.rowEditing?.pending === 1 && status.rowEditing.form === false);
        };
        await add();
        assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab?.isDirty, true); assert.deepEqual(await sourceDigest(path), before);
        let revision = document.browserStatus?.revision ?? 0;
        await vscode.commands.executeCommand('undo');
        await waitBrowser(document, (status) => !status.busy && status.rowEditing?.pending === 0, revision);
        assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab?.isDirty, false);
        revision = document.browserStatus?.revision ?? 0; await vscode.commands.executeCommand('redo');
        await waitBrowser(document, (status) => !status.busy && status.rowEditing?.pending === 1, revision);
        const metadata = document.edits.rowSchema('empty'); assert.equal(document.edits.isBusy, true);
        const backupToken = new vscode.CancellationTokenSource();
        try {
          const backup = await api.sqliteEditor.backupCustomDocument(document, { destination: vscode.Uri.file(join(directory, 'pending-backup.json')) }, backupToken.token);
          const snapshot = JSON.parse(await readFile(backup.id, 'utf8')) as { version: string; operations: { kind: string }[] };
          assert.equal(typeof snapshot.version, 'string'); assert.equal(snapshot.operations.length, 1); assert.equal(snapshot.operations[0]?.kind, 'insert');
        } finally { await metadata; backupToken.dispose(); }
        await browserAction(document, 'select', (status) => painted(status) && status.table === 'data', 'data');
        await browserAction(document, 'cell', (status) => status.cell?.row === 1 && status.cell.column === 1, '1,1');
        await browserAction(document, 'rowDelete', (status) => status.rowEditing?.confirm === true);
        assert.equal(document.edits.operations.length, 1);
        await browserAction(document, 'rowConfirm', (status) => !status.busy && status.rowEditing?.pending === 2 && !status.editing?.busy);
        assert.deepEqual(await sourceDigest(path), before);
        assert.equal((await document.session.engine.query('SELECT COUNT(*) FROM data')).rows[0]?.[0], '2');
        const backup = document.edits.backup(); assert.match(backup, /insert/u); assert.match(backup, /delete/u);
        const copy = vscode.Uri.file(join(directory, 'copy.sqlite')); const token = new vscode.CancellationTokenSource();
        try { await api.sqliteEditor.saveCustomDocumentAs(document, copy, token.token); } finally { token.dispose(); }
        await waitBrowser(document, (status) => painted(status) && !status.editing?.busy && /Saved an atomic SQLite copy/u.test(status.editing?.message ?? ''));
        assert.deepEqual(await sourceDigest(path), before); assert.equal(document.edits.dirty, true);
        await browserAction(document, 'editSave', (status) => painted(status) && status.rowEditing?.pending === 0 && /Saved all/u.test(status.editing?.message ?? ''));
        assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab?.isDirty, false);
        assert.deepEqual((await document.session.engine.query('SELECT id,value FROM data')).rows, [['2', 'second']]);
        assert.deepEqual((await document.session.engine.query('SELECT value,other,generated FROM empty')).rows, [['9223372036854775807', 'default', 'default!']]);
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
