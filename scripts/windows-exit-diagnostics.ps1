$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Warm the external metadata provider before the verification child starts.
Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID) -Property ProcessId | Out-Null
$taskOriginal = @{}
function Write-TaskIdentity([string]$taskPhase, [int]$taskId) {
  $taskStarted = [DateTime]::UtcNow.ToString('o')
  $taskFound = @(Get-CimInstance Win32_Process -Filter ('ProcessId=' + $taskId) -Property ProcessId,ParentProcessId,CreationDate,Name)
  if ($taskFound.Count -gt 1) { throw 'Ambiguous diagnostic process identity.' }
  if ($taskPhase -eq 'started' -and $taskFound.Count -ne 1) { throw 'Original host identity could not be observed.' }
  if ($taskPhase -eq 'exited' -and -not $taskOriginal.ContainsKey($taskId)) { throw 'Original host identity is missing.' }
  $taskIdentity = $null
  if ($taskFound.Count -eq 1) {
    if ($null -eq $taskFound[0].CreationDate) { throw 'Missing diagnostic creation identity.' }
    $taskIdentity = @{ creation=$taskFound[0].CreationDate.ToUniversalTime().ToString('o'); parent=[int]$taskFound[0].ParentProcessId; name=[string]$taskFound[0].Name }
    if ($taskPhase -eq 'started') { $taskOriginal[$taskId] = $taskIdentity.creation }
  }
  $taskResult = @{ phase=$taskPhase; pid=$taskId; queryStartedUtc=$taskStarted; queryFinishedUtc=[DateTime]::UtcNow.ToString('o'); present=($taskFound.Count -eq 1); identity=$taskIdentity; originalCreation=$taskOriginal[$taskId] }
  [Console]::Out.WriteLine('T026 shutdown identity evidence: ' + (ConvertTo-Json -InputObject $taskResult -Compress -Depth 4))
  [Console]::Out.Flush()
}
[Console]::Out.WriteLine('T026 identity ready')
[Console]::Out.Flush()
while ($null -ne ($taskRequest = [Console]::ReadLine())) {
  if ($taskRequest -notmatch '^(started|exited) ([1-9][0-9]{0,9})$') { throw 'Invalid diagnostic identity request.' }
  $taskPhase = $Matches[1]
  $taskId = [int]$Matches[2]
  if ($taskPhase -eq 'started') { Write-TaskIdentity $taskPhase $taskId }
  else {
    # Bounded observation only; no target handles, signals, retries or clock changes.
    for ($taskIndex=0; $taskIndex -lt 20; $taskIndex++) {
      Write-TaskIdentity $taskPhase $taskId
      if ($taskIndex -lt 19) { Start-Sleep -Milliseconds 100 }
    }
  }
}
