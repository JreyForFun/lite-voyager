import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { CsvImportSession } from '../editor/csv-import';
import { observeCsvImport } from './csv-import-memory-observer';
import { checkMemoryRun, checkMemoryComparison, type MemoryReport } from './sqlite-memory-support';
import { sourceDigest } from './sqlite-exercise';
import { TestBudget } from './sqlite-budget';
import { csvFixtureCheckSql } from './csv-import-data-check';

suite('T-021 production CSV memory', () => {
  test('NFR-003: Given the native CSV sampler and a real import, When sampling and stopping, Then actual import helpers and renderer residency are observed with strict snapshot deadlines', async function () {
    this.timeout(60000);
    const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension); await extension.activate();
    const directory = await mkdtemp(join(extension.extensionPath, 'out/t021-calibration-')); const path = join(directory, 'source.csv');
    const budget = new TestBudget(55000); const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = '0';
    let session: CsvImportSession | undefined; let monitor: ReturnType<typeof observeCsvImport> | undefined;
    const cancel = (): void => { session?.panel.dispose(); }; budget.signal.addEventListener('abort', cancel, { once: true });
    try {
      await writeFile(path, `a\n${'x\n'.repeat(1_000_000)}`);
      monitor = observeCsvImport(extension.extensionPath, budget.signal); await monitor.next();
      session = await vscode.commands.executeCommand<CsvImportSession>('lite-voyager.csvImport', vscode.Uri.file(path)); assert.ok(session); await session.finished;
      assert.equal(session.state.phase, 'ready'); await session.startImport(); assert.equal(session.state.phase, 'opened');
      const helper = session.state.progress?.processId; assert.ok(helper); await monitor.next(); await monitor.stop();
      const report = checkMemoryRun(monitor.samples, helper); assert.ok(report.rendererPeakBytes > 0);
      process.stdout.write(`T-021 CSV observer calibration: ${JSON.stringify(report)}; one-million-row input, fresh native counters and identity-checked metadata.\n`);
    } finally {
      budget.signal.removeEventListener('abort', cancel); session?.panel.dispose(); await session?.closed; await monitor?.stop(); budget.dispose();
      if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('NFR-003: Given populated 1 GB and 5 GB CSVs, When the real native import runs, Then sampled host/helper memory stays below 500 MB with bounded growth and exact source hashes', async function () {
    this.timeout(1200000);
    const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension); await extension.activate();
    const root = join(extension.extensionPath, 'out'); await mkdir(root, { recursive: true });
    const space = await statfs(root, { bigint: true });
    assert.ok(space.bavail * space.bsize >= 13_000_000_000n, 'T-021 memory requires 13 GB free for one populated 5 GB CSV and its SQLite staging (fixtures run sequentially).');
    const directory = await mkdtemp(join(root, 't021-memory-')); const budget = new TestBudget(1140000);
    const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = '0';
    const reports: MemoryReport[] = [];
    try {
      for (const minimum of [1_000_000_000, 5_000_000_000]) {
        const path = join(directory, `source-${String(minimum)}.csv`);
        const generated: { stdout: string; stderr: string } = await promisify(execFile)(process.execPath, [join(extension.extensionPath, 'scripts/csv-memory-fixture.mts'), path, String(minimum)],
          { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: budget.remaining(180000), signal: budget.signal });
        assert.equal(generated.stderr, ''); const recipe: unknown = JSON.parse(generated.stdout);
        assert.ok(typeof recipe === 'object' && recipe !== null && 'rows' in recipe && typeof recipe.rows === 'number' && 'sha256' in recipe && typeof recipe.sha256 === 'string');
        const before = await sourceDigest(path, budget.signal); assert.equal(before.sha256, recipe.sha256); assert.ok(before.bytes >= minimum);
        const monitor = observeCsvImport(extension.extensionPath, budget.signal); let session: CsvImportSession | undefined;
        const cancel = (): void => { session?.panel.dispose(); }; budget.signal.addEventListener('abort', cancel, { once: true });
        try {
          await monitor.next();
          session = await vscode.commands.executeCommand<CsvImportSession>('lite-voyager.csvImport', vscode.Uri.file(path)); assert.ok(session); await session.finished;
          assert.equal(session.state.phase, 'ready'); const current = session;
          if (session.firstRowsMs === undefined) {
            await new Promise<void>((accept, reject) => {
              const timer = setTimeout(() => { remove(); reject(new Error('T-021 memory preview DOM deadline.')); }, 15000);
              const remove = current.onStatus(() => { if (current.firstRowsMs !== undefined) { clearTimeout(timer); remove(); accept(); } });
            });
          }
          assert.ok(session.firstRowsMs !== undefined && session.firstRowsMs < 2000, `first-row DOM ${String(session.firstRowsMs)}ms`);
          let helper = 0; let ticks = 0; let maxGapMs = 0; let last = performance.now();
          const remove = session.onStatus(() => { helper = current.state.progress?.processId ?? helper; });
          const timer = setInterval(() => { const now = performance.now(); maxGapMs = Math.max(maxGapMs, now - last); last = now; ticks++; }, 10);
          const started = performance.now();
          try { await session.startImport(); } finally { clearInterval(timer); remove(); }
          assert.equal(session.state.phase, 'opened'); assert.equal(session.state.progress?.engine, 'node:sqlite');
          assert.equal(session.state.progress?.rows, String(recipe.rows)); assert.equal(session.state.progress.bytes, String(before.bytes));
          assert.ok(helper > 0); assert.ok(ticks > 5); assert.ok(maxGapMs <= 100, `extension-host import timer gap ${String(maxGapMs)}ms`);
          const waitBrowser = (predicate: () => boolean): Promise<void> => {
            if (predicate()) { return Promise.resolve(); }
            return new Promise((accept, reject) => {
              const timer = setTimeout(() => { unsubscribe(); reject(new Error(`T-021 full imported-data SQL deadline: ${JSON.stringify({ phase: current.state.phase,
                revision: current.browserStatus?.revision, busy: current.browserStatus?.busy, query: current.browserStatus?.query,
                message: current.browserStatus?.message, sqlLength: current.browserStatus?.sqlLength })}`)); }, budget.remaining(120000));
              const unsubscribe = current.onStatus(() => { if (predicate()) { clearTimeout(timer); unsubscribe(); accept(); } });
            });
          };
          await waitBrowser(() => current.browserStatus?.editorReady === true && !current.browserStatus.busy);
          const sql = csvFixtureCheckSql();
          await Promise.all([
            waitBrowser(() => current.browserStatus?.sqlLength === sql.length && !current.browserStatus.busy),
            current.panel.webview.postMessage({ type: 'browserExercise', action: 'sql', value: sql }).then((sent) => { assert.equal(sent, true); }),
          ]);
          await Promise.all([
            waitBrowser(() => current.browserStatus?.query === true && !current.browserStatus.busy && current.browserStatus.firstRow[0]?.text === String(recipe.rows)),
            current.panel.webview.postMessage({ type: 'browserExercise', action: 'run' }).then((sent) => { assert.equal(sent, true); }),
          ]);
          assert.deepEqual(current.browserStatus?.firstRow.map((cell) => cell.text), [String(recipe.rows), '0']);
          await monitor.next(); await monitor.stop();
          const report = checkMemoryRun(monitor.samples, helper); reports.push(report);
          const after = await sourceDigest(path, budget.signal); assert.deepEqual(after, before);
          assert.equal((await stat(path)).size, before.bytes);
          process.stdout.write(`T-021 memory evidence: ${JSON.stringify({ minimum, bytes: before.bytes, rows: recipe.rows, sha256: before.sha256,
            engine: 'node:sqlite', runtime: process.version, milliseconds: performance.now() - started, firstDomMs: session.firstRowsMs,
            ticks, hostTimerMaxGapMs: maxGapMs, ...report, scope: 'warm populated single-TEXT-column CSV; sampled extension host + import/database helpers including workers; renderer separately; not physical paint or unsampled peaks' })}\n`);
        } finally {
          budget.signal.removeEventListener('abort', cancel); session?.panel.dispose(); await session?.closed; await monitor.stop(); await rm(path, { force: true });
        }
      }
      assert.ok(reports[0] && reports[1]); checkMemoryComparison(reports[0], reports[1]);
    } finally {
      budget.dispose(); if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      await rm(directory, { recursive: true, force: true });
    }
  });
});
