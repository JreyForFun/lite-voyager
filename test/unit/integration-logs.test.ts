import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { checkIntegrationLogs } from '../../scripts/integration-logs.mts';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createLog(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-log-test-'));
  directories.push(directory);
  const logDirectory = join(directory, 'session', 'window1');
  await mkdir(logDirectory, { recursive: true });
  await writeFile(join(logDirectory, 'renderer.log'), contents);
  return directory;
}

test('T-006: Given clean VS Code logs, When checked, Then informational startup messages are accepted', async () => {
  const directory = await createLog('2026-10-09 00:00:00.000 [info] Extension loaded.\n');
  await expect(checkIntegrationLogs(directory)).resolves.toBeUndefined();
});

test.each(['warning', 'error'])(
  'T-006: Given a structured %s absent from console labels, When checked, Then full verification rejects it',
  async (severity) => {
    const directory = await createLog(`2026-10-09 00:00:00.000 [${severity}] Extension metadata does not match.\n`);
    await expect(checkIntegrationLogs(directory)).rejects.toThrow(`[${severity}]`);
  },
);

test('T-006: Given no VS Code log files, When checked, Then full verification fails rather than claiming a clean run', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-empty-logs-'));
  directories.push(directory);
  await expect(checkIntegrationLogs(directory)).rejects.toThrow('No VS Code log files');
});
