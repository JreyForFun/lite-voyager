import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';

// compile-tests supplies CommonJS with an explicit runtime module format.
// Native .ts import on the supported Node 24 host emits a typeless-module
// diagnostic; do not suppress it or change the production package format.
const { memorySample, parseProcessJson, parseProcessTable } = createRequire(import.meta.url)('../out/integration/test/sqlite-memory-support.js') as typeof import('../src/test/sqlite-memory-support.ts');

const raw = process.argv[2];
const hostPid = Number(raw);
if (process.argv.length !== 3 || raw === undefined || !/^\d+$/u.test(raw) || !Number.isSafeInteger(hostPid) || hostPid <= 0) {
  throw new Error('Usage: node scripts/sqlite-memory.mts <extension-host-pid>');
}
// Test tooling only. No observer, OS command or measurement enters the VSIX.
// https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-process
// https://man7.org/linux/man-pages/man1/ps.1.html
// Darwin ps(1): pid, ppid, rss (KiB), command. Args are separate, never shell-built.
// Windows PowerShell serializes module-preparation progress onto stderr when
// invoked with EncodedCommand. Disable that progress UI only; warnings/errors
// remain enabled and any stderr still fails the observer's diagnostic gate.
const powershell = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $snapshot=@(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,CommandLine | ForEach-Object { @{pid=[double]$_.ProcessId; parent=[double]$_.ParentProcessId; rss=[double]$_.WorkingSetSize; command=[string]$_.CommandLine} }); ConvertTo-Json -InputObject $snapshot -Compress";
let stopped = false;
process.stdin.resume(); process.stdin.on('end', () => { stopped = true; });
const started = performance.now();
try {
  while (!stopped) {
    const result = process.platform === 'win32'
      ? await promisify(execFile)('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(powershell, 'utf16le').toString('base64')], { windowsHide: true, timeout: 3000, maxBuffer: 4 * 1024 * 1024 })
      : await promisify(execFile)('ps', ['-axo', 'pid=,ppid=,rss=,command='], { timeout: 3000, maxBuffer: 4 * 1024 * 1024 });
    if (result.stderr.length !== 0) { throw new Error(`The OS memory observer emitted a diagnostic: ${result.stderr}`); }
    const rows = process.platform === 'win32' ? parseProcessJson(result.stdout) : parseProcessTable(result.stdout);
    process.stdout.write(`${JSON.stringify(memorySample(rows, hostPid, performance.now() - started))}\n`);
    await new Promise<void>((resolve) => { setTimeout(resolve, 100); });
  }
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1;
} finally { process.stdin.pause(); }
