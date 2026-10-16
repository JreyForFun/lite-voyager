import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, open, rm, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { CsvImportSession } from '../editor/csv-import';
import { observeCsvImport } from './csv-import-memory-observer';
import { sourceDigest } from './sqlite-exercise';
import { TestBudget } from './sqlite-budget';
import { csvFixtureCheckSql } from './csv-import-data-check';
import { populatedJsonBrowseReady } from './json-import-readiness';

suite('T-023 populated JSON memory', () => {
  test('FR-005: Given ten million JSON/JSONL objects, When streaming and querying the entire imported table, Then exact row counts, values and source hashes survive', async function () {
    this.timeout(900000); const budget = new TestBudget(840000);
    const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension); await extension.activate();
    const directory = await mkdtemp(join(extension.extensionPath, 'out/t023-volume-'));
    const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = '0';
    try {
      for (const format of ['json', 'jsonl']) {
        const path = join(directory, `source.${format}`); const file = await open(path, 'wx');
        const write = async (text: string): Promise<void> => {
          const buffer = Buffer.from(text); let offset = 0;
          while (offset < buffer.length) { budget.signal.throwIfAborted(); const result = await file.write(buffer, offset, buffer.length - offset, null); assert.ok(result.bytesWritten > 0); offset += result.bytesWritten; }
        };
        try {
          if (format === 'json') { await write('['); }
          for (let remaining = 10_000_000; remaining > 0;) {
            const count = Math.min(8192, remaining); let text = ('{"a":1}' + (format === 'json' ? ',' : '\n')).repeat(count); remaining -= count;
            if (format === 'json' && remaining === 0) { text = text.slice(0, -1) + ']'; } await write(text);
          }
        } finally { await file.close(); }
        const before = await sourceDigest(path, budget.signal); assert.equal(before.bytes, format === 'json' ? 80_000_001 : 80_000_000);
        let session: CsvImportSession | undefined; const cancel = (): void => { session?.panel.dispose(); }; budget.signal.addEventListener('abort', cancel, { once: true });
        try {
          session = await vscode.commands.executeCommand<CsvImportSession>('lite-voyager.jsonImport', vscode.Uri.file(path)); assert.ok(session); await session.finished; assert.equal(session.state.phase, 'ready');
          await session.startImport(); assert.equal(session.state.phase, 'opened'); assert.equal(session.state.progress?.rows, '10000000');
          const current = session;
          const wait = (predicate: () => boolean): Promise<void> => {
            if (predicate()) { return Promise.resolve(); }
            return new Promise((accept, reject) => {
              const timer = setTimeout(() => { remove(); reject(new Error(`T-023 ten-million-row SQL deadline: ${JSON.stringify({ phase: current.state.phase,
                busy: current.browserStatus?.busy, query: current.browserStatus?.query, cachedRows: current.browserStatus?.cachedRows,
                renderedRows: current.browserStatus?.renderedRows, sqlLength: current.browserStatus?.sqlLength, message: current.browserStatus?.message })}`)); }, budget.remaining(120000));
              const remove = current.onStatus(() => { if (predicate()) { clearTimeout(timer); remove(); accept(); } });
            });
          };
          await wait(() => populatedJsonBrowseReady(current.browserStatus));
          const sql = 'SELECT count(*),sum(a),min(a),max(a) FROM records';
          await Promise.all([wait(() => current.browserStatus?.sqlLength === sql.length && populatedJsonBrowseReady(current.browserStatus)), current.panel.webview.postMessage({ type: 'browserExercise', action: 'sql', value: sql })]);
          await Promise.all([wait(() => current.browserStatus?.query === true && !current.browserStatus.busy && current.browserStatus.firstRow[0]?.text === '10000000'), current.panel.webview.postMessage({ type: 'browserExercise', action: 'run' })]);
          assert.deepEqual(current.browserStatus?.firstRow.map((cell) => cell.text), ['10000000', '10000000', '1', '1']);
          assert.deepEqual(await sourceDigest(path, budget.signal), before); process.stdout.write(`T-023 ${format}: ten million rows, full-data aggregate and ${before.sha256} source hash PASS.\n`);
        } finally { budget.signal.removeEventListener('abort', cancel); session?.panel.dispose(); await session?.closed; await rm(path, { force: true }); }
      }
    } finally { budget.dispose(); if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; } await rm(directory, { recursive: true, force: true }); }
  });
  test('NFR-003: Given populated 1/5-GB JSON and JSONL, When streaming native imports, Then actual helper/host residency stays bounded, sources match hashes and host timers stay responsive', async function () {
    this.timeout(1800000);
    const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension); await extension.activate();
    const root = join(extension.extensionPath, 'out'); await mkdir(root, { recursive: true });
    const space = await statfs(root, { bigint: true }); assert.ok(space.bavail * space.bsize >= 13_000_000_000n, 'T-023 populated memory checks require 13 GB working space.');
    const directory = await mkdtemp(join(root, 't023-memory-')); const budget = new TestBudget(1740000);
    const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = '0';
    try {
      for (const format of ['json', 'jsonl']) {
        let smallerPeak = 0;
        for (const minimum of [1_000_000_000, 5_000_000_000]) {
          const path = join(directory, `source.${format}`);
          const generated: { stdout: string; stderr: string } = await promisify(execFile)(process.execPath, [join(extension.extensionPath, 'scripts/json-memory-fixture.mts'), path, String(minimum), format],
            { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, signal: budget.signal, timeout: budget.remaining(180000) });
          assert.equal(generated.stderr, ''); const recipe: unknown = JSON.parse(generated.stdout);
          assert.ok(typeof recipe === 'object' && recipe !== null && 'rows' in recipe && typeof recipe.rows === 'number' && 'sha256' in recipe && typeof recipe.sha256 === 'string');
          const before = await sourceDigest(path, budget.signal); assert.equal(before.sha256, recipe.sha256); assert.ok(before.bytes >= minimum);
          const monitor = observeCsvImport(extension.extensionPath, budget.signal); let session: CsvImportSession | undefined;
          const cancel = (): void => { session?.panel.dispose(); }; budget.signal.addEventListener('abort', cancel, { once: true });
          try {
            await monitor.next(); session = await vscode.commands.executeCommand<CsvImportSession>('lite-voyager.jsonImport', vscode.Uri.file(path)); assert.ok(session); await session.finished;
            assert.equal(session.state.phase, 'ready'); session.configureImportSpace(() => Promise.resolve(true));
            let helper = 0; let ticks = 0; let last = performance.now(); let hostGap = 0;
            const current = session; const remove = session.onStatus(() => { helper = current.state.progress?.processId ?? helper; });
            const timer = setInterval(() => { const now = performance.now(); hostGap = Math.max(hostGap, now - last); last = now; ticks++; }, 10);
            try { await session.startImport(); } finally { clearInterval(timer); remove(); }
            assert.equal(session.state.phase, 'opened'); assert.equal(session.state.progress?.engine, 'node:sqlite'); assert.equal(session.state.progress.rows, String(recipe.rows));
            assert.equal(session.state.progress.bytes, String(before.bytes)); assert.ok(ticks > 5); assert.ok(hostGap <= 100, `JSON host timer gap ${String(hostGap)}ms`);
            const wait = (predicate: () => boolean): Promise<void> => {
              if (predicate()) { return Promise.resolve(); }
              return new Promise((accept, reject) => {
                const timer = setTimeout(() => { unsubscribe(); reject(new Error(`JSON full-data SQL deadline: ${JSON.stringify({ phase: current.state.phase,
                  busy: current.browserStatus?.busy, query: current.browserStatus?.query, cachedRows: current.browserStatus?.cachedRows,
                  renderedRows: current.browserStatus?.renderedRows, sqlLength: current.browserStatus?.sqlLength, message: current.browserStatus?.message })}`)); }, budget.remaining(120000));
                const unsubscribe = current.onStatus(() => { if (predicate()) { clearTimeout(timer); unsubscribe(); accept(); } });
              });
            };
            await wait(() => populatedJsonBrowseReady(current.browserStatus));
            // Check every complete value, including endpoints/length/NULL/type, in SQLite.
            const sql = csvFixtureCheckSql();
            await Promise.all([wait(() => current.browserStatus?.sqlLength === sql.length && populatedJsonBrowseReady(current.browserStatus)), current.panel.webview.postMessage({ type: 'browserExercise', action: 'sql', value: sql })]);
            await Promise.all([wait(() => current.browserStatus?.query === true && !current.browserStatus.busy && current.browserStatus.firstRow[0]?.text === String(recipe.rows)), current.panel.webview.postMessage({ type: 'browserExercise', action: 'run' })]);
            assert.deepEqual(current.browserStatus?.firstRow.map((cell) => cell.text), [String(recipe.rows), '0']);
            await monitor.stop(); const samples = monitor.samples; const imported = samples.filter((sample) => sample.helperIds.includes(helper));
            assert.ok(imported.length >= 5, 'At least five actual import-helper samples required.');
            const peak = Math.max(...samples.map((sample) => sample.hostBytes + sample.helperBytes)); assert.ok(peak < 500_000_000, `JSON combined peak ${String(peak)}`);
            let maxGap = 0; for (let index = 1; index < samples.length; index++) { const gap = (samples[index]?.at ?? 0) - (samples[index - 1]?.at ?? 0); assert.ok(gap > 0); maxGap = Math.max(maxGap, gap); }
            assert.ok(maxGap <= 3000); if (smallerPeak !== 0) { assert.ok(peak - smallerPeak <= 50_000_000, 'JSON file-size peak growth must stay at most 50 MB.'); } else { smallerPeak = peak; }
            assert.deepEqual(await sourceDigest(path, budget.signal), before);
            process.stdout.write(`T-023 memory evidence: ${JSON.stringify({ format, bytes: before.bytes, rows: recipe.rows, sha256: before.sha256, peakBytes: peak,
              hostTimerMaxGapMs: hostGap, samples: samples.length, importHelperSamples: imported.length, maxObservationGapMs: maxGap,
              rendererPeakBytes: Math.max(...samples.map((sample) => sample.rendererBytes)), scope: 'populated 4095-character TEXT records; full native import/data check; sampled host + all helpers; renderer separately; no physical paint or repeated-paging claim' })}\n`);
          } finally { budget.signal.removeEventListener('abort', cancel); session?.panel.dispose(); await session?.closed; await monitor.stop(); await rm(path, { force: true }); }
        }
      }
    } finally { budget.dispose(); if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; } await rm(directory, { recursive: true, force: true }); }
  });
});
