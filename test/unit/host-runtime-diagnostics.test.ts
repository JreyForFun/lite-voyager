import { join } from 'node:path';
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, expect, test, vi } from 'vitest';
import { captureHostRuntime } from '../../src/test/host-runtime-diagnostics';
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) { await rm(root, { recursive: true, force: true }); } });
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'lv-host-snapshot-')); roots.push(root);
  const profile = join(root, 'out', 'integration-profile-status'); await mkdir(profile, { recursive: true }); return { root, profile }; }
function windowsRows(profile: string) { return [
  { pid: 10, parent: 1, command: `Code.exe --user-data-dir="${profile}" --disable-gpu` },
  { pid: 20, parent: 10, command: 'Code.exe --type=extensionHost' },
  { pid: 30, parent: 10, command: 'Code.exe --type=gpu-process --use-angle=swiftshader-webgl' },
  { pid: 40, parent: 1, command: `Code.exe --user-data-dir="${profile}-owner" PRIVATE_OWNER_ARGUMENT` },
]; }

test('NFR-005: Given an isolated profile, When collecting passive host status, Then one bounded OS reader observes only its process tree without launching Code or a GPU query', async () => {
  const { root, profile } = await fixture();
  const execute = vi.fn().mockResolvedValue({ stdout: JSON.stringify(windowsRows(profile)), stderr: '' });
  const result = await captureHostRuntime(root, profile, 20, execute, 'win32');
  expect(result.processes.map((row) => row.pid)).toEqual([10, 20, 30]); expect(JSON.stringify(result)).not.toContain('PRIVATE_OWNER');
  expect(execute.mock.calls[0]?.[0]).toBe('powershell.exe'); expect(JSON.stringify(execute.mock.calls)).not.toContain('--status');
  const options: unknown = execute.mock.calls[0]?.[2];
  expect(options).toMatchObject({ timeout: 15000, maxBuffer: 1048576, windowsHide: true });
});

test('NFR-005: Given a profile outside owned output, When status is requested, Then collection refuses before starting another Code instance', async () => {
  const execute = vi.fn();
  const { root } = await fixture();
  await expect(captureHostRuntime(root, join(root, 'owner-profile'), 20, execute)).rejects.toThrow(/isolated/);
  expect(execute).not.toHaveBeenCalled();
});

test('NFR-005: Given failed or truncated host-status collection, When awaiting diagnostics, Then the original failure is retained rather than reporting success', async () => {
  const execute = vi.fn().mockRejectedValue(new Error('status deadline')); const { root, profile } = await fixture();
  await expect(captureHostRuntime(root, profile, 20, execute, 'win32')).rejects.toThrow('status deadline');
});

test('NFR-005: Given a linked profile, When snapshot ownership is checked, Then an owner profile cannot be targeted even by an integration-looking path', async () => {
  const { root, profile } = await fixture(); const owner = join(root, 'owner'); await mkdir(owner); await rm(profile, { recursive: true });
  await symlink(owner, profile, process.platform === 'win32' ? 'junction' : 'dir'); const execute = vi.fn();
  await expect(captureHostRuntime(root, profile, 20, execute)).rejects.toThrow(/isolated|linked/); expect(execute).not.toHaveBeenCalled();
});

test.each(['darwin', 'linux'] as const)('NFR-005: Given a passive %s snapshot, When selecting the isolated host, Then ps command lines are scoped to its tree and no graphics backend is inferred', async (platform) => {
  const { root, profile } = await fixture(); const execute = vi.fn().mockResolvedValue({ stdout: windowsRows(profile).map((row) => `${String(row.pid)} ${String(row.parent)} ${row.command}`).join('\n'), stderr: '' });
  const result = await captureHostRuntime(root, profile, 20, execute, platform);
  expect(execute.mock.calls[0]?.[0]).toBe('ps'); expect(result.processes.map((row) => row.pid)).toEqual([10, 20, 30]);
  expect(result.scope).toContain('not proof');
});

test.each(['missing-host', 'malformed', 'stderr'] as const)('NFR-005: Given %s snapshot evidence, When validating collection, Then uncertainty fails rather than producing a successful diagnostic', async (kind) => {
  const { root, profile } = await fixture(); const execute = vi.fn().mockResolvedValue({
    stdout: kind === 'malformed' ? 'invalid-json' : JSON.stringify(windowsRows(profile).filter((row) => kind !== 'missing-host' || row.pid !== 20)),
    stderr: kind === 'stderr' ? 'collector diagnostic' : '',
  });
  await expect(captureHostRuntime(root, profile, 20, execute, 'win32')).rejects.toThrow();
});
