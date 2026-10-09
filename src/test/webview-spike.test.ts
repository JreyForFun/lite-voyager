import * as assert from 'node:assert';
import * as vscode from 'vscode';
import type { SpikeStatus } from '../protocol';

suite('T-008 webview spike', () => {
  test('T-008: Given a real VS Code webview, When opened and reopened, Then CodeMirror and bounded grid rows initialize', async function () {
    this.timeout(40000);
    for (let attempt = 0; attempt < 2; attempt++) {
      const status = await vscode.commands.executeCommand<SpikeStatus>('lite-voyager.webviewSpike');
      assert.ok(status, 'A real webview must report its rendered state.');
      assert.strictEqual(status.editorReady, true);
      assert.ok(status.renderedRows > 0 && status.renderedRows < 128);
      assert.ok(status.cachedRows > 0 && status.cachedRows <= 512);
      assert.strictEqual(status.firstRow, 0);
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  });
});
