/** Test-only native sampler. Resolve metadata before observing a new counter:
 * holding the original process handle prevents PID reuse from changing identity.
 * https://learn.microsoft.com/dotnet/api/system.diagnostics.process.hasexited */
export const windowsCsvSamplingFunctions = `
function Test-LiteVoyagerExitError($taskError,$taskProc) {
  $taskCause=$taskError.Exception;
  while ($null -ne $taskCause.InnerException) { $taskCause=$taskCause.InnerException }
  return $taskProc.HasExited -and ($taskCause -is [InvalidOperationException] -or
    ($taskCause -is [System.ComponentModel.Win32Exception] -and $taskCause.NativeErrorCode -in @(6,87)))
}
function Read-LiteVoyagerProcesses($taskProcesses,[hashtable]$taskMetadata,[scriptblock]$taskDiscover) {
  $taskAlive=@{};
  foreach ($taskProc in $taskProcesses) {
    try {
      if ($taskProc.HasExited) { continue }
      try {
        $null=$taskProc.Handle;
        $taskStamp=$taskProc.StartTime.ToUniversalTime().Ticks.ToString();
      } catch { if (Test-LiteVoyagerExitError $_ $taskProc) { continue }; throw }
      $taskKey=$taskProc.Id.ToString()+'/'+$taskStamp; $taskAlive[$taskKey]=$true;
      if (-not $taskMetadata.ContainsKey($taskKey)) {
        $taskFound=@(& $taskDiscover $taskProc.Id);
        if ($taskFound.Count -eq 0 -and $taskProc.HasExited) { continue }
        if ($taskFound.Count -ne 1 -or $taskFound[0].ProcessId -ne $taskProc.Id) { throw 'Missing or invalid process metadata.' }
        $taskMetadata[$taskKey]=@{pid=[double]$taskProc.Id;stamp=$taskStamp;parent=[double]$taskFound[0].ParentProcessId;command=[string]$taskFound[0].CommandLine};
      }
      try {
        $taskProc.Refresh();
        if ($taskProc.HasExited) { continue }
        $taskRss=$taskProc.WorkingSet64;
      } catch { if (Test-LiteVoyagerExitError $_ $taskProc) { continue }; throw }
      if ($null -eq $taskRss) { throw 'Invalid native OS counters.' }
      $taskRow=$taskMetadata[$taskKey];
      @{pid=$taskRow.pid;stamp=$taskRow.stamp;parent=$taskRow.parent;command=$taskRow.command;rss=[double]$taskRss}
    } finally { $taskProc.Dispose() }
  }
  foreach ($taskKey in @($taskMetadata.Keys)) { if (-not $taskAlive.ContainsKey($taskKey)) { $taskMetadata.Remove($taskKey) } }
}
`;

export function windowsCsvMemoryScript(name: string): string {
  const quoted = `'${name.replaceAll("'", "''")}'`;
  return `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';
${windowsCsvSamplingFunctions}
Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID) -Property ProcessId | Out-Null;
$taskMetadata=@{};
while ($true) {
  $taskRows=@(Read-LiteVoyagerProcesses ([System.Diagnostics.Process]::GetProcessesByName(${quoted})) $taskMetadata {
    param($taskId) Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskId) -Property ProcessId,ParentProcessId,CommandLine
  });
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $taskRows -Compress -Depth 4)); [Console]::Out.Flush();
  if ([Console]::ReadLine() -eq $null) { break }; Start-Sleep -Milliseconds 100
}`;
}
