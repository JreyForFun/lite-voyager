import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
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
async function run(body: string): Promise<unknown> {
  const code = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; ${windowsCsvSamplingFunctions}\n${fakeProcesses}\n${body}`;
  const result = await promisify(execFile)('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')],
    { windowsHide: true, timeout: 10000 });
  expect(result.stderr).toBe(''); const value: unknown = JSON.parse(result.stdout); return value;
}
const output = `[Console]::Out.WriteLine((ConvertTo-Json -InputObject @{rows=@($taskRows);events=@($script:taskEvents)} -Depth 6 -Compress))`;
const discover = `{ param($taskId) $script:taskEvents.Add('metadata'); [pscustomobject]@{ProcessId=$taskId;ParentProcessId=2;CommandLine='Code helper'} }`;

test.runIf(process.platform === 'win32')('NFR-003: Given a new Windows process, When sampling memory, Then its handle and metadata precede fresh RSS and every handle is disposed', async () => {
  expect(await run(`$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); ${output}`)).toEqual({
    rows: [{ pid: 31, stamp: '100', parent: 2, command: 'Code helper', rss: 100 }],
    events: ['handle', 'metadata', 'refresh', 'rss', 'dispose'],
  });
});

test.runIf(process.platform === 'win32')('NFR-003: Given a process exiting during metadata discovery, When sampling, Then no RSS is read and disposal still runs', async () => {
  expect(await run(`$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache {param($taskId) $script:taskEvents.Add('metadata'); $taskProcess.HasExited=$true}); ${output}`)).toEqual({
    rows: [], events: ['handle', 'metadata', 'dispose'],
  });
});

test.runIf(process.platform === 'win32')('NFR-003: Given missing metadata for a live process, When sampling, Then the original strict failure remains and no RSS is read', async () => {
  expect(await run(`$taskMessage=''; try {$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache {param($taskId)})} catch {$taskMessage=$_.Exception.Message};
    [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{message=$taskMessage;events=@($script:taskEvents)} -Compress))`)).toEqual({
    message: 'Missing or invalid process metadata.', events: ['handle', 'dispose'],
  });
});

test.runIf(process.platform === 'win32')('NFR-003: Given a process exiting immediately after RSS is read, When finishing its observation, Then that counter retains exact metadata instead of being omitted', async () => {
  expect(await run(`$script:taskExitAtRead=$true; $taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); ${output}`)).toEqual({
    rows: [{ pid: 31, stamp: '100', parent: 2, command: 'Code helper', rss: 100 }],
    events: ['handle', 'metadata', 'refresh', 'rss', 'dispose'],
  });
});

test.runIf(process.platform === 'win32')('NFR-003: Given changing RSS and a reused Windows PID, When sampling repeatedly, Then counters refresh and new start-time identities rediscover metadata', async () => {
  expect(await run(`$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); $taskProcess.Bytes=400;
    $taskRows+=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); $taskProcess=New-TestProcess 31 101;
    $taskRows+=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); ${output}`)).toEqual({
    rows: [
      { pid: 31, stamp: '100', parent: 2, command: 'Code helper', rss: 100 },
      { pid: 31, stamp: '100', parent: 2, command: 'Code helper', rss: 400 },
      { pid: 31, stamp: '101', parent: 2, command: 'Code helper', rss: 100 },
    ], events: ['handle', 'metadata', 'refresh', 'rss', 'dispose', 'handle', 'refresh', 'rss', 'dispose', 'handle', 'metadata', 'refresh', 'rss', 'dispose'],
  });
});

test.runIf(process.platform === 'win32')('NFR-003: Given an OS counter error while its process is alive, When sampling, Then the diagnostic fails and the handle is disposed', async () => {
  expect(await run(`$taskProcess | Add-Member ScriptProperty WorkingSet64 {throw 'counter denied'} -Force;
    $taskMessage=''; try {$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover})} catch {$taskMessage=$_.Exception.Message};
    [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{message=$taskMessage;events=@($script:taskEvents)} -Compress))`)).toMatchObject({
    message: 'Invalid native OS counters.', events: ['handle', 'metadata', 'refresh', 'dispose'],
  });
});

for (const [scenario, discovery, message] of [
  ['duplicate rows', '[pscustomobject]@{ProcessId=$taskId}; [pscustomobject]@{ProcessId=$taskId}', 'Missing or invalid process metadata.'],
  ['wrong PID', '[pscustomobject]@{ProcessId=32}', 'Missing or invalid process metadata.'],
  ['OS diagnostic', "throw 'CIM denied'", 'CIM denied'],
]) {
  test.runIf(process.platform === 'win32')(`NFR-003: Given ${scenario} during process exit, When discovering metadata, Then the strict diagnostic survives exit and the handle is disposed`, async () => {
    expect(await run(`$taskMessage=''; try {$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache {param($taskId) $taskProcess.HasExited=$true; ${discovery}})} catch {$taskMessage=$_.Exception.Message};
      [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{message=$taskMessage;events=@($script:taskEvents)} -Compress))`)).toEqual({
      message, events: ['handle', 'dispose'],
    });
  });
}

test.runIf(process.platform === 'win32')('NFR-003: Given access denied during native refresh and concurrent exit, When sampling, Then permission diagnostics still fail', async () => {
  expect(await run(`$taskProcess | Add-Member ScriptMethod Refresh {$script:taskEvents.Add('refresh'); $this.HasExited=$true; throw [System.ComponentModel.Win32Exception]::new(5)} -Force;
    $taskMessage=''; try {$taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover})} catch {$taskMessage=$_.Exception.Message};
    [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{failed=($taskMessage.Length -gt 0);events=@($script:taskEvents)} -Compress))`)).toEqual({
    failed: true, events: ['handle', 'metadata', 'refresh', 'dispose'],
  });
});

test.runIf(process.platform === 'win32')('NFR-003: Given a confirmed native process-exit error before RSS, When sampling, Then no counter is invented and the handle is disposed', async () => {
  expect(await run(`$taskProcess | Add-Member ScriptMethod Refresh {$script:taskEvents.Add('refresh'); $this.HasExited=$true; throw [InvalidOperationException]::new('Process exited')} -Force;
    $taskRows=@(Read-LiteVoyagerProcesses @($taskProcess) $taskCache ${discover}); ${output}`)).toEqual({
    rows: [], events: ['handle', 'metadata', 'refresh', 'dispose'],
  });
});
