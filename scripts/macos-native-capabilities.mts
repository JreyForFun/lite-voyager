import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

export interface CapabilityCommand { name: string; command: string; args: readonly string[]; }
export interface CapabilityResult {
  stdout: Buffer; stderr: Buffer; exitCode: number | null; signal: NodeJS.Signals | null;
  killed: boolean; failureCode: string | null;
}
const timeoutMs = 15000; const outputBoundBytes = 1048576;
export const capabilityCommands: readonly CapabilityCommand[] = [
  { name: 'os-version', command: 'sw_vers', args: [] },
  { name: 'architecture', command: 'uname', args: ['-m'] },
  { name: 'xcode-version', command: 'xcodebuild', args: ['-version'] },
  { name: 'xctrace-path', command: 'xcrun', args: ['--find', 'xctrace'] },
  { name: 'xctrace-manual', command: 'man', args: ['xctrace'] },
  { name: 'xctrace-templates', command: 'xcrun', args: ['xctrace', 'list', 'templates'] },
];

/** Bounded raw capture, not the extension verification scanner. Manuals are data. */
export function executeCapability(command: CapabilityCommand, limits: { timeoutMs?: number; maxBuffer?: number } = {}): Promise<CapabilityResult> {
  return new Promise((accept) => {
    const child = execFile(command.command, [...command.args], {
      encoding: 'buffer', timeout: limits.timeoutMs ?? timeoutMs, maxBuffer: limits.maxBuffer ?? outputBoundBytes,
      killSignal: 'SIGKILL', windowsHide: true, env: { ...process.env, PAGER: 'cat', MANPAGER: 'cat' },
    }, (error, stdout, stderr) => {
      // execFile calls back after close. Its maxBuffer error omits termination
      // fields, so retain the child's actual status separately from that error.
      accept({ stdout, stderr, exitCode: error === null ? 0 : typeof error.code === 'number' ? error.code
        : error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? child.exitCode : null,
        signal: child.signalCode, killed: child.killed,
        failureCode: typeof error?.code === 'string' ? error.code : error !== null && error.code === undefined ? 'capture-error' : null });
    });
  });
}

const clean = (value: CapabilityResult): boolean => value.exitCode === 0 && value.signal === null && !value.killed && value.failureCode === null
  && value.stdout.length > 0 && value.stderr.length === 0;
const failed = (failureCode: string): CapabilityResult => ({ stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), exitCode: null, signal: null, killed: false, failureCode });
function listsTemplates(manual: CapabilityResult | undefined): boolean {
  if (manual === undefined || !clean(manual)) { return false; }
  const text = stripVTControlCharacters(manual.stdout.toString('utf8')).replace(/.\u0008/gu, '');
  // Execute only the fixed read-only syntax actually present in the installed
  // vendor manual. An unfamiliar manual is retained and fails discovery.
  return /\bxctrace\s+list\s+templates\b/iu.test(text) || /\blist\s+\[devices\|templates\|instruments\]/iu.test(text);
}

export async function collectMacCapabilities(directory: string, options: {
  platform?: NodeJS.Platform; execute?: (command: CapabilityCommand) => Promise<CapabilityResult>;
} = {}) {
  if ((options.platform ?? process.platform) !== 'darwin') { throw new Error('Native capability collection is macOS only.'); }
  if ((await readdir(directory)).length !== 0) { throw new Error('Collection requires an empty evidence directory.'); }
  const commands = []; let manual: CapabilityResult | undefined; let passed = true;
  for (const command of capabilityCommands) {
    const started = new Date().toISOString(); let result: CapabilityResult;
    if (command.name === 'xctrace-templates' && !listsTemplates(manual)) { result = failed('template-list-syntax-unverified'); }
    else {
      try { result = await (options.execute ?? executeCapability)(command); }
      catch { result = failed('executor-threw'); }
    }
    if (command.name === 'xctrace-manual') { manual = result; }
    const stdoutFile = `${command.name}.stdout.log`; const stderrFile = `${command.name}.stderr.log`;
    await writeFile(join(directory, stdoutFile), result.stdout, { flag: 'wx' });
    await writeFile(join(directory, stderrFile), result.stderr, { flag: 'wx' });
    const output = (file: string, bytes: Buffer) => ({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    commands.push({ ...command, started, finished: new Date().toISOString(), exitCode: result.exitCode, signal: result.signal, killed: result.killed,
      failureCode: result.failureCode, outputBoundExceeded: result.failureCode === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
      stdout: output(stdoutFile, result.stdout), stderr: output(stderrFile, result.stderr) });
    passed &&= clean(result);
  }
  const report = { platform: 'darwin', passed, outputBoundBytes, timeoutMs, commands,
    scope: 'Read-only tool-output capture only; not native tracing permission, warning-free output, extension verification or a repair.' };
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  return report;
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') { throw new Error('Native capability collection is macOS only.'); }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'); const output = join(root, 'out');
  await mkdir(output, { recursive: true });
  if ((await lstat(output)).isSymbolicLink() || dirname(await realpath(output)) !== await realpath(root)) { throw new Error('Linked or non-owned output is refused.'); }
  const directory = await mkdtemp(join(output, 'macos-native-capabilities-'));
  const report = await collectMacCapabilities(directory);
  process.stdout.write(`${JSON.stringify({ directory, passed: report.passed, commands: report.commands.length, scope: report.scope })}\n`);
  if (!report.passed) { process.exitCode = 1; }
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
