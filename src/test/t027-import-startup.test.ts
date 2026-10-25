import * as assert from 'node:assert/strict';
import { channel } from 'node:diagnostics_channel';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import * as vscode from 'vscode';
import type { CsvImportSession } from '../editor/csv-import';
import { IMPORT_HOST_CHANNEL, isImportHostSpan } from '../import-host-diagnostics';
import { startHostIntervalDiagnostics } from './host-interval-diagnostics';
import { captureHostRuntime } from './host-runtime-diagnostics';

suite('T-027 import-start investigation', () => {
  suiteSetup(async function () {
    this.timeout(20000);
    if (process.env['LITE_VOYAGER_INTERVAL_DIAGNOSTICS'] !== '1') { return; }
    const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension);
    const profile = process.env['LITE_VOYAGER_TEST_PROFILE']; assert.ok(profile);
    const result = await captureHostRuntime(extension.extensionPath, profile, process.pid);
    process.stdout.write(`T-027 isolated host process snapshot: ${JSON.stringify(result)}\n`);
  });

  test('NFR-005: Given a real JSONL import with named diagnostics, When startup completes, Then fixed host stages and the original timer interval are observed while exact source bytes survive', async function () {
    this.timeout(45000);
    const directory = await mkdtemp(join(tmpdir(), 'lv-t027-startup-')); const path = join(directory, 'source.jsonl');
    const source = Array.from({ length: 250 }, (_, index) => `{"id":${String(9007199254740993n + BigInt(index))}}`).join('\n');
    const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = '0';
    let session: CsvImportSession | undefined; const stages = new Set<string>(); const sink = channel(IMPORT_HOST_CHANNEL);
    const record = (value: unknown): void => { if (isImportHostSpan(value)) { stages.add(value.stage); } };
    try {
      await writeFile(path, source); session = await vscode.commands.executeCommand<CsvImportSession>('lite-voyager.jsonImport', vscode.Uri.file(path));
      assert.ok(session); await session.finished; assert.equal(session.state.phase, 'ready');
      const current = session; const phase = (): string => `${current.state.phase}/${current.state.progress?.phase ?? 'none'}`;
      const trace = startHostIntervalDiagnostics(true); sink.subscribe(record);
      let last = performance.now(); let previousPhase = phase(); let maximum = 0; let ticks = 0;
      const timer = setInterval(() => { const now = performance.now(); const nextPhase = phase();
        trace?.sample(last, now, previousPhase, nextPhase); maximum = Math.max(maximum, now - last); last = now; previousPhase = nextPhase; ticks++;
      }, 10);
      try { await session.startImport(); }
      finally {
        clearInterval(timer); sink.unsubscribe(record);
        console.log(`T-027 startup probe: ${JSON.stringify({ rows: 250, ticks, maximum, stages: [...stages], evidence: trace?.stop(),
          scope: 'one small real JSONL import; named host boundaries and raw timer; not a reproduction or repair claim for failed 1-GB CI' })}`);
      }
      assert.equal(session.state.phase, 'opened', session.state.message); assert.equal(session.state.progress?.rows, '250');
      for (const stage of ['webview-state', 'lifecycle-output', 'storage-initialize', 'source-snapshot', 'space-check', 'storage-create', 'import-work-directory', 'import-helper-fork', 'import-helper-register', 'import-helper-send']) { assert.ok(stages.has(stage), `Missing named stage ${stage}`); }
      assert.ok(ticks > 0); assert.ok(maximum <= 100, `JSONL startup timer gap ${String(maximum)}ms`);
      assert.equal(await readFile(path, 'utf8'), source);
    } finally {
      sink.unsubscribe(record); session?.panel.dispose(); await session?.closed;
      if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      await rm(directory, { recursive: true, force: true });
    }
  });
});
