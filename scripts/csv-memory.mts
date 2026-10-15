import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { basename, extname } from 'node:path';
import { promisify } from 'node:util';

const requireLocal = createRequire(import.meta.url);
const { memorySample, parseProcessTable } = requireLocal('../out/integration/test/sqlite-memory-support.js') as typeof import('../src/test/sqlite-memory-support');
const { ProcessMemoryCache, parseNativeCounters } = requireLocal('../out/integration/test/csv-memory-cache.js') as typeof import('../src/test/csv-memory-cache');
const { observeProcessLines } = requireLocal('../out/integration/test/sqlite-memory-observer.js') as typeof import('../src/test/sqlite-memory-observer');
const { ProcessMetadataReader } = requireLocal('../out/integration/test/csv-memory-metadata.js') as typeof import('../src/test/csv-memory-metadata');
const raw = process.argv[2]; const hostPid = Number(raw);
if (process.argv.length !== 3 || raw === undefined || !/^\d+$/u.test(raw) || !Number.isSafeInteger(hostPid) || hostPid <= 0) { throw new Error('Usage: node scripts/csv-memory.mts <extension-host-pid>'); }
const abort = new AbortController(); process.stdin.resume(); process.stdin.on('end', () => { abort.abort(); });
const started = performance.now(); const execute = promisify(execFile);
const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;
// Refreshed native counters, not cached RSS. Metadata is queried only for a new
// PID/start-time pair. Same executable as the host includes all bundled helpers
// and Windows renderers. Other executables cannot be Lite Voyager workers.
// https://learn.microsoft.com/dotnet/api/system.diagnostics.process.workingset64
// https://learn.microsoft.com/dotnet/api/system.diagnostics.process.getprocessesbyname
const name = basename(process.execPath, extname(process.execPath));
const native = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; while ($true) {
  $taskRows=@([System.Diagnostics.Process]::GetProcessesByName(${quote(name)}) | ForEach-Object {
    $taskProc=$_; try { $taskProc.Refresh(); @{pid=[double]$taskProc.Id; rss=[double]$taskProc.WorkingSet64; stamp=$taskProc.StartTime.ToUniversalTime().Ticks.ToString()} }
    catch { if (-not $taskProc.HasExited) { throw } } finally { $taskProc.Dispose() }
  }); [Console]::Out.WriteLine((ConvertTo-Json -InputObject $taskRows -Compress)); [Console]::Out.Flush();
  if ([Console]::ReadLine() -eq $null) { break }; Start-Sleep -Milliseconds 100
}`;
// Warm CIM once before the observed window; do not pay PowerShell/module startup
// at every helper transition. Requests contain only validated numeric OS IDs.
const metadataCode = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';
  Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID) -Property ProcessId | Out-Null;
  [Console]::Out.WriteLine('{"type":"ready"}'); [Console]::Out.Flush();
  while (($taskLine=[Console]::ReadLine()) -ne $null) {
    $taskRequest=ConvertFrom-Json -InputObject $taskLine;
    $taskFilter=($taskRequest.items | ForEach-Object { 'ProcessId='+[int]$_.pid }) -join ' OR ';
    $taskRows=@(Get-CimInstance Win32_Process -Filter $taskFilter -Property ProcessId,ParentProcessId,CommandLine | ForEach-Object {
    $taskProc=[System.Diagnostics.Process]::GetProcessById([int]$_.ProcessId); try { @{pid=[double]$_.ProcessId; parent=[double]$_.ParentProcessId; command=[string]$_.CommandLine; stamp=$taskProc.StartTime.ToUniversalTime().Ticks.ToString()} } finally { $taskProc.Dispose() }
    }); [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{type='metadata';rows=$taskRows} -Compress -Depth 4)); [Console]::Out.Flush()
  }`;
let reader: InstanceType<typeof ProcessMetadataReader> | undefined;
try {
  if (process.platform === 'win32') {
    const cache = new ProcessMemoryCache();
    reader = new ProcessMetadataReader('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(metadataCode, 'utf16le').toString('base64')]);
    await reader.ready; const metadata = reader;
    await observeProcessLines('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(native, 'utf16le').toString('base64')], async (line) => {
      const rows = await cache.merge(parseNativeCounters(line), (items) => metadata.request(items));
      process.stdout.write(`${JSON.stringify(memorySample(rows, hostPid, performance.now() - started))}\n`);
    }, abort.signal, 20000, 3000, true);
  } else {
    while (!abort.signal.aborted) {
      const result = await execute('ps', ['-axo', 'pid=,ppid=,rss=,command='], { timeout: 3000, maxBuffer: 4 * 1024 * 1024, signal: abort.signal });
      if (result.stderr !== '') { throw new Error(`OS memory diagnostic: ${result.stderr}`); }
      process.stdout.write(`${JSON.stringify(memorySample(parseProcessTable(result.stdout), hostPid, performance.now() - started))}\n`);
      await new Promise<void>((accept) => { setTimeout(accept, 100); });
    }
  }
} catch (error: unknown) {
  const expectedAbort = abort.signal.aborted && error instanceof Error && error.name === 'AbortError';
  if (!expectedAbort) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
} finally { await reader?.stop(); process.stdin.pause(); }
