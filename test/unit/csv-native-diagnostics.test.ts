import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test, vi } from 'vitest';
import { createCsvNativeDiagnostics, instrumentCsvNativeScript, parseCsvNativeCheckpoint, reportCsvNativeFailure } from '../../src/test/csv-native-diagnostics';
import { windowsCsvMemoryScript } from '../../src/test/csv-memory-windows';
import { observeProcessLines } from '../../src/test/sqlite-memory-observer';

test.each([['linux', '1'], ['darwin', '1'], ['win32', undefined], ['win32', '0'], ['win32', 'true']] as const)(
  'NFR-005: Given platform %s and diagnostic flag %s, When disabled or non-Windows, Then no checkpoint directory is created', async (platform, flag) => {
    expect(await createCsvNativeDiagnostics('this-parent-must-not-exist', platform, flag)).toBeUndefined();
  });

test('NFR-005: Given enabled Windows diagnostics, When created and read before native bootstrap, Then context is explicitly empty and unique without touching another checkpoint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lv-csv-trace-'));
  try {
    const first = await createCsvNativeDiagnostics(root, 'win32', '1');
    const second = await createCsvNativeDiagnostics(root, 'win32', '1');
    expect(first).toBeDefined(); expect(second).toBeDefined(); expect(first?.path).not.toBe(second?.path);
    expect(await first?.read()).toEqual({ sequence: 0, dropped: 0, active: [], records: [], incompleteSlots: 0 });
    expect((await readdir(root)).length).toBe(2);
    if (first !== undefined) {
      expect(first.slots).toHaveLength(2);
      for (const path of first.slots) { await writeFile(path, 'x'.repeat(16385)); }
      await expect(first.read()).rejects.toThrow('unavailable or invalid');
      for (const path of first.slots) { await writeFile(path, '{}'); }
      await expect(first.read()).rejects.toThrow('unavailable or invalid');
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

const checkpoint = { version: 1, sequence: 2, dropped: 0, active: [{ stage: 'counters', pid: 0 }, { stage: 'metadata', pid: 31 }],
  records: [{ sequence: 1, stage: 'counters', phase: 'begin', pid: 0, atMs: 1 }, { sequence: 2, stage: 'metadata', phase: 'begin', pid: 31, atMs: 10 }] };
test('NFR-005: Given alternating native slots and an interrupted write, When reading, Then only the latest valid history is selected and missing evidence is explicit without file replacement or retry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lv-csv-slots-'));
  try {
    const diagnostics = await createCsvNativeDiagnostics(root, 'win32', '1');
    if (diagnostics === undefined) { throw new Error('Expected diagnostics'); }
    const [even, odd] = diagnostics.slots;
    await writeFile(even, JSON.stringify(checkpoint)); await writeFile(odd, '{"version":');
    expect(await diagnostics.read()).toMatchObject({ sequence: 2, active: checkpoint.active, incompleteSlots: 1 });
    let message = ''; await reportCsvNativeFailure('original error', diagnostics, (chunk) => { message += chunk; });
    expect(message).toContain('"incompleteSlots":1'); expect(message.startsWith('original error\n')).toBe(true);
    const earlier = { ...checkpoint, sequence: 1, active: [checkpoint.active[0]], records: [checkpoint.records[0]] };
    await writeFile(odd, JSON.stringify(earlier));
    expect(await diagnostics.read()).toMatchObject({ sequence: 2, incompleteSlots: 0 });
    await writeFile(odd, JSON.stringify(checkpoint)); await expect(diagnostics.read()).rejects.toThrow('inconsistent');
    await writeFile(odd, JSON.stringify(earlier));
    await rm(even); expect(await diagnostics.read()).toMatchObject({ sequence: 1, incompleteSlots: 1 });
    await writeFile(even, JSON.stringify({ ...checkpoint, sequence: 4, active: [], records: [...checkpoint.records,
      { sequence: 3, stage: 'metadata', phase: 'end', pid: 31, atMs: 11 }, { sequence: 4, stage: 'counters', phase: 'end', pid: 0, atMs: 12 }] }));
    await expect(diagnostics.read()).rejects.toThrow('inconsistent');
    const native = instrumentCsvNativeScript(windowsCsvMemoryScript('Code'), diagnostics.path);
    expect(native).not.toContain('[IO.File]::Replace'); expect(native).not.toContain('.tmp');
    expect(native).toContain('$script:taskTraceSequence % 2');
    expect(() => parseCsvNativeCheckpoint('x'.repeat(16385))).toThrow('16384');
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('NFR-005: Given checkpoint metadata with private fields, When parsing, Then only bounded fixed labels and numeric evidence survive', () => {
  expect(parseCsvNativeCheckpoint(JSON.stringify({ ...checkpoint, command: 'private', records: checkpoint.records.map((record) => ({ ...record, source: 'private' })) })))
    .toEqual({ sequence: 2, dropped: 0, active: checkpoint.active, records: checkpoint.records });
});
test.each([
  {}, { ...checkpoint, sequence: -1 }, { ...checkpoint, dropped: 1 }, { ...checkpoint, active: Array(3).fill(checkpoint.active[0]) },
  { ...checkpoint, records: Array(17).fill(checkpoint.records[0]) },
  { ...checkpoint, records: [{ ...checkpoint.records[0], stage: 'user text' }] },
  { ...checkpoint, records: [{ ...checkpoint.records[0], phase: 'warning' }] },
  { ...checkpoint, records: [{ ...checkpoint.records[0], pid: 1.5 }] },
  { ...checkpoint, records: [{ ...checkpoint.records[0], atMs: -1 }] },
  { ...checkpoint, records: [{ ...checkpoint.records[0], sequence: 3 }] },
])('NFR-005: Given malformed native evidence %#, When decoding, Then it cannot masquerade as complete context', (value) => {
  expect(() => parseCsvNativeCheckpoint(JSON.stringify(value))).toThrow('Invalid');
});

test('NFR-005: Given unexpected native script structure, When instrumenting, Then collection fails explicitly instead of silently omitting stages', () => {
  expect(() => instrumentCsvNativeScript('unexpected source', 'checkpoint.json')).toThrow('native script');
});
test.each([
  { version: 1, sequence: 1, dropped: 0, records: [{ sequence: 1, stage: 'warm-cim', phase: 'end', pid: 0, atMs: 1 }], active: [{ stage: 'metadata', pid: 31 }] },
  { ...checkpoint, active: [] },
  { version: 1, sequence: 0, dropped: 0, records: [], active: checkpoint.active },
  { ...checkpoint, sequence: 3, dropped: 1, records: checkpoint.records.map((record) => ({ ...record, sequence: record.sequence + 1 })) },
])('NFR-005: Given contradictory active/history evidence %#, When decoding, Then native context is rejected as unknown', (value) => {
  expect(() => parseCsvNativeCheckpoint(JSON.stringify(value))).toThrow('Invalid');
});

test('NFR-005: Given an original watchdog failure, When reporting valid native context, Then the original message leads and context cannot turn it into success', async () => {
  const original = 'OS observer snapshot exceeded 3000 ms; stage=waiting for next snapshot; snapshots=42.';
  const context = parseCsvNativeCheckpoint(JSON.stringify(checkpoint));
  let message = ''; await reportCsvNativeFailure(original, { read: () => Promise.resolve(context) }, (chunk) => { message += chunk; });
  expect(message.startsWith(`${original}\nCSV native observer context: `)).toBe(true);
  expect(message).toContain('"stage":"metadata"'); expect(message).toContain('no cause attribution');
  let plain = ''; await reportCsvNativeFailure(original, undefined, (chunk) => { plain += chunk; }); expect(plain).toBe(`${original}\n`);
});
test('NFR-005: Given unavailable native context, When reporting a watchdog failure, Then the original error survives and missing evidence is explicit without leaking reader diagnostics', async () => {
  let message = ''; await reportCsvNativeFailure('original watchdog', { read: () => Promise.reject(new Error('private path')) }, (chunk) => { message += chunk; });
  expect(message).toBe('original watchdog\nCSV native observer context: unavailable; native stage unknown; original failure retained.\n');
});
test('NFR-005: Given a checkpoint reader that never resolves, When a watchdog fails, Then its original message is emitted immediately and supplemental reporting stops after one second', async () => {
  vi.useFakeTimers(); const writes: string[] = [];
  try {
    const task = reportCsvNativeFailure('original watchdog', { read: () => new Promise(() => {}) }, (chunk) => { writes.push(chunk); });
    expect(writes).toEqual(['original watchdog\n']);
    await vi.advanceTimersByTimeAsync(1000); await task;
    expect(writes).toEqual(['original watchdog\n', 'CSV native observer context: unavailable; native stage unknown; original failure retained.\n']);
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});

test.runIf(process.platform === 'win32')('NFR-005: Given disabled diagnostics and no compiled diagnostic module, When the real sampler CLI runs, Then its original native script, acknowledgment and deadlines survive without loading diagnostics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lv-csv-disabled-'));
  try {
    await mkdir(join(root, 'scripts')); const modules = join(root, 'out/integration/test'); await mkdir(modules, { recursive: true });
    await writeFile(join(root, 'scripts/csv-memory.mts'), await readFile(new URL('../../scripts/csv-memory.mts', import.meta.url), 'utf8'));
    await writeFile(join(modules, 'sqlite-memory-support.js'), 'exports.memorySample=()=>{};exports.parseProcessTable=()=>{};');
    await writeFile(join(modules, 'csv-memory-cache.js'), 'exports.ProcessMemoryCache=class {};exports.parseNativeCounters=()=>{};');
    const original = windowsCsvMemoryScript('fixture-host');
    await writeFile(join(modules, 'csv-memory-windows.js'), `exports.windowsCsvMemoryScript=()=>${JSON.stringify(original)};`);
    await writeFile(join(modules, 'sqlite-memory-observer.js'), `exports.observeProcessLines=async(command,args,onLine,signal,startup,snapshot,ack,retain)=>{
      process.stdout.write(JSON.stringify({command,native:Buffer.from(args.at(-1),'base64').toString('utf16le'),startup,snapshot,ack,retain}));};`);
    const resultTask = promisify(execFile)(process.execPath, [join(root, 'scripts/csv-memory.mts'), String(process.pid)],
      { windowsHide: true, timeout: 10000, env: { ...process.env, LITE_VOYAGER_INTERVAL_DIAGNOSTICS: '0' } });
    resultTask.child.stdin?.end(); const result = await resultTask;
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({ command: 'powershell.exe', native: original, startup: 20000, snapshot: 3000, ack: true, retain: false });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test.runIf(process.platform === 'win32')('NFR-005: Given real PowerShell and a late metadata failure, When more than sixteen native markers execute, Then the latest active stage survives with explicit drops and the original error/counters remain', async () => {
  const root = await mkdtemp(join(tmpdir(), "lv-csv-trace-'"));
  try {
    const success = await createCsvNativeDiagnostics(root, 'win32', '1');
    const failure = await createCsvNativeDiagnostics(root, 'win32', '1');
    expect(success).toBeDefined(); expect(failure).toBeDefined(); if (success === undefined || failure === undefined) { return; }
    const original = windowsCsvMemoryScript('Code');
    const prepare = (script: string): string => script.replace("[System.Diagnostics.Process]::GetProcessesByName('Code')", '$taskTestProcesses');
    const fake = `
function New-TaskTestProcess([int]$taskId) {
  $taskItem=[pscustomobject]@{Id=$taskId;StartTime=[datetime]::new(100,[DateTimeKind]::Utc);HasExited=$false;Handle=[intptr]1;WorkingSet64=100};
  $taskItem | Add-Member ScriptMethod Refresh {}; $taskItem | Add-Member ScriptMethod Dispose {}; return $taskItem
}
function Get-CimInstance { param($ClassName,$Filter,$Property)
  if ($Filter -eq ('ProcessId='+$PID)) { return [pscustomobject]@{ProcessId=$PID} }
  $taskNumber=[int]($Filter -replace '^ProcessId=','');
  if ($script:taskTestFail -and $taskNumber -eq 50) { throw 'original CIM diagnostic' }
  [pscustomobject]@{ProcessId=$taskNumber;ParentProcessId=2;CommandLine='Code helper'}
}
`;
    const code = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; ${fake}
$script:taskTestFail=$false; $taskTestProcesses=@(New-TaskTestProcess 31);
& { ${prepare(instrumentCsvNativeScript(original, success.path))} };
$script:taskTestFail=$true; $taskTestProcesses=@(31..50 | ForEach-Object { New-TaskTestProcess $_ });
try { & { ${prepare(instrumentCsvNativeScript(original, failure.path))} } } catch { [Console]::Out.WriteLine($_.Exception.Message) }
`;
    const resultTask = promisify(execFile)('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { windowsHide: true, timeout: 10000 });
    resultTask.child.stdin?.end(); const result = await resultTask;
    expect(result.stderr).toBe(''); const lines = result.stdout.trim().split(/\r?\n/u);
    expect(JSON.parse(lines[0] ?? '')).toEqual([{ pid: 31, stamp: '100', parent: 2, command: 'Code helper', rss: 100 }]);
    expect(lines[1]).toBe('original CIM diagnostic');
    const complete = await success.read(); expect(complete.active).toEqual([]); expect(complete.sequence).toBe(8);
    const latest = await failure.read(); expect(latest.sequence).toBe(44); expect(latest.dropped).toBe(28); expect(latest.records).toHaveLength(16);
    expect(latest.active).toEqual([{ stage: 'counters', pid: 0 }, { stage: 'metadata', pid: 50 }]);
    expect(latest.records.at(-1)).toMatchObject({ sequence: 44, stage: 'metadata', phase: 'begin', pid: 50 });
    expect(latest.incompleteSlots).toBe(0);
    expect(await readdir(join(failure.path, '..'))).toHaveLength(2);
    const histories = await Promise.all(failure.slots.map(async (slot) => {
      const text = await readFile(slot, 'utf8'); expect(Buffer.byteLength(text)).toBeLessThanOrEqual(16384);
      return parseCsvNativeCheckpoint(text).sequence;
    }));
    expect(histories.sort((a, b) => a - b)).toEqual([43, 44]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test.runIf(process.platform === 'win32')('NFR-003: Given real encoded PowerShell stderr, When bounded diagnostic capture runs, Then its CLIXML body is retained and the original native error still fails', async () => {
  const code = "throw 'known native diagnostic body'";
  await expect(observeProcessLines('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')],
    () => {}, new AbortController().signal, 20000, 3000, true, true)).rejects.toThrow(/#< CLIXML[\s\S]*known native diagnostic body/);
});
