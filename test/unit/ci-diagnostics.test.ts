import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { HostExitLines, runDiagnosticCommand, startWindowsIdentityCollector, type ShutdownSignal } from '../../scripts/ci-diagnostics.mts';

test('NFR-005: Given the ordinary native Node tooling loader, When importing the diagnostic module without enabling it, Then strip-only execution succeeds with no diagnostic output', async () => {
  const output: Buffer[] = [];
  const url = pathToFileURL(resolve('scripts/ci-diagnostics.mts')).href;
  const result = await runDiagnosticCommand(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)});`],
    undefined, (chunk) => { output.push(Buffer.from(chunk)); });
  expect(Buffer.concat(output).toString()).toBe(''); expect(result.code).toBe(0);
});

test('NFR-005: Given split formatted host lifecycle records, When diagnostics read the console, Then only valid original host PID events are emitted', () => {
  const lines = new HostExitLines();
  expect(lines.feed('Started local extension ho')).toEqual([]);
  expect(lines.feed('st with pid 636.\nother pid 17\n')).toEqual([{ phase: 'started', pid: 636 }]);
  expect(lines.feed('\u001b[32m[main timestamp] Extension host with pid 636 exited with code: ')).toEqual([]);
  expect(lines.feed('0, signal: unknown.\u001b[0m\n')).toEqual([{ phase: 'exited', pid: 636 }]);
  expect(lines.feed('Started local extension host with pid 0.\nStarted local extension host with pid 9007199254740993.\n')).toEqual([]);
});

test('NFR-005: Given an oversized console record, When diagnostic parsing reaches its bound, Then truncation is visible and following lifecycle records are still parsed', () => {
  const lines = new HostExitLines(64);
  expect(lines.feed('x'.repeat(1000))).toEqual([]);
  expect(lines.feed('\nStarted local extension host with pid 12.\n')).toEqual([{ phase: 'started', pid: 12 }]);
  expect(lines.droppedLines).toBe(1);
});

test('NFR-005: Given a Unicode console record crossing an odd remaining bound, When parsing diagnostics, Then surrogate pairs cannot bypass the buffer cap', () => {
  const lines = new HostExitLines(64);
  lines.feed('x' + '🙂'.repeat(1000)); expect(lines.droppedLines).toBe(1);
  expect(lines.feed('\nStarted local extension host with pid 12.\n')).toEqual([{ phase: 'started', pid: 12 }]);
});

test('NFR-005: Given a failing verification child, When the diagnostic wrapper forwards streams and closes its collector, Then the original failure and exact output remain intact', async () => {
  const output: { chunk: Buffer; stream: string }[] = []; const signals: ShutdownSignal[] = []; let closed = false;
  const result = await runDiagnosticCommand(process.execPath, ['-e', "process.stdout.write('Started local extension host with pid 636.\\n🙂'); process.stderr.write('retained stderr'); process.exitCode=7;"],
    { accept: (value) => { signals.push(value); }, finish: () => { closed = true; return Promise.resolve(); } }, (chunk, stream) => { output.push({ chunk: Buffer.from(chunk), stream }); });
  expect(result.code).toBe(7); expect(result.signal).toBeNull(); expect(closed).toBe(true);
  expect(Buffer.concat(output.filter((item) => item.stream === 'stdout').map((item) => item.chunk)).toString()).toBe('Started local extension host with pid 636.\n🙂');
  expect(Buffer.concat(output.filter((item) => item.stream === 'stderr').map((item) => item.chunk)).toString()).toBe('retained stderr');
  expect(signals).toEqual([{ phase: 'started', pid: 636 }]);
});

test('NFR-005: Given a successful child but failed evidence collection, When the diagnostic wrapper completes, Then it fails instead of reporting a clean result', async () => {
  const result = await runDiagnosticCommand(process.execPath, ['-e', 'process.exitCode=0;'],
    { accept: () => {}, finish: () => Promise.reject(new Error('collector unavailable')) }, () => {});
  expect(result.code).toBe(1); expect(result.collectorFailure).toContain('collector unavailable');
});

test('NFR-005: Given both a failed verification and failed collector, When the wrapper completes, Then the original verification exit code is retained', async () => {
  const result = await runDiagnosticCommand(process.execPath, ['-e', 'process.exitCode=9;'],
    { accept: () => {}, finish: () => Promise.reject(new Error('collector unavailable')) }, () => {});
  expect(result.code).toBe(9); expect(result.collectorFailure).toContain('collector unavailable');
});

test('NFR-005: Given a diagnostic child, When its environment is initialized, Then collection is enabled and the recursion barrier prevents a second wrapper', async () => {
  const output: Buffer[] = [];
  const result = await runDiagnosticCommand(process.execPath, ['-e', "console.log(JSON.stringify([process.env.LITE_VOYAGER_INTERVAL_DIAGNOSTICS,process.env.LITE_VOYAGER_DIAGNOSTIC_CHILD]));"],
    undefined, (chunk) => { output.push(Buffer.from(chunk)); });
  expect(result.code).toBe(0); expect(JSON.parse(Buffer.concat(output).toString()) as unknown).toEqual(['1', '1']);
});

test.skipIf(process.platform !== 'win32')('NFR-005: Given an owned Windows child and its original creation identity, When it exits, Then the native collector reports identity and absence without retaining a handle or killing it', async () => {
  const provider = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', resolve('test/unit/fixtures/windows-identity-provider.ps1'), '-CollectorPath', resolve('scripts/windows-exit-diagnostics.ps1')],
  { windowsHide: true, timeout: 15000, maxBuffer: 65536 });
  expect(provider.stderr).toBe(''); expect(provider.stdout.trim()).toBe('T030 provider edge checks passed');
  const output: string[] = []; let sawStart: () => void = () => {};
  const started = new Promise<void>((accept) => { sawStart = accept; });
  const collector = await startWindowsIdentityCollector((text) => { output.push(text); if (text.includes('"phase":"started"')) { sawStart(); } });
  const child = spawn(process.execPath, ['-e', "console.log(process.pid);process.stdin.once('data',()=>process.exit(0));"], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout }); const exited = once(child, 'close');
  try {
    const pidText: unknown = (await once(lines, 'line'))[0]; expect(typeof pidText).toBe('string');
    const pid = Number(pidText); collector.accept({ phase: 'started', pid }); await started;
    child.stdin.end('\n'); expect((await exited)[0]).toBe(0); collector.accept({ phase: 'exited', pid });
    await collector.finish();
    const object = (value: unknown): Record<string, unknown> => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) { throw new Error('NFR-005: invalid identity metadata'); }
      return value as Record<string, unknown>;
    };
    const records = output.map((line) => object(JSON.parse(line.slice('T026 shutdown identity evidence: '.length)) as unknown));
    const startRecord = records.find((record) => record['phase'] === 'started');
    if (startRecord === undefined) { throw new Error('NFR-005: missing original identity'); }
    const creation = object(startRecord['identity'])['creation'];
    if (typeof creation !== 'string') { throw new Error('NFR-005: missing creation timestamp'); }
    expect(Number.isFinite(Date.parse(creation))).toBe(true);
    expect(startRecord['originalCreation']).toBe(creation);
    const exitRecords = records.filter((record) => record['phase'] === 'exited');
    expect(exitRecords).toHaveLength(20);
    for (const record of exitRecords) {
      expect(record).toMatchObject({ phase: 'exited', pid });
      expect(record['originalCreation']).toBe(creation);
      for (const field of ['queryStartedUtc', 'queryFinishedUtc']) {
        const timestamp = record[field];
        if (typeof timestamp !== 'string') { throw new Error('NFR-005: missing query timestamp'); }
        expect(Number.isFinite(Date.parse(timestamp))).toBe(true);
      }
    }
    expect(output.join('')).toContain('"phase":"exited"');
    expect(output.join('')).toContain('"present":false');
    expect(output.join('')).toContain('"creation"');
  } finally { lines.close(); child.stdin.end(); if (child.exitCode === null) { child.kill(); } await exited; await collector.finish(); }
}, 30000);
