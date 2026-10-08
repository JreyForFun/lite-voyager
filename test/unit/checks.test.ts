import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { runCheck, runChecks } from '../../scripts/checks.mts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('verification gate', () => {
  test('T-006: Given a successful command, When checked, Then ordinary output is accepted', async () => {
    await expect(runCheck({ name: 'success', command: process.execPath, args: ['-e', 'console.log("ok")'] }, { echo: false })).resolves.toBeUndefined();
  });

  test('T-006: Given a failing command, When checked, Then its nonzero exit rejects verification', async () => {
    await expect(runCheck({ name: 'failure', command: process.execPath, args: ['-e', 'process.exit(7)'] }, { echo: false })).rejects.toThrow('exit code 7');
  });

  test.each([
    'console.warn("Warning: fixture diagnostic")',
    'console.log("WARN fixture diagnostic")',
    'process.emitWarning("fixture diagnostic", "DeprecationWarning")',
  ])('T-006: Given a zero-exit command emitting a diagnostic, When checked, Then verification rejects it (%s)', async (source) => {
    await expect(runCheck({ name: 'diagnostic', command: process.execPath, args: ['-e', source] }, { echo: false })).rejects.toThrow('emitted a warning');
  });

  test('T-006: Given a missing executable, When checked, Then verification reports the launch failure', async () => {
    await expect(runCheck({ name: 'missing', command: 'lite-voyager-nonexistent-test-executable', args: [] }, { echo: false })).rejects.toThrow('could not start');
  });

  test('T-006: Given a zero-exit command emitting an error, When checked, Then verification rejects it', async () => {
    await expect(runCheck({ name: 'error diagnostic', command: process.execPath, args: ['-e', 'console.error("ERROR fixture diagnostic")'] }, { echo: false })).rejects.toThrow('emitted an error');
  });

  test('T-006: Given a failed stage, When verification runs, Then later stages never run', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-gate-'));
    temporaryDirectories.push(directory);
    const marker = join(directory, 'later-stage.txt');
    await expect(runChecks([
      { name: 'failure', command: process.execPath, args: ['-e', 'process.exit(2)'] },
      { name: 'later', command: process.execPath, args: ['-e', 'require("node:fs").writeFileSync(process.argv[1], "ran")', marker] },
    ], { echo: false })).rejects.toThrow('exit code 2');
    await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
