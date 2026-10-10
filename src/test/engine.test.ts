import * as assert from 'node:assert/strict';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { EngineClient } from '../engine/engine-client';
import type { EngineCheckResult } from '../engine-panel';

suite('T-009 production Engine in the extension host', () => {
  for (const fallback of [false, true]) {
    test(`FR-001: Given the Engine Check command and fallback=${String(fallback)}, When a fixture opens, Then the real panel renders the selected mode and closing releases its helper`, async function () {
      this.timeout(15000);
      const extension = vscode.extensions.getExtension<unknown>('jreyinnovarev.lite-voyager');
      assert.ok(extension);
      await extension.activate();
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK'];
      process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      let result: EngineCheckResult | undefined;
      try {
        result = await vscode.commands.executeCommand<EngineCheckResult>('lite-voyager.engineCheck', vscode.Uri.file(join(extension.extensionPath, 'test/fixtures/sample.sqlite')));
        assert.ok(result);
        assert.ok(result.opened);
        assert.equal(result.opened.memoryLimited, fallback);
        assert.ok(result.panel.webview.html.includes(fallback ? 'Memory-limited mode' : 'Primary engine reads from disk.'));
        assert.ok(result.panel.webview.html.includes('role="status"'));
        assert.equal(result.panel.webview.options.enableScripts, false);
        result.panel.dispose();
        await result.closed;
        assert.throws(() => process.kill(result!.opened!.processId, 0));
      } finally {
        result?.panel.dispose();
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; }
        else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      }
    });
    test(`FR-001: Given the real extension host and fallback=${String(fallback)}, When opening and querying, Then the production backend is selected and runs off-thread`, async function () {
      this.timeout(15000);
      const extension = vscode.extensions.getExtension<unknown>('jreyinnovarev.lite-voyager');
      assert.ok(extension);
      await extension.activate();
      assert.ok((await vscode.commands.getCommands(true)).includes('lite-voyager.engineCheck'));
      const directory = join(extension.extensionPath, 'dist');
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK'];
      process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      const engine = new EngineClient({ directory });
      try {
        const opened = await engine.open(join(extension.extensionPath, 'test/fixtures/sample.sqlite'));
        assert.equal(opened.engine, fallback ? 'sql.js' : 'node:sqlite');
        assert.equal(opened.memoryLimited, fallback);
        assert.ok(opened.threadId > 0);
        assert.notEqual(opened.processId, process.pid);
        await assert.rejects(engine.query('EXPLAIN PRAGMA query_only=OFF'), /read-only/);
        assert.deepEqual((await engine.query('SELECT integer_value FROM fidelity ORDER BY rowid')).rows,
          [['9223372036854775807'], ['-9223372036854775808'], ['9007199254740993']]);
        assert.ok((await engine.schema({ limit: 1 })).hasMore);
        console.log(`T-009 Engine evidence: ${JSON.stringify({ vscode: vscode.version, ...opened })}`);
      } finally {
        await engine.close();
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; }
        else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      }
    });
  }
});
