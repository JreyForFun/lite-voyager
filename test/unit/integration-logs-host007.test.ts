import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { checkIntegrationLogs, formatApprovedHostDiagnostics } from '../../scripts/integration-logs.mts';
import { runCheck } from '../../scripts/checks.mts';

const directories: string[] = [];
const source = '20261031T132559/window1/renderer.log';
const timestamp = '2026-10-31 13:26:04.774';
const message = "Creation of workbench contribution 'workbench.contrib.dynamicWindowConfiguration' took 116ms.";
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});
async function log(contents: string, name = source): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-host007-'));
  directories.push(directory);
  const file = join(directory, name);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
  return directory;
}

test.each(['0', '116', '999999'])(
  'T-030: Given exact HOST-007 duration %s in the renderer, When checked, Then original diagnostic metadata is retained',
  async (duration) => {
    const text = message.replace('116ms.', `${duration}ms.`);
    const directory = await log(`${timestamp} [info] Startup.\n${timestamp} [warning] ${text}\n`);
    await expect(checkIntegrationLogs(directory)).resolves.toEqual([
      { source, line: 2, severity: 'warning', rule: 'VSCODE-HOST-007', message: text },
    ]);
  },
);

test.each(['-116', '+116', '116.5', 'unknown', '', '１１６', '1e2', '116 ms'])(
  'T-030: Given malformed HOST-007 duration %s, When checked, Then validation rejects it',
  async (duration) => {
    const text = message.replace('116ms.', `${duration}ms.`);
    const directory = await log(`${timestamp} [warning] ${text}\n`);
    await expect(checkIntegrationLogs(directory)).rejects.toThrow(text);
  },
);

test.each([
  message.replace('workbench.contrib.', 'workbenchXcontribX'),
  message.replace('dynamicWindowConfiguration', 'dynamicWindowConfigurationExtra'),
  message.replace('dynamicWindowConfiguration', 'otherWindowConfiguration'),
  `Unexpected: ${message}`, `${message} Additional failure.`, message.slice(0, -1),
])('T-030: Given altered HOST-007 wording %s, When checked, Then exact matching rejects it', async (text) => {
  const directory = await log(`${timestamp} [warning] ${text}\n`);
  await expect(checkIntegrationLogs(directory)).rejects.toThrow(text);
});

test.each([
  { name: source, prefix: `${timestamp} [error] ` },
  { name: source, prefix: '[warning] ' },
  { name: '20261031T132559/window1/exthost.log', prefix: `${timestamp} [warning] ` },
  { name: '20261031T132559/main.log', prefix: `${timestamp} [warning] ` },
  { name: 'window1/renderer.log', prefix: `${timestamp} [warning] ` },
  { name: '20261031T132559/window1/exthost/renderer.log', prefix: `${timestamp} [warning] ` },
  { name: '20261031/window1/renderer.log', prefix: `${timestamp} [warning] ` },
  { name: '20261031T132559/windowX/renderer.log', prefix: `${timestamp} [warning] ` },
])('T-030: Given HOST-007 source $name and prefix $prefix, When checked, Then invalid source or severity fails', async ({ name, prefix }) => {
  const directory = await log(`${prefix}${message}\n`, name);
  await expect(checkIntegrationLogs(directory)).rejects.toThrow(message);
});

test.each(['warning', 'error'])(
  'T-030: Given HOST-007 with an unrelated %s, When checked, Then both the rejection and approved metadata are retained',
  async (severity) => {
    const directory = await log(`${timestamp} [warning] ${message}\n${timestamp} [${severity}] Application defect.\n`);
    await expect(checkIntegrationLogs(directory)).rejects.toThrow('Application defect.');
    await expect(checkIntegrationLogs(directory)).rejects.toThrow(JSON.stringify({ source, line: 1,
      severity: 'warning', rule: 'VSCODE-HOST-007', message }));
  },
);

test('T-030: Given approved HOST-007, When crossing the console gate, Then complete metadata is reported without suppressing warnings', async () => {
  const directory = await log(`${timestamp} [warning] ${message}\n`);
  const report = formatApprovedHostDiagnostics(await checkIntegrationLogs(directory));
  expect(JSON.parse(report.trim().split('\n')[1] ?? 'null')).toEqual({ source, line: 1, severity: 'warning', rule: 'VSCODE-HOST-007', message });
  await expect(runCheck({ name: 'HOST-007 report', command: process.execPath,
    args: ['-e', `process.stdout.write(${JSON.stringify(report)})`],
  }, { echo: false })).resolves.toBeUndefined();
  await expect(runCheck({ name: 'HOST-007 unrelated console diagnostic', command: process.execPath,
    args: ['-e', `process.stdout.write(${JSON.stringify(report)}); console.log('[warning] Application defect.');`],
  }, { echo: false })).rejects.toThrow('emitted a warning');
});

test.each(['warning', 'error'])(
  'T-030: Given a literal HOST-007 console %s, When outside saved renderer logs, Then the strict console gate rejects it',
  async (severity) => {
    await expect(runCheck({ name: 'HOST-007 literal console diagnostic', command: process.execPath,
      args: ['-e', `console.log(${JSON.stringify(`[${severity}] ${message}`)})`],
    }, { echo: false })).rejects.toThrow(`emitted ${severity === 'error' ? 'an error' : 'a warning'}`);
  },
);
