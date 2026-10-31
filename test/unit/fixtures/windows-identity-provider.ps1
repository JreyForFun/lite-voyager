param([Parameter(Mandatory=$true)][string]$CollectorPath)
$ErrorActionPreference = 'Stop'
$taskTokens = $null
$taskErrors = $null
$taskAst = [System.Management.Automation.Language.Parser]::ParseFile($CollectorPath, [ref]$taskTokens, [ref]$taskErrors)
if ($taskErrors.Count -ne 0) { throw 'Collector parse failed.' }
$taskFunction = $taskAst.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Read-TaskIdentity' }, $true)
if ($null -eq $taskFunction) { throw 'Missing Read-TaskIdentity implementation.' }
. ([ScriptBlock]::Create($taskFunction.Extent.Text))
$taskSession = New-CimSession
$taskLive = New-CimInstance -ClassName Win32_Process -Property @{ Handle=[string]$PID } -Key Handle -ClientOnly
$taskAbsent = New-CimInstance -ClassName Win32_Process -Property @{ Handle='2147483647' } -Key Handle -ClientOnly
$taskInvalid = New-CimInstance -ClassName LiteVoyagerMissingProcessClass -Property @{ Handle=[string]$PID } -Key Handle -ClientOnly
try {
  $taskIdentity = Read-TaskIdentity $PID $taskLive
  $taskReference = $taskSession.GetInstance('root/cimv2', $taskLive)
  try {
    if ($taskIdentity.creation -ne $taskReference.CimInstanceProperties['CreationDate'].Value.ToUniversalTime().ToString('o')) { throw 'Creation precision changed.' }
    if ($taskIdentity.parent -ne $taskReference.CimInstanceProperties['ParentProcessId'].Value) { throw 'Parent identity changed.' }
    if ($taskIdentity.name -ne $taskReference.CimInstanceProperties['Name'].Value) { throw 'Process name changed.' }
  } finally { $taskReference.Dispose() }
  if ($null -ne (Read-TaskIdentity 2147483647 $taskAbsent)) { throw 'Absent process was not represented as absence.' }
  $taskRetained = $false
  try { $null = Read-TaskIdentity $PID $taskInvalid }
  catch {
    $taskCause = $_.Exception.InnerException
    if ($taskCause -isnot [Microsoft.Management.Infrastructure.CimException] -or $taskCause.NativeErrorCode -eq [Microsoft.Management.Infrastructure.NativeErrorCode]::NotFound) { throw }
    $taskRetained = $true
  }
  if (-not $taskRetained) { throw 'Provider failure became absence.' }
  $taskMismatch = $false
  try { $null = Read-TaskIdentity ($PID + 1) $taskLive }
  catch { if ($_.Exception.Message -notmatch 'Mismatched diagnostic process identity') { throw }; $taskMismatch = $true }
  if (-not $taskMismatch) { throw 'Wrong process identity was accepted.' }
  [Console]::Out.WriteLine('T030 provider edge checks passed')
} finally {
  $taskLive.Dispose(); $taskAbsent.Dispose(); $taskInvalid.Dispose()
  Remove-CimSession -CimSession $taskSession
}
