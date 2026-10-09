import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { checkIntegrationLogs, formatApprovedHostDiagnostics } from '../../scripts/integration-logs.mts';
import { runCheck } from '../../scripts/checks.mts';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createLog(contents: string, filename = 'renderer.log'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-log-test-'));
  directories.push(directory);
  const logDirectory = join(directory, '20261009T153247', 'window1');
  await mkdir(logDirectory, { recursive: true });
  await writeFile(join(logDirectory, filename), contents);
  return directory;
}

test('T-006: Given clean VS Code logs, When checked, Then informational startup messages are accepted', async () => {
  const directory = await createLog('2026-10-09 00:00:00.000 [info] Extension loaded.\n');
  await expect(checkIntegrationLogs(directory)).resolves.toEqual([]);
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

test.each([
  'Failed to create default profile extensions manifest in extensions installation folder.',
  "[chat-stt] could not refresh GitHub session state for cloud dictation Timed out waiting for authentication provider 'github' to register.",
])('T-007: Given the reported CI warning %s, When logs are checked, Then verification still rejects it', async (message) => {
  const directory = await createLog(`2026-10-09 15:32:58.326 [warning] ${message}\n`);
  await expect(checkIntegrationLogs(directory)).rejects.toThrow(message);
});

const cloudMessage = "[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]";
const timingMessage = "Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 24ms.";

test.each([
  { rule: 'VSCODE-HOST-001', message: cloudMessage },
  { rule: 'VSCODE-HOST-002', message: timingMessage },
])('T-007: Given approved renderer diagnostic $rule, When checked, Then its severity source and message are returned for explicit reporting', async ({ rule, message }) => {
  const directory = await createLog(`2026-10-09 15:32:58.326 [warning] ${message}\n`);
  await expect(checkIntegrationLogs(directory)).resolves.toEqual([{
    source: '20261009T153247/window1/renderer.log', line: 1, severity: 'warning', rule, message,
  }]);
});

test.each([
  cloudMessage.replace('repo, workflow', 'repo'),
  `${cloudMessage} Unexpected failure.`,
  timingMessage.replace('chatLanguageModelsData', 'liteVoyager'),
  timingMessage.replace('24ms.', 'unknownms.'),
])('T-007: Given a similar unapproved host message %s, When checked, Then it still fails', async (message) => {
  const directory = await createLog(`2026-10-09 15:32:58.326 [warning] ${message}\n`);
  await expect(checkIntegrationLogs(directory)).rejects.toThrow(message);
});

test.each([cloudMessage, timingMessage])('T-007: Given approved wording %s recorded as an error, When checked, Then the error still fails', async (message) => {
  const directory = await createLog(`2026-10-09 15:32:58.326 [error] ${message}\n`);
  await expect(checkIntegrationLogs(directory)).rejects.toThrow('[error]');
});

test.each([cloudMessage, timingMessage])('T-007: Given approved wording %s from the extension host, When checked, Then source restrictions reject it', async (message) => {
  const directory = await createLog(`2026-10-09 15:32:58.326 [warning] ${message}\n`, 'exthost.log');
  await expect(checkIntegrationLogs(directory)).rejects.toThrow(message);
});

test('T-007: Given an approved diagnostic followed by an application error, When checked, Then the error fails and the approved diagnostic is still reported', async () => {
  const directory = await createLog(`2026-10-09 15:32:58.326 [warning] ${cloudMessage}\n2026-10-09 15:32:59.000 [error] Query failed.\n`);
  await expect(checkIntegrationLogs(directory)).rejects.toThrow('Query failed');
  await expect(checkIntegrationLogs(directory)).rejects.toThrow('VSCODE-HOST-001');
});

test('T-007: Given approved host diagnostics, When the report crosses the console gate, Then source severity rule and message remain visible without weakening console checks', async () => {
  const directory = await createLog(`2026-10-09 15:32:58.326 [warning] ${cloudMessage}\n`);
  const report = formatApprovedHostDiagnostics(await checkIntegrationLogs(directory));
  const record: unknown = JSON.parse(report.trim().split('\n')[1] ?? 'null');
  expect(record).toEqual({
    source: '20261009T153247/window1/renderer.log', line: 1, severity: 'warning', rule: 'VSCODE-HOST-001', message: cloudMessage,
  });
  await expect(runCheck({ name: 'approved host report', command: process.execPath,
    args: ['-e', `process.stdout.write(${JSON.stringify(report)})`],
  }, { echo: false })).resolves.toBeUndefined();
  await expect(runCheck({ name: 'unapproved console diagnostic', command: process.execPath,
    args: ['-e', 'console.log("[warning] Application warning")'],
  }, { echo: false })).rejects.toThrow('emitted a warning');
});
