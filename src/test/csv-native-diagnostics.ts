import { mkdtemp, open, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const stages = ['warm-cim', 'enumeration', 'metadata', 'counters'] as const;
type Stage = typeof stages[number];
interface Operation { stage: Stage; pid: number; }
interface Marker extends Operation { sequence: number; phase: 'begin' | 'end'; atMs: number; }
interface Checkpoint { sequence: number; dropped: number; active: Operation[]; records: Marker[]; }
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
function operation(value: unknown): Operation {
  if (!object(value) || !stages.some((stage) => stage === value['stage']) || !integer(value['pid']) || value['pid'] > 2147483647) {
    throw new Error('Invalid CSV native checkpoint operation.');
  }
  return { stage: value['stage'] as Stage, pid: value['pid'] };
}
function validStack(stack: readonly Operation[]): boolean {
  const first = stack[0]; const second = stack[1];
  return stack.length === 0 || (stack.length <= 2 && first !== undefined && first.stage !== 'metadata' && first.pid === 0
    && (second === undefined || (first.stage === 'counters' && second.stage === 'metadata' && second.pid > 0)));
}
function consistent(active: Operation[], records: Marker[], dropped: number): boolean {
  const stack = [...active]; if (!validStack(stack)) { return false; }
  for (const marker of [...records].reverse()) {
    if (marker.phase === 'end') { stack.push({ stage: marker.stage, pid: marker.pid }); }
    else {
      const last = stack.pop(); if (last?.stage !== marker.stage || last.pid !== marker.pid) { return false; }
    }
    if (!validStack(stack)) { return false; }
  }
  return dropped !== 0 || stack.length === 0;
}
/** Strict, fixed-field evidence only. Empty records leave native bootstrap unobserved. */
export function parseCsvNativeCheckpoint(text: string): Checkpoint {
  if (Buffer.byteLength(text) > 16384) { throw new Error('CSV native checkpoint exceeds 16384 bytes.'); }
  const value: unknown = JSON.parse(text);
  if (!object(value) || value['version'] !== 1 || !integer(value['sequence']) || !integer(value['dropped'])
    || !Array.isArray(value['active']) || value['active'].length > 2 || !Array.isArray(value['records']) || value['records'].length > 16
    || value['records'].length !== Math.min(16, value['sequence']) || value['dropped'] !== Math.max(0, value['sequence'] - 16)) {
    throw new Error('Invalid CSV native checkpoint.');
  }
  let lastMs = 0;
  const records = Array.from(value['records'], (item: unknown, index): Marker => {
    const current = operation(item);
    if (!object(item) || item['sequence'] !== Number(value['dropped']) + index + 1 || (item['phase'] !== 'begin' && item['phase'] !== 'end')
      || typeof item['atMs'] !== 'number' || !Number.isFinite(item['atMs']) || item['atMs'] < lastMs) { throw new Error('Invalid CSV native checkpoint marker.'); }
    lastMs = item['atMs'];
    return { ...current, sequence: Number(item['sequence']), phase: item['phase'], atMs: item['atMs'] };
  });
  const active = Array.from(value['active'], operation);
  if (!consistent(active, records, value['dropped'])) { throw new Error('Invalid CSV native checkpoint history.'); }
  return { sequence: value['sequence'], dropped: value['dropped'], active, records };
}

export async function createCsvNativeDiagnostics(directory: string, platform: NodeJS.Platform, flag: string | undefined) {
  if (platform !== 'win32' || flag !== '1') { return undefined; }
  const owned = await mkdtemp(join(directory, 'csv-native-')); const path = join(owned, 'checkpoint.json');
  const slots = [`${path}.0`, `${path}.1`] as const;
  const initial = JSON.stringify({ version: 1, sequence: 0, dropped: 0, active: [], records: [] });
  for (const slot of slots) { await writeFile(slot, initial, { flag: 'wx' }); }
  return { path, slots, async read(): Promise<Checkpoint & { incompleteSlots: number }> {
    const results = await Promise.allSettled(slots.map(readCheckpoint));
    const valid: Checkpoint[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status !== 'fulfilled') { continue; }
      if (result.value.sequence !== 0 && result.value.sequence % 2 !== index) { throw new Error('CSV native checkpoint slots are inconsistent.'); }
      valid.push(result.value);
    }
    valid.sort((left, right) => right.sequence - left.sequence);
    const latest = valid[0]; const previous = valid[1];
    if (latest === undefined) { throw new Error('CSV native checkpoints unavailable or invalid.'); }
    if (previous !== undefined && latest.sequence !== 0 && latest.sequence - previous.sequence !== 1) { throw new Error('CSV native checkpoint slots are inconsistent.'); }
    return { ...latest, incompleteSlots: 2 - valid.length };
  } };
}

async function readCheckpoint(path: string): Promise<Checkpoint> {
  const file = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(16385); const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    return parseCsvNativeCheckpoint(buffer.subarray(0, bytesRead).toString('utf8'));
  } finally { await file.close(); }
}

export async function reportCsvNativeFailure(message: string, diagnostics?: { read(): Promise<Checkpoint> },
  write: (text: string) => void = (text) => { process.stderr.write(text); }): Promise<void> {
  write(`${message}\n`); if (diagnostics === undefined) { return; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_accept, reject) => { timer = setTimeout(() => { reject(new Error('Native checkpoint read deadline.')); }, 1000); });
    const context = await Promise.race([diagnostics.read(), deadline]);
    write(`CSV native observer context: ${JSON.stringify({ ...context,
      scope: 'Latest complete native boundaries; incomplete slots can hide newer markers; bootstrap before first marker unobserved; observation adds cost; no cause attribution.' })}\n`);
  } catch { write('CSV native observer context: unavailable; native stage unknown; original failure retained.\n'); }
  finally { clearTimeout(timer); }
}

function replaceOnce(script: string, before: string, after: string): string {
  if (script.split(before).length !== 2) { throw new Error('Unexpected CSV native script structure.'); }
  return script.replace(before, after);
}

/** Two bounded alternating slots retain the previous complete marker if a write
 * is interrupted. No rename/delete/retry; write errors remain fatal. */
export function instrumentCsvNativeScript(script: string, path: string): string {
  const quoted = `'${path.replaceAll("'", "''")}'`;
  const functions = `
$script:taskTraceClock=[Diagnostics.Stopwatch]::StartNew(); $script:taskTraceSequence=[long]0;
$script:taskTraceRecords=New-Object 'System.Collections.Generic.List[object]';
$script:taskTraceActive=New-Object 'System.Collections.Generic.List[object]';
function Write-LiteVoyagerNativeMarker([string]$taskStage,[string]$taskPhase,[int]$taskId=0) {
  if ($taskStage -notin @('warm-cim','enumeration','metadata','counters') -or $taskPhase -notin @('begin','end')) { throw 'Invalid CSV native marker.' }
  $taskOperation=@{stage=$taskStage;pid=$taskId};
  if ($taskPhase -eq 'begin') { $script:taskTraceActive.Add($taskOperation) }
  else {
    $taskLast=$script:taskTraceActive.Count-1;
    if ($taskLast -lt 0 -or $script:taskTraceActive[$taskLast].stage -ne $taskStage -or $script:taskTraceActive[$taskLast].pid -ne $taskId) { throw 'Invalid CSV native marker nesting.' }
    $script:taskTraceActive.RemoveAt($taskLast)
  }
  $script:taskTraceSequence++;
  $script:taskTraceRecords.Add(@{sequence=$script:taskTraceSequence;stage=$taskStage;phase=$taskPhase;pid=$taskId;atMs=$script:taskTraceClock.Elapsed.TotalMilliseconds});
  if ($script:taskTraceRecords.Count -gt 16) { $script:taskTraceRecords.RemoveAt(0) }
  $taskCheckpoint=ConvertTo-Json -InputObject @{version=1;sequence=$script:taskTraceSequence;dropped=($script:taskTraceSequence-$script:taskTraceRecords.Count);active=$script:taskTraceActive.ToArray();records=$script:taskTraceRecords.ToArray()} -Compress -Depth 5;
  if ([Text.Encoding]::UTF8.GetByteCount($taskCheckpoint) -gt 16384) { throw 'CSV native checkpoint exceeds 16384 bytes.' }
  $taskSlot=$script:taskTraceSequence % 2;
  [IO.File]::WriteAllText((${quoted}+'.'+$taskSlot),$taskCheckpoint)
}
`;
  let result = replaceOnce(script, "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';",
    `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';${functions}`);
  const warm = "Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID) -Property ProcessId | Out-Null;";
  result = replaceOnce(result, warm, `Write-LiteVoyagerNativeMarker 'warm-cim' 'begin'; ${warm} Write-LiteVoyagerNativeMarker 'warm-cim' 'end';`);
  result = replaceOnce(result, '$taskFound=@(& $taskDiscover $taskProc.Id);',
    "Write-LiteVoyagerNativeMarker 'metadata' 'begin' $taskProc.Id; $taskFound=@(& $taskDiscover $taskProc.Id); Write-LiteVoyagerNativeMarker 'metadata' 'end' $taskProc.Id;");
  const begin = '$taskRows=@(Read-LiteVoyagerProcesses ([System.Diagnostics.Process]::GetProcessesByName(';
  const position = result.indexOf(begin);
  const suffix = ')) $taskMetadata {'; const end = result.indexOf(suffix, position);
  if (position < 0 || end < position) { throw new Error('Unexpected CSV native script enumeration.'); }
  const name = result.slice(position + begin.length, end);
  result = replaceOnce(result, `${begin}${name}${suffix}`,
    `Write-LiteVoyagerNativeMarker 'enumeration' 'begin'; $taskTraceProcesses=@([System.Diagnostics.Process]::GetProcessesByName(${name})); Write-LiteVoyagerNativeMarker 'enumeration' 'end';
  Write-LiteVoyagerNativeMarker 'counters' 'begin'; $taskRows=@(Read-LiteVoyagerProcesses $taskTraceProcesses $taskMetadata {`);
  return replaceOnce(result, '  });\n  [Console]::Out.WriteLine', "  }); Write-LiteVoyagerNativeMarker 'counters' 'end';\n  [Console]::Out.WriteLine");
}
