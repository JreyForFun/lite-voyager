import * as assert from 'node:assert/strict';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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

suite('T-014 executing query cancellation in the extension host', () => {
  for (const fallback of [false, true]) {
    test(`FR-015: Given acknowledged executing SQL and fallback=${String(fallback)}, When cancelled, Then the old helper exits within 1000 ms, recovery succeeds and host timer gaps stay within 100 ms`, async function () {
      this.timeout(15000);
      const extension = vscode.extensions.getExtension<unknown>('jreyinnovarev.lite-voyager'); assert.ok(extension);
      const path = join(extension.extensionPath, 'test/fixtures/sample.sqlite');
      const digest = async () => createHash('sha256').update(await readFile(path)).digest('hex');
      const before = await digest();
      const engine = new EngineClient({ directory: join(extension.extensionPath, 'dist'), forceFallback: fallback });
      let timer: ReturnType<typeof setInterval> | undefined;
      try {
        const opened = await engine.open(path);
        let start!: () => void;
        const started = new Promise<void>((resolve) => { start = resolve; });
        let querySettled = false;
        const query = engine.query('WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<20000000) SELECT sum(x) FROM n', [], {}, start);
        void query.then(() => { querySettled = true; }, () => { querySettled = true; });
        const rejection = assert.rejects(query, /cancelled/);
        await started;
        let ticks = 0; let maxGapMs = 0; let previous = performance.now();
        timer = setInterval(() => { const now = performance.now(); maxGapMs = Math.max(maxGapMs, now - previous); previous = now; ++ticks; }, 10);
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
        assert.equal(querySettled, false, 'the aggregate must still be executing at Cancel');
        assert.ok(ticks >= 5, 'the extension host must keep ticking during SQL execution');
        const cancelStarted = performance.now();
        const recovery = engine.cancel();
        // Attach immediately while observing the old PID; await the original below.
        void recovery.catch(() => {});
        let alive = true;
        while (alive && performance.now() - cancelStarted <= 1000) {
          try { process.kill(opened.processId, 0); }
          catch (error: unknown) {
            assert.ok(error instanceof Error && 'code' in error && error.code === 'ESRCH', 'only an absent process proves helper exit');
            alive = false;
          }
          if (alive) { await new Promise<void>((resolve) => setTimeout(resolve, 5)); }
        }
        const helperExitMs = performance.now() - cancelStarted;
        assert.equal(alive, false, 'old helper must exit, not merely reject the SQL promise');
        assert.ok(helperExitMs <= 1000, `helper exit: ${String(helperExitMs)} ms`);
        await recovery; await rejection;
        const recoveryMs = performance.now() - cancelStarted;
        assert.deepEqual((await engine.query('SELECT 42')).rows, [['42']]);
        maxGapMs = Math.max(maxGapMs, performance.now() - previous);
        assert.ok(maxGapMs <= 100, `host timer maximum interval: ${String(maxGapMs)} ms`);
        console.log(`T-014 helper/host evidence: ${JSON.stringify({ fallback, helperExitMs, recoveryMs, ticks, maxGapMs })}`);
      } finally { if (timer !== undefined) { clearInterval(timer); } await engine.close(); }
      assert.equal(await digest(), before);
    });
  }
});
