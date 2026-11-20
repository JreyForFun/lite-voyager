import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { checkIntegrationLogs, formatApprovedHostDiagnostics } from '../../scripts/integration-logs.mts';
import { runCheck } from '../../scripts/checks.mts';

const directories: string[] = [];
// Exact record from the 2026-11-20 short-TEMP verify:full (renderer.log line 2).
const source = '20261120T192754/window1/renderer.log';
const timestamp = '2026-11-20 19:27:58.966';
const message = "Creation of workbench contribution 'chat.usagesTool' took 21ms.";

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});
async function log(contents: string, name = source): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-host009-'));
  directories.push(directory);
  const file = join(directory, name);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
  return directory;
}

test.each(['0', '21', '999999'])(
  'T-033: Given exact HOST-009 duration %s in the renderer, When checked, Then original diagnostic metadata is retained',
  async (duration) => {
    const text = message.replace('21ms.', `${duration}ms.`);
    const directory = await log(`${timestamp} [info] Startup.\n${timestamp} [warning] ${text}\n`);
    await expect(checkIntegrationLogs(directory)).resolves.toEqual([
      { source, line: 2, severity: 'warning', rule: 'VSCODE-HOST-009', message: text },
    ]);
  },
);

test.each(['-21', '+21', '21.5', 'unknown', '', '２１', '1e2', '21 ms'])(
  'T-033: Given malformed HOST-009 duration %s, When checked, Then validation rejects it',
  async (duration) => {
    const text = message.replace('21ms.', `${duration}ms.`);
    const directory = await log(`${timestamp} [warning] ${text}\n`);
    await expect(checkIntegrationLogs(directory)).rejects.toThrow(text);
  },
);

test.each([
  message.replace('chat.usagesTool', 'chatXusagesTool'),
  message.replace('usagesTool', 'usagesToolExtra'),
  message.replace('usagesTool', 'otherUsagesTool'),
  message.replace('chat.usagesTool', 'workbench.contrib.usagesTool'),
  `Unexpected: ${message}`, `${message} Additional failure.`, message.slice(0, -1),
])('T-033: Given altered HOST-009 wording %s, When checked, Then exact matching rejects it', async (text) => {
  const directory = await log(`${timestamp} [warning] ${text}\n`);
  await expect(checkIntegrationLogs(directory)).rejects.toThrow(text);
});

test.each([
  { name: source, prefix: `${timestamp} [error] ` },
  { name: source, prefix: '[warning] ' },
  { name: '20261120T192754/window1/exthost.log', prefix: `${timestamp} [warning] ` },
  { name: '20261120T192754/main.log', prefix: `${timestamp} [warning] ` },
  { name: 'window1/renderer.log', prefix: `${timestamp} [warning] ` },
  { name: '20261120T192754/window1/exthost/renderer.log', prefix: `${timestamp} [warning] ` },
  { name: '20261120/window1/renderer.log', prefix: `${timestamp} [warning] ` },
  { name: '20261120T192754/windowX/renderer.log', prefix: `${timestamp} [warning] ` },
])('T-033: Given HOST-009 source $name and prefix $prefix, When checked, Then invalid source or severity fails', async ({ name, prefix }) => {
  const directory = await log(`${prefix}${message}\n`, name);
  await expect(checkIntegrationLogs(directory)).rejects.toThrow(message);
});

test.each(['warning', 'error'])(
  'T-033: Given HOST-009 with an unrelated %s, When checked, Then both the rejection and approved metadata are retained',
  async (severity) => {
    const directory = await log(`${timestamp} [warning] ${message}\n${timestamp} [${severity}] Application defect.\n`);
    await expect(checkIntegrationLogs(directory)).rejects.toThrow('Application defect.');
    await expect(checkIntegrationLogs(directory)).rejects.toThrow(JSON.stringify({ source, line: 1,
      severity: 'warning', rule: 'VSCODE-HOST-009', message }));
  },
);

test('T-033: Given approved HOST-009, When crossing the console gate, Then complete metadata is reported without suppressing warnings', async () => {
  const directory = await log(`${timestamp} [warning] ${message}\n`);
  const report = formatApprovedHostDiagnostics(await checkIntegrationLogs(directory));
  expect(JSON.parse(report.trim().split('\n')[1] ?? 'null')).toEqual({ source, line: 1, severity: 'warning', rule: 'VSCODE-HOST-009', message });
  await expect(runCheck({ name: 'HOST-009 report', command: process.execPath,
    args: ['-e', `process.stdout.write(${JSON.stringify(report)})`],
  }, { echo: false })).resolves.toBeUndefined();
  await expect(runCheck({ name: 'HOST-009 unrelated console diagnostic', command: process.execPath,
    args: ['-e', `process.stdout.write(${JSON.stringify(report)}); console.log('[warning] Application defect.');`],
  }, { echo: false })).rejects.toThrow('emitted a warning');
});

test.each(['warning', 'error'])(
  'T-033: Given a literal HOST-009 console %s, When outside saved renderer logs, Then the strict console gate rejects it',
  async (severity) => {
    await expect(runCheck({ name: 'HOST-009 literal console diagnostic', command: process.execPath,
      args: ['-e', `console.log(${JSON.stringify(`[${severity}] ${message}`)})`],
    }, { echo: false })).rejects.toThrow(`emitted ${severity === 'error' ? 'an error' : 'a warning'}`);
  },
);
