import * as assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import { browserAction, painted, runSql, sourceDigest, waitBrowser } from './sqlite-exercise';
import { closeEditor } from './sqlite-editor-lifecycle';
import { checkMemoryRun, checkMemoryComparison, parseMemorySample, type MemorySample, type MemoryReport } from './sqlite-memory-support';
import { TestBudget } from './sqlite-budget';

function observe(directory: string, signal?: AbortSignal) {
  const child = spawn(process.execPath, [join(directory, 'scripts/sqlite-memory.mts'), String(process.pid)], {
    windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const samples: MemorySample[] = [];
  let diagnostic = ''; let failure: Error | undefined;
  child.stderr.on('data', (chunk: Buffer) => { diagnostic += chunk.toString(); });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    try { samples.push(parseMemorySample(line)); }
    catch (error: unknown) { failure = error instanceof Error ? error : new Error('The memory sample could not be parsed.'); }
  });
  const closed = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => { lines.close(); if (code === 0 && diagnostic === '' && failure === undefined) { resolve(); }
      else { reject(failure ?? new Error(`The memory observer failed: ${diagnostic}`)); } });
  });
  // Attach immediately: an early process failure must not become an unhandled rejection.
  void closed.catch(() => {});
  return {
    samples,
    async next(helperPid?: number): Promise<void> {
      const previous = samples.length; const started = performance.now();
      while (samples.length === previous || (helperPid !== undefined && !samples.at(-1)?.helperIds.includes(helperPid))) {
        if (signal?.aborted === true) { throw new Error('T-016 test budget expired during memory observation.'); }
        if (failure !== undefined) { throw failure; }
        if (child.exitCode !== null) { await closed; throw new Error('The memory observer stopped before the checkpoint.'); }
        if (performance.now() - started > 5000) { throw new Error(`Memory observation deadline: ${diagnostic}`); }
        await new Promise<void>((resolve) => { setTimeout(resolve, 20); });
      }
    },
    async stop(): Promise<void> {
      child.stdin.end();
      const timer = setTimeout(() => { child.kill('SIGKILL'); }, 5000);
      try { await closed; } finally { clearTimeout(timer); }
    },
  };
}
suite('T-016 production multi-GB SQLite memory', () => {
  test('NFR-003: Given the real native editor and OS observer, When sampling a small opened database, Then host, helper including worker and renderer memory are all observed and the observer exits cleanly', async function () {
    this.timeout(30000);
    const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
    const api = await extension.activate();
    const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = '0';
    const monitor = observe(extension.extensionPath);
    try {
      await monitor.next();
      const uri = vscode.Uri.file(join(extension.extensionPath, 'test/fixtures/sample.sqlite'));
      await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
      const document = api.sqliteEditor.getDocument(uri); assert.ok(document);
      await waitBrowser(document, (status) => painted(status) && status.editorReady === true);
      const helper = document.session.state.opened?.processId; assert.ok(helper);
      for (let checkpoint = 0; checkpoint < 6; checkpoint++) {
        assert.equal((await runSql(document, 'SELECT count(*) AS n FROM records')).firstRow[0]?.text, '1');
        await monitor.next(helper);
      }
      await monitor.stop();
      const report = checkMemoryRun(monitor.samples, helper);
      assert.ok(report.hostPeakBytes > 0); assert.ok(report.helperPeakBytes > 0); assert.ok(report.rendererPeakBytes > 0);
      console.log(`T-016 observer calibration: ${JSON.stringify(report)}; small-file coverage only.`);
      await closeEditor(document);
    } finally {
      await monitor.stop(); await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
    }
  });

  test('NFR-003: Given populated 1 GB and 5 GB SQLite databases, When the real native editor opens, browses, scans and pages repeatedly, Then sampled extension/helper memory stays below 500 MB with at most 50 MB growth and unchanged source bytes', async function () {
    this.timeout(600000);
    const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
    const api = await extension.activate();
    const parent = join(extension.extensionPath, 'out'); await mkdir(parent, { recursive: true });
    const capacity = await statfs(parent, { bigint: true });
    assert.ok(capacity.bavail * capacity.bsize >= 9_000_000_000n, 'T-016 requires at least 9 GB free for real populated disposable SQLite fixtures.');
    const directory = await mkdtemp(join(parent, 't016-memory-'));
    const data = join(directory, 'data');
    const budget = new TestBudget(540000); // One minute for teardown before Mocha's unchanged 600 s deadline.
    const started = performance.now();
    const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = '0';
    const evidence: { name: string; bytes: number; rows: number; report: MemoryReport; sha256: string }[] = [];
    try {
      const generation = await promisify(execFile)(process.execPath, [join(extension.extensionPath, 'scripts/sqlite-memory-fixture.mts'), data],
        { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: budget.remaining(300000), signal: budget.signal });
      assert.equal(generation.stderr, '');
      console.log(`T-016 fixture evidence: ${generation.stdout.trim().replaceAll('\n', ' ')}`);
      const generated: unknown = JSON.parse(await readFile(join(data, 'generation.json'), 'utf8'));
      assert.ok(typeof generated === 'object' && generated !== null && 'rows' in generated && generated.rows === 10000000);
      for (const [name, minimum] of [['one-gb.sqlite', 1_000_000_000], ['five-gb.sqlite', 5_000_000_000]] as const) {
        budget.remaining(15000);
        const path = join(data, name); const bytes = (await stat(path)).size;
        assert.ok(bytes >= minimum, `${name} must contain at least ${String(minimum)} real database bytes.`);
        const hashStarted = performance.now();
        const before = await sourceDigest(path, budget.signal);
        console.log(`T-016 pre-open hash: ${JSON.stringify({ name, milliseconds: performance.now() - hashStarted, elapsedMs: performance.now() - started })}`);
        const monitor = observe(extension.extensionPath, budget.signal);
        try {
          await monitor.next(); // Establish actual host/renderer coverage before opening.
          const uri = vscode.Uri.file(path);
          await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
          const document = api.sqliteEditor.getDocument(uri); assert.ok(document);
          await waitBrowser(document, (status) => painted(status) && status.editorReady === true, 0, budget.remaining(15000));
          const opened = document.session.state.opened; assert.ok(opened);
          assert.equal(opened.engine, 'node:sqlite'); assert.equal(opened.memoryLimited, false);
          assert.equal(opened.bytes, String(bytes));
          const helper = opened.processId;
          await monitor.next(helper);
          const settledAt = monitor.samples.at(-1)?.at ?? 0;
          // Capture three settled observations before repeated paging. Opening
          // still contributes to the absolute peak, not to paging growth.
          for (let checkpoint = 0; checkpoint < 3; checkpoint++) { await monitor.next(helper); }
          assert.equal(document.browserStatus?.table, 'record_names');
          assert.equal(document.browserStatus.firstRow[0]?.text, '9007199254740993');
          await browserAction(document, 'select', (status) => painted(status) && status.table === 'records', 'records');
          await monitor.next(helper);
          // Sixty actual UI pages; each contains 100 rows, and only one page is cached.
          for (let page = 1; page <= 60; page++) {
            budget.remaining(15000);
            const shown = await browserAction(document, 'next', (status) => painted(status) && status.offset === page * 100);
            assert.equal(shown.cachedRows, 100); assert.ok(shown.renderedRows < 100);
            assert.equal(shown.firstRow[0]?.text, String(9007199254740993n + BigInt(page * 100)));
            if (page % 10 === 0) { await monitor.next(helper); }
          }
          // Force a real complete table scan, not an index-only count or LIMIT shortcut.
          const counted = await runSql(document, 'SELECT count(*) AS n, sum(length(payload)) AS bytes FROM records', budget.remaining(120000));
          assert.equal(counted.firstRow[0]?.text, '10000000');
          assert.equal(counted.firstRow[1]?.text, name === 'one-gb.sqlite' ? '1000000000' : '5120000000');
          await monitor.next(helper);
          const query = await runSql(document, 'SELECT id, name, payload FROM records');
          assert.equal(query.cachedRows, 100); assert.equal(query.firstRow[0]?.text, '9007199254740993');
          for (let page = 1; page <= 20; page++) {
            budget.remaining(15000);
            const shown = await browserAction(document, 'next', (status) => painted(status) && status.query === true && status.offset === page * 100);
            assert.equal(shown.cachedRows, 100);
            assert.equal(shown.firstRow[0]?.text, String(9007199254740993n + BigInt(page * 100)));
            if (page % 5 === 0) { await monitor.next(helper); }
          }
          await monitor.next(helper);
          await monitor.stop();
          const report = checkMemoryRun(monitor.samples, helper, settledAt);
          await closeEditor(document); assert.throws(() => process.kill(helper, 0));
          assert.deepEqual(await sourceDigest(path, budget.signal), before);
          evidence.push({ name, bytes, rows: 10000000, report, sha256: before.sha256 });
          console.log(`T-016 memory evidence: ${JSON.stringify(evidence.at(-1))}`);
        } finally {
          await monitor.stop();
          await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        }
      }
      const smaller = evidence[0]; const larger = evidence[1]; assert.ok(smaller); assert.ok(larger);
      checkMemoryComparison(smaller.report, larger.report);
      console.log(`T-016 memory comparison: ${JSON.stringify({ vscode: vscode.version, node: process.versions.node, platform: process.platform, arch: process.arch,
        fileGrowthBytes: larger.bytes - smaller.bytes, memoryGrowthBytes: larger.report.peakBytes - smaller.report.peakBytes, elapsedMs: performance.now() - started,
        scope: 'sampled resident host plus database helpers including workers; renderer separate; warm generated input; source hashes outside memory window' })}`);
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      budget.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
