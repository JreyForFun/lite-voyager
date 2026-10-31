$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$taskSession = New-CimSession
$taskOriginal = @{}
function Read-TaskIdentity([int]$taskId, $taskKey) {
  $taskFound = $null
  try {
    # Reuse the local provider connection, never a prior process snapshot.
    # Handle is the process-ID metadata key, not an opened process handle.
    try { $taskFound = $taskSession.GetInstance('root/cimv2', $taskKey) }
    catch [System.Management.Automation.MethodInvocationException] {
      $taskCause = $_.Exception.InnerException
      if ($taskCause -is [Microsoft.Management.Infrastructure.CimException] -and $taskCause.NativeErrorCode -eq [Microsoft.Management.Infrastructure.NativeErrorCode]::NotFound) { return $null }
      throw
    }
    if ([int]$taskFound.CimInstanceProperties['ProcessId'].Value -ne $taskId) { throw 'Mismatched diagnostic process identity.' }
    $taskCreation = $taskFound.CimInstanceProperties['CreationDate'].Value
    if ($null -eq $taskCreation) { throw 'Missing diagnostic creation identity.' }
    return @{ creation=$taskCreation.ToUniversalTime().ToString('o'); parent=[int]$taskFound.CimInstanceProperties['ParentProcessId'].Value; name=[string]$taskFound.CimInstanceProperties['Name'].Value }
  } finally { if ($null -ne $taskFound) { $taskFound.Dispose() } }
}
function Write-TaskIdentity([string]$taskPhase, [int]$taskId, $taskKey) {
  $taskStarted = [DateTime]::UtcNow.ToString('o')
  $taskIdentity = Read-TaskIdentity $taskId $taskKey
  if ($taskPhase -eq 'started' -and $null -eq $taskIdentity) { throw 'Original host identity could not be observed.' }
  if ($taskPhase -eq 'exited' -and -not $taskOriginal.ContainsKey($taskId)) { throw 'Original host identity is missing.' }
  if ($taskPhase -eq 'started') { $taskOriginal[$taskId] = $taskIdentity.creation }
  $taskResult = @{ phase=$taskPhase; pid=$taskId; queryStartedUtc=$taskStarted; queryFinishedUtc=[DateTime]::UtcNow.ToString('o'); present=($null -ne $taskIdentity); identity=$taskIdentity; originalCreation=$taskOriginal[$taskId] }
  [Console]::Out.WriteLine('T026 shutdown identity evidence: ' + (ConvertTo-Json -InputObject $taskResult -Compress -Depth 4))
  [Console]::Out.Flush()
}
try {
  # Warm the same local provider path before the verification child starts.
  $taskWarmKey = New-CimInstance -ClassName Win32_Process -Property @{ Handle=[string]$PID } -Key Handle -ClientOnly
  try { if ($null -eq (Read-TaskIdentity $PID $taskWarmKey)) { throw 'Diagnostic provider warmup failed.' } }
  finally { $taskWarmKey.Dispose() }
  [Console]::Out.WriteLine('T026 identity ready')
  [Console]::Out.Flush()
  while ($null -ne ($taskRequest = [Console]::ReadLine())) {
    if ($taskRequest -notmatch '^(started|exited) ([1-9][0-9]{0,9})$') { throw 'Invalid diagnostic identity request.' }
    $taskPhase = $Matches[1]
    $taskId = [int]$Matches[2]
    $taskKey = New-CimInstance -ClassName Win32_Process -Property @{ Handle=[string]$taskId } -Key Handle -ClientOnly
    try {
      if ($taskPhase -eq 'started') { Write-TaskIdentity $taskPhase $taskId $taskKey }
      else {
        # Bounded observation only; no target handles, signals, retries or clock changes.
        for ($taskIndex=0; $taskIndex -lt 20; $taskIndex++) {
          Write-TaskIdentity $taskPhase $taskId $taskKey
          if ($taskIndex -lt 19) { Start-Sleep -Milliseconds 100 }
        }
      }
    } finally { $taskKey.Dispose() }
  }
} finally { Remove-CimSession -CimSession $taskSession }
