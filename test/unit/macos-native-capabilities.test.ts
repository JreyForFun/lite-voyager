import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { capabilityCommands, collectMacCapabilities, executeCapability, type CapabilityCommand, type CapabilityResult } from '../../scripts/macos-native-capabilities.mts';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(async (directory) => {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('lv-macos-capabilities-')) { throw new Error('Unexpected cleanup target'); }
  await rm(target, { recursive: true, force: true });
})); });
async function directory(): Promise<string> { const path = await mkdtemp(join(tmpdir(), 'lv-macos-capabilities-')); directories.push(path); return path; }
const success = (stdout = 'ordinary output\n'): CapabilityResult => ({ stdout: Buffer.from(stdout), stderr: Buffer.alloc(0), exitCode: 0, signal: null, killed: false, failureCode: null });
const manual = 'xctrace list [devices|templates|instruments]\nRecord options are documented here.\n';
const ordinary = (command: CapabilityCommand): Promise<CapabilityResult> => Promise.resolve(success(command.name === 'xctrace-manual' ? manual : 'ordinary output\n'));

test('T-030: Given a macOS capability collection, When all fixed read-only commands succeed, Then separate exact output bytes and original statuses are retained without running a workload', async () => {
  const path = await directory(); const execute = vi.fn(ordinary);
  const report = await collectMacCapabilities(path, { platform: 'darwin', execute });
  expect(report.passed).toBe(true); expect(execute.mock.calls.map(([command]) => command)).toEqual(capabilityCommands);
  expect(report.commands).toHaveLength(6); expect((await readdir(path)).sort()).toHaveLength(13);
  expect(await readFile(join(path, 'xctrace-manual.stdout.log'), 'utf8')).toBe(manual);
  expect(await readFile(join(path, 'xctrace-manual.stderr.log'))).toEqual(Buffer.alloc(0));
  const saved: unknown = JSON.parse(await readFile(join(path, 'manifest.json'), 'utf8'));
  expect(saved).toMatchObject({ passed: true, platform: 'darwin', outputBoundBytes: 1048576, timeoutMs: 15000 });
  expect(report.commands[0]).toMatchObject({ exitCode: 0, signal: null, killed: false, failureCode: null });
});

test.each(['win32', 'linux'] as const)('T-030: Given %s, When collection is requested, Then it refuses before commands or output writes', async (platform) => {
  const path = await directory(); const execute = vi.fn(ordinary);
  await expect(collectMacCapabilities(path, { platform, execute })).rejects.toThrow('macOS only');
  expect(execute).not.toHaveBeenCalled(); expect(await readdir(path)).toEqual([]);
});

const failedCaptures: readonly [string, Partial<CapabilityResult>][] = [
  ['nonzero exit', { exitCode: 7 }], ['signal', { exitCode: null, signal: 'SIGTERM' as const }],
  ['launch failure', { exitCode: null, failureCode: 'ENOENT' }], ['killed process', { exitCode: null, killed: true }],
  ['output limit', { exitCode: null, killed: true, failureCode: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }],
  ['stderr diagnostic', { stderr: Buffer.from('native diagnostic\n') }], ['empty output', { stdout: Buffer.alloc(0) }],
];
test.each(failedCaptures)('T-030: Given %s during discovery, When collection finishes, Then it remains failed and all independent evidence is retained', async (_label, change) => {
  const path = await directory(); const execute = vi.fn(async (command: CapabilityCommand) => command.name === 'os-version' ? { ...success(), ...change } : ordinary(command));
  const report = await collectMacCapabilities(path, { platform: 'darwin', execute });
  expect(report.passed).toBe(false); expect(execute).toHaveBeenCalledTimes(6);
  expect(report.commands[0]).toMatchObject(change.stdout === undefined && change.stderr === undefined ? change : {});
  expect(await readFile(join(path, 'os-version.stdout.log'))).toEqual(change.stdout ?? Buffer.from('ordinary output\n'));
  expect(await readFile(join(path, 'os-version.stderr.log'))).toEqual(change.stderr ?? Buffer.alloc(0));
});

test('T-030: Given a failed or unrecognized installed manual, When template listing syntax cannot be verified, Then no guessed listing executes and the result fails explicitly', async () => {
  const path = await directory(); const execute = vi.fn((command: CapabilityCommand) => Promise.resolve(success(command.name === 'xctrace-manual' ? 'record syntax only\n' : 'ordinary output\n')));
  const report = await collectMacCapabilities(path, { platform: 'darwin', execute });
  expect(report.passed).toBe(false); expect(execute).toHaveBeenCalledTimes(5);
  expect(report.commands[5]).toMatchObject({ failureCode: 'template-list-syntax-unverified', exitCode: null });
  expect(await readFile(join(path, 'xctrace-manual.stdout.log'), 'utf8')).toBe('record syntax only\n');
});

test('T-030: Given an overstruck installed manual, When its fixed list syntax is read, Then the original bytes remain intact and the verified listing executes', async () => {
  const path = await directory(); const raw = manual.replace('list', 'l\bli\bis\bst\bt');
  const execute = vi.fn((command: CapabilityCommand) => Promise.resolve(success(command.name === 'xctrace-manual' ? raw : 'ordinary output\n')));
  const report = await collectMacCapabilities(path, { platform: 'darwin', execute });
  expect(report.passed).toBe(true); expect(execute).toHaveBeenCalledTimes(6);
  expect(await readFile(join(path, 'xctrace-manual.stdout.log'), 'utf8')).toBe(raw);
});

test('T-030: Given an executor exception, When independent commands continue, Then the capture failure is explicit and cannot become success', async () => {
  const path = await directory(); const execute = vi.fn(async (command: CapabilityCommand) => { if (command.name === 'os-version') { throw new Error('capture unavailable'); } return ordinary(command); });
  const report = await collectMacCapabilities(path, { platform: 'darwin', execute });
  expect(report.passed).toBe(false); expect(execute).toHaveBeenCalledTimes(6);
  expect(report.commands[0]).toMatchObject({ failureCode: 'executor-threw', exitCode: null });
});

test('T-030: Given existing evidence, When collection is requested, Then it refuses before commands and preserves every original byte', async () => {
  const path = await directory(); await writeFile(join(path, 'manifest.json'), 'existing evidence'); const execute = vi.fn(ordinary);
  await expect(collectMacCapabilities(path, { platform: 'darwin', execute })).rejects.toThrow('empty evidence directory');
  expect(execute).not.toHaveBeenCalled(); expect(await readFile(join(path, 'manifest.json'), 'utf8')).toBe('existing evidence');
});

test('T-030: Given a real child with non-UTF8 output and a nonzero exit, When captured, Then both byte streams and the original failure survive', async () => {
  const result = await executeCapability({ name: 'binary fixture', command: process.execPath,
    args: ['-e', 'process.stdout.write(Buffer.from([255,0,97]),()=>{process.stderr.write(Buffer.from([254,0,98]),()=>process.exit(7))})'] });
  expect(result.stdout).toEqual(Buffer.from([255, 0, 97])); expect(result.stderr).toEqual(Buffer.from([254, 0, 98]));
  expect(result.exitCode).toBe(7); expect(result.failureCode).toBeNull();
});

test('T-030: Given a missing tool, When captured, Then launch failure remains explicit with empty output', async () => {
  const result = await executeCapability({ name: 'missing', command: 'lite-voyager-missing-capability-tool', args: [] });
  expect(result.failureCode).toBe('ENOENT'); expect(result.exitCode).toBeNull(); expect(result.stdout.length + result.stderr.length).toBe(0);
});

test('T-030: Given a tool ignoring SIGTERM, When its deadline expires, Then forced termination prevents indefinite capture', async () => {
  const result = await executeCapability({ name: 'deadline', command: process.execPath,
    args: ['-e', 'process.on("SIGTERM",()=>{});process.stdout.write("ready");setInterval(()=>{},50)'] }, { timeoutMs: 1000 });
  expect(result.stdout.toString()).toBe('ready'); expect(result.killed).toBe(true);
  expect(result.exitCode !== null || result.signal !== null).toBe(true);
  if (process.platform !== 'win32') { expect(result.signal).toBe('SIGKILL'); }
});

test('T-030: Given excessive tool output, When its byte bound is exceeded, Then a bounded prefix and explicit failure are retained', async () => {
  const result = await executeCapability({ name: 'bounded', command: process.execPath, args: ['-e', 'process.stdout.write(Buffer.alloc(32768,97));setInterval(()=>{},50)'] }, { maxBuffer: 1024 });
  expect(result.failureCode).toBe('ERR_CHILD_PROCESS_STDIO_MAXBUFFER'); expect(result.stdout.length).toBeLessThanOrEqual(1024);
  expect(result.killed).toBe(true); expect(result.exitCode !== null || result.signal !== null).toBe(true);
});

test('T-030: Given the native capability workflow, When configured, Then it is manual-only, scoped to macOS and retains evidence without changing verification', async () => {
  const text = await readFile('.github/workflows/macos-native-capabilities.yml', 'utf8');
  expect(text).toMatch(/^on:\s*workflow_dispatch\s*$/m); expect(text).toMatch(/runs-on: macos-latest/);
  expect(text).toMatch(/contents: read/); expect(text).toMatch(/persist-credentials: false/);
  expect(text).toContain('node scripts/macos-native-capabilities.mts'); expect(text).toContain('out/macos-native-capabilities-*/');
  expect(text).toMatch(/retention-days: 7/); expect(text).toMatch(/if-no-files-found: error/);
  expect(text).toContain("steps.capabilities.outcome == 'failure'");
  expect(text).not.toMatch(/pull_request|\bpush:|verify:full|continue-on-error|--attach|--launch|sudo|npm (?:ci|install)|include-hidden-files/);
});
