import { execFile } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import { promisify } from 'node:util';

type Execute = (executable: string, args: string[], options: {
  timeout: number; maxBuffer: number; windowsHide: boolean; env: NodeJS.ProcessEnv;
}) => Promise<{ stdout: string; stderr: string }>;
const executeDefault: Execute = (executable, args, options) => promisify(execFile)(executable, args, options);

interface RuntimeProcess { pid: number; parent: number; command: string; }
function rows(stdout: string, platform: NodeJS.Platform): RuntimeProcess[] {
  const parsed: unknown = platform === 'win32' ? JSON.parse(stdout) : stdout.trim().split(/\r?\n/u).map((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(line);
    if (match === null) { throw new Error('Invalid passive process snapshot.'); }
    return { pid: Number(match[1]), parent: Number(match[2]), command: match[3] };
  });
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 8192) { throw new Error('Invalid passive process count.'); }
  return parsed.map((value: unknown) => {
    if (typeof value !== 'object' || value === null || !('pid' in value) || !('parent' in value) || !('command' in value)
      || typeof value.pid !== 'number' || !Number.isSafeInteger(value.pid) || value.pid < 0
      || typeof value.parent !== 'number' || !Number.isSafeInteger(value.parent) || value.parent < 0
      || typeof value.command !== 'string' || value.command.length > 65536) { throw new Error('Invalid passive process record.'); }
    return { pid: value.pid, parent: value.parent, command: value.command };
  });
}
function targets(command: string, profile: string, platform: NodeJS.Platform): boolean {
  const text = command.replaceAll('"', ''); const normalize = (value: string): string => platform === 'win32' ? value.toLowerCase() : value;
  const haystack = normalize(text); const needle = normalize(`--user-data-dir=${profile}`); const at = haystack.indexOf(needle); const end = at + needle.length;
  return at >= 0 && (at === 0 || /\s/u.test(haystack[at - 1] ?? '')) && (end === haystack.length || /\s/u.test(haystack[end] ?? '')) && !text.includes('--type=');
}
/** Test-only passive OS snapshot. Never launches Code, queries graphics or sends signals. */
export async function captureHostRuntime(root: string, profile: string, hostPid: number, execute: Execute = executeDefault, platform: NodeJS.Platform = process.platform) {
  const target = resolve(profile);
  if (dirname(target) !== resolve(root, 'out') || !basename(target).startsWith('integration-profile-')) {
    throw new Error('Host status requires an isolated integration profile inside project output.');
  }
  const output = join(root, 'out');
  if ((await lstat(output)).isSymbolicLink() || (await lstat(target)).isSymbolicLink()
    || dirname(await realpath(target)) !== await realpath(output) || dirname(await realpath(output)) !== await realpath(root)) {
    throw new Error('Host status refuses linked or non-isolated profiles.');
  }
  if (!Number.isSafeInteger(hostPid) || hostPid <= 0) { throw new Error('Invalid diagnostic host PID.'); }
  const script = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; @(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,CommandLine | ForEach-Object { @{pid=[int]$_.ProcessId;parent=[int]$_.ParentProcessId;command=[string]$_.CommandLine} }) | ConvertTo-Json -Compress";
  const result = await execute(platform === 'win32' ? 'powershell.exe' : 'ps', platform === 'win32'
    ? ['-NoProfile', '-NonInteractive', '-Command', script] : ['-axo', 'pid=,ppid=,command='], {
    timeout: 15000, maxBuffer: 1048576, windowsHide: true, env: process.env,
  });
  if (result.stderr !== '') { throw new Error(`Passive runtime collector diagnostic: ${result.stderr}`); }
  const snapshot = rows(result.stdout, platform); const main = snapshot.filter((row) => targets(row.command, target, platform));
  if (main.length !== 1 || main[0] === undefined) { throw new Error('Passive snapshot cannot identify one isolated host.'); }
  const selected = new Set([main[0].pid]); const children = new Map<number, number[]>();
  for (const row of snapshot) { const list = children.get(row.parent) ?? []; list.push(row.pid); children.set(row.parent, list); }
  const pending = [main[0].pid];
  for (let index = 0; index < pending.length; index++) { for (const pid of children.get(pending[index] ?? -1) ?? []) {
    if (!selected.has(pid)) { selected.add(pid); pending.push(pid); }
  } }
  if (!selected.has(hostPid)) { throw new Error('Passive snapshot is missing the actual test host.'); }
  return { platform, processes: snapshot.filter((row) => selected.has(row.pid)).sort((a, b) => a.pid - b.pid),
    scope: 'passive OS process/argument snapshot; no retained handles or signals; not proof of graphics backend or historical failure cause' };
}
