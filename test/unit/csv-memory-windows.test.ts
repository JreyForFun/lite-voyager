import { execFile } from 'node:child_process';
import { mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, expect, test } from 'vitest';
import { windowsCsvSamplingFunctions } from '../../src/test/csv-memory-windows';

const fakeProcesses = `
$script:taskEvents=New-Object 'System.Collections.Generic.List[string]';
$script:taskExitAtRead=$false;
function New-TestProcess([int]$taskId,[long]$taskStamp) {
  $taskObject=[pscustomobject]@{Id=$taskId;StartTime=[datetime]::new($taskStamp,[DateTimeKind]::Utc);HasExited=$false;Bytes=100};
  $taskObject | Add-Member ScriptProperty Handle { $script:taskEvents.Add('handle'); return [intptr]1 };
  $taskObject | Add-Member ScriptProperty WorkingSet64 { $script:taskEvents.Add('rss'); if ($script:taskExitAtRead) {$this.HasExited=$true}; return $this.Bytes };
  $taskObject | Add-Member ScriptMethod Refresh { $script:taskEvents.Add('refresh') };
  $taskObject | Add-Member ScriptMethod Dispose { $script:taskEvents.Add('dispose') };
  return $taskObject
}
$taskCache=@{}; $taskProcess=New-TestProcess 31 100;
`;
const cases: { body: string }[] = [];
let results: unknown[] = [];
function scenario(name: string, body: string, expected: unknown): void {
  const index = cases.push({ body }) - 1;
  test.runIf(process.platform === 'win32')(name, () => { expect(results[index]).toEqual(expected); });
}

// Share cold PowerShell/module initialization, not scenario state. Each case
// recreates its fake processes/cache and retains the original native deadline.
beforeAll(async () => {
  if (process.platform !== 'win32') { return; }
  const code = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; ${windowsCsvSamplingFunctions}\n${cases.map(({ body }) => `${fakeProcesses}\n${body}`).join('\n')}`;
  const started = performance.now();
  const directory = await mkdtemp(join(tmpdir(), 'lv-t026-windows-')); const script = join(directory, 'scenarios.ps1');
  try {
    await writeFile(script, `\ufeff${code}`);
    const result = await promisify(execFile)('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, timeout: 10000 });
    expect(result.stderr).toBe('');
    results = result.stdout.trim().split(/\r?\n/u).map((line): unknown => JSON.parse(line));
    expect(results).toHaveLength(cases.length);
    console.log(`T-026 Windows scenario fixture: ${JSON.stringify({ cases: cases.length, milliseconds: performance.now() - started })}`);
  } finally { await rm(script, { force: true }); await rmdir(directory); }
});
const output = `[Console]::Out.WriteLine((ConvertTo-Json -InputObject @{rows=@($taskRows);events=@($script:taskEvents)} -Depth 6 -Compress))`;
const discover = `{ param($taskId) $script:taskEvents.Add('metadata'); [pscustomobject]@{ProcessId=$taskId;ParentProcessId=2;CommandLine='Code helper'} }`;

scenario('NFR-003: Given a new Windows process, When sampling memory, Then its handle and metadata precede fresh RSS and every handle is disposed',
  `$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); ${output}`, {
    rows: [{ pid: 31, stamp: '100', parent: 2, command: 'Code helper', rss: 100 }],
    events: ['handle', 'metadata', 'refresh', 'rss', 'dispose'],
});

scenario('NFR-003: Given a process exiting during metadata discovery, When sampling, Then no RSS is read and disposal still runs',
  `$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache {param($taskId) $script:taskEvents.Add('metadata'); $taskProcess.HasExited=$true}); ${output}`, {
    rows: [], events: ['handle', 'metadata', 'dispose'],
});

scenario('NFR-003: Given missing metadata for a live process, When sampling, Then the original strict failure remains and no RSS is read',
  `$taskMessage=''; try {$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache {param($taskId)})} catch {$taskMessage=$_.Exception.Message};
    [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{message=$taskMessage;events=@($script:taskEvents)} -Compress))`, {
    message: 'Missing or invalid process metadata.', events: ['handle', 'dispose'],
});

scenario('NFR-003: Given a process exiting immediately after RSS is read, When finishing its observation, Then that counter retains exact metadata instead of being omitted',
  `$script:taskExitAtRead=$true; $taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); ${output}`, {
    rows: [{ pid: 31, stamp: '100', parent: 2, command: 'Code helper', rss: 100 }],
    events: ['handle', 'metadata', 'refresh', 'rss', 'dispose'],
});

scenario('NFR-003: Given changing RSS and a reused Windows PID, When sampling repeatedly, Then counters refresh and new start-time identities rediscover metadata',
  `$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); $taskProcess.Bytes=400;
    $taskRows+=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); $taskProcess=New-TestProcess 31 101;
    $taskRows+=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); ${output}`, {
    rows: [
      { pid: 31, stamp: '100', parent: 2, command: 'Code helper', rss: 100 },
      { pid: 31, stamp: '100', parent: 2, command: 'Code helper', rss: 400 },
      { pid: 31, stamp: '101', parent: 2, command: 'Code helper', rss: 100 },
    ], events: ['handle', 'metadata', 'refresh', 'rss', 'dispose', 'handle', 'refresh', 'rss', 'dispose', 'handle', 'metadata', 'refresh', 'rss', 'dispose'],
});

scenario('NFR-003: Given an OS counter error while its process is alive, When sampling, Then the diagnostic fails and the handle is disposed',
  `$taskProcess | Add-Member ScriptProperty WorkingSet64 {throw 'counter denied'} -Force;
    $taskMessage=''; try {$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover})} catch {$taskMessage=$_.Exception.Message};
    [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{message=$taskMessage;events=@($script:taskEvents)} -Compress))`, {
    message: 'Invalid native OS counters.', events: ['handle', 'metadata', 'refresh', 'dispose'],
});

for (const [caseName, discovery, message] of [
  ['duplicate rows', '[pscustomobject]@{ProcessId=$taskId}; [pscustomobject]@{ProcessId=$taskId}', 'Missing or invalid process metadata.'],
  ['wrong PID', '[pscustomobject]@{ProcessId=32}', 'Missing or invalid process metadata.'],
  ['OS diagnostic', "throw 'CIM denied'", 'CIM denied'],
]) {
  scenario(`NFR-003: Given ${caseName} during process exit, When discovering metadata, Then the strict diagnostic survives exit and the handle is disposed`,
    `$taskMessage=''; try {$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache {param($taskId) $taskProcess.HasExited=$true; ${discovery}})} catch {$taskMessage=$_.Exception.Message};
      [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{message=$taskMessage;events=@($script:taskEvents)} -Compress))`, {
      message, events: ['handle', 'dispose'],
  });
}

scenario('NFR-003: Given access denied during native refresh and concurrent exit, When sampling, Then permission diagnostics still fail',
  `$taskProcess | Add-Member ScriptMethod Refresh {$script:taskEvents.Add('refresh'); $this.HasExited=$true; throw [System.ComponentModel.Win32Exception]::new(5)} -Force;
    $taskMessage=''; try {$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover})} catch {$taskMessage=$_.Exception.Message};
    [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{failed=($taskMessage.Length -gt 0);events=@($script:taskEvents)} -Compress))`, {
    failed: true, events: ['handle', 'metadata', 'refresh', 'dispose'],
});

scenario('NFR-003: Given a confirmed native process-exit error before RSS, When sampling, Then no counter is invented and the handle is disposed',
  `$taskProcess | Add-Member ScriptMethod Refresh {$script:taskEvents.Add('refresh'); $this.HasExited=$true; throw [InvalidOperationException]::new('Process exited')} -Force;
    $taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); ${output}`, {
    rows: [], events: ['handle', 'metadata', 'refresh', 'dispose'],
});
