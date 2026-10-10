import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import { closeEditor } from './sqlite-editor-lifecycle';

const hash = async (path: string): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');
async function editorApi() {
  const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager');
  assert.ok(extension);
  return { extension, api: await extension.activate() };
}
suite('T-010 SQLite custom editor', () => {
  for (const fallback of [false, true]) {
    test(`FR-001: Given valid files with all SQLite extensions and fallback=${String(fallback)}, When opened normally, Then the registered binary editor opens read-only and closes its real helper`, async function () {
      this.timeout(30000);
      const { extension, api } = await editorApi();
      const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-editor-'));
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK'];
      process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      try {
        for (const suffix of ['db', 'sqlite', 'sqlite3', 'db3']) {
          const path = join(directory, `awkward ' select 🚀.${suffix}`);
          await copyFile(join(extension.extensionPath, 'test/fixtures/sample.sqlite'), path);
          await chmod(path, 0o444);
          const before = await hash(path);
          const uri = vscode.Uri.file(path);
          await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
          const document = api.sqliteEditor.getDocument(uri);
          assert.ok(document, `Default editor missing for .${suffix}`);
          assert.equal(document.session.state.phase, 'opened');
          const opened = document.session.state.opened;
          assert.ok(opened);
          assert.equal(opened.engine, fallback ? 'sql.js' : 'node:sqlite');
          assert.ok(opened.threadId > 0);
          assert.notEqual(opened.processId, process.pid);
          const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
          assert.ok(input instanceof vscode.TabInputCustom);
          assert.equal(input.viewType, 'lite-voyager.sqlite');
          assert.ok(document.panel?.webview.html.includes('Source file is read-only.'));
          assert.ok(document.panel?.webview.html.includes(fallback ? 'Memory-limited mode' : 'Primary engine reads from disk.'));
          assert.equal(document.panel?.webview.options.enableScripts, true);
          assert.deepEqual(document.panel?.webview.options.localResourceRoots?.map((root) => root.toString()), [vscode.Uri.file(join(extension.extensionPath, 'dist')).toString()]);
          await closeEditor(document);
          assert.throws(() => process.kill(opened.processId, 0));
          assert.equal(api.sqliteEditor.getDocument(uri), undefined);
          assert.equal(await hash(path), before);
          await chmod(path, 0o644);
        }
      } finally {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; }
        else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await rm(directory, { recursive: true, force: true });
      }
    });

    test(`FR-001: Given invalid and empty databases and fallback=${String(fallback)}, When opened in the custom editor, Then failures are visible, sources are unchanged and reopening a valid file succeeds`, async function () {
      this.timeout(30000);
      const { extension, api } = await editorApi();
      const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-editor-invalid-'));
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK'];
      process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      try {
        for (const name of ['corrupt.sqlite', 'truncated.sqlite', 'zero-byte.sqlite', 'empty.sqlite']) {
          const path = join(directory, name);
          await copyFile(join(extension.extensionPath, 'test/fixtures', name), path);
          const before = await hash(path);
          const uri = vscode.Uri.file(path);
          await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
          const document = api.sqliteEditor.getDocument(uri);
          assert.ok(document);
          assert.equal(document.session.state.phase, name === 'empty.sqlite' ? 'opened' : 'error');
          if (name !== 'empty.sqlite') {
            assert.ok(document.panel?.webview.html.includes('role="alert"'));
            assert.match(document.session.state.message, /valid complete database/);
            await document.session.closed;
          }
          await closeEditor(document);
          assert.equal(await hash(path), before);
        }
        const uri = vscode.Uri.file(join(extension.extensionPath, 'test/fixtures/sample.sqlite'));
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        const recovered = api.sqliteEditor.getDocument(uri);
        assert.ok(recovered);
        assert.equal(recovered.session.state.phase, 'opened');
        await closeEditor(recovered);
      } finally {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; }
        else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await rm(directory, { recursive: true, force: true });
      }
    });
  }

  test('FR-001: Given SQLite content with another extension, When explicitly opened with Lite Voyager, Then header-based detection accepts it and reopening creates a fresh session', async function () {
    this.timeout(15000);
    const { extension, api } = await editorApi();
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-editor-header-'));
    try {
      const path = join(directory, 'database.data');
      await copyFile(join(extension.extensionPath, 'test/fixtures/sample.sqlite'), path);
      const before = await hash(path);
      const uri = vscode.Uri.file(path);
      const processes: number[] = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        const document = api.sqliteEditor.getDocument(uri);
        assert.ok(document);
        assert.equal(document.session.state.phase, 'opened');
        assert.ok(document.session.state.opened);
        processes.push(document.session.state.opened.processId);
        await closeEditor(document);
      }
      assert.notEqual(processes[0], processes[1]);
      assert.equal(await hash(path), before);
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('FR-001: Given another extension, When opened normally, Then the optional SQLite editor preserves the text editor default', async function () {
    this.timeout(15000);
    const { extension, api } = await editorApi();
    const path = join(extension.extensionPath, 'test/fixtures/sample.csv');
    const before = await hash(path);
    const uri = vscode.Uri.file(path);
    try {
      await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
      assert.ok(vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputText);
      assert.equal(api.sqliteEditor.getDocument(uri), undefined);
      const configuration = vscode.workspace.getConfiguration('workbench');
      assert.deepEqual(configuration.inspect<Record<string, string>>('editorAssociations')?.defaultValue, {
        '*.db': 'lite-voyager.sqlite', '*.sqlite': 'lite-voyager.sqlite',
        '*.sqlite3': 'lite-voyager.sqlite', '*.db3': 'lite-voyager.sqlite',
      });
      const manifest: unknown = extension.packageJSON;
      assert.ok(typeof manifest === 'object' && manifest !== null && 'contributes' in manifest);
      const contributions = manifest.contributes;
      assert.ok(typeof contributions === 'object' && contributions !== null && 'customEditors' in contributions);
      assert.deepEqual(contributions.customEditors, [{ viewType: 'lite-voyager.sqlite', displayName: 'Lite Voyager',
        selector: [{ filenamePattern: '**/*' }], priority: 'option' }]);
      assert.equal(await hash(path), before);
    } finally { await vscode.commands.executeCommand('workbench.action.closeAllEditors'); }
  });

  test('FR-001: Given an explicit user association, When a SQLite extension opens, Then the user choice overrides the contributed default', async function () {
    this.timeout(15000);
    const { extension, api } = await editorApi();
    const configuration = vscode.workspace.getConfiguration('workbench');
    const previous = configuration.inspect<Record<string, string>>('editorAssociations')?.globalValue;
    const path = join(extension.extensionPath, 'test/fixtures/sample.sqlite');
    const uri = vscode.Uri.file(path);
    const before = await hash(path);
    try {
      // The integration runner creates a disposable isolated profile; never updates the owner's profile.
      await configuration.update('editorAssociations', { ...previous, '*.sqlite': 'default' }, vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
      assert.ok(vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputText);
      assert.equal(api.sqliteEditor.getDocument(uri), undefined);
      assert.equal(await hash(path), before);
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await configuration.update('editorAssociations', previous, vscode.ConfigurationTarget.Global);
    }
  });
});
