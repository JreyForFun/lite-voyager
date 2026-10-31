import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { runCheck } from '../../scripts/checks.mts';
import { checkIntegrationLogs } from '../../scripts/integration-logs.mts';
import { validateIntegrationRun } from '../../scripts/integration-validation.mts';

const directories: string[] = [];
const approved = "[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]";

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function logs(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lv-integration-validation-'));
  directories.push(directory);
  const window = join(directory, '20261031T055851', 'window1');
  await mkdir(window, { recursive: true });
  await writeFile(join(window, 'renderer.log'), contents);
  return directory;
}

test('T-030: Given a zero-exit host with a GPU console error and a saved renderer error, When validation finishes, Then both failures and exact approved records survive one log scan', async () => {
  const directory = await logs(`2026-10-31 05:58:51.365 [error] Renderer evidence must survive.\n2026-10-31 05:58:51.366 [warning] ${approved}\n`);
  const events: string[] = [];
  await expect(validateIntegrationRun(async () => {
    events.push('host');
    await runCheck({ name: 'Fixture host', command: process.execPath, args: ['-e',
      'process.stderr.write("[8580:1031/055851.366054:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.\\n");',
    ] }, { echo: false });
  }, async () => { events.push('logs'); return checkIntegrationLogs(directory); }, () => { events.push('report'); }))
    .rejects.toThrow(/Fixture host emitted an error; verification requires zero errors\.[\s\S]*renderer\.log:1:[\s\S]*Renderer evidence must survive[\s\S]*VSCODE-HOST-001/);
  expect(events).toEqual(['host', 'logs']);
});

test('T-030: Given failed host assertions and clean runtime logs, When validation finishes, Then it reports approved warnings and rethrows the original host failure without retry', async () => {
  const directory = await logs(`2026-10-31 05:58:51.366 [warning] ${approved}\n`);
  const failure = new Error('Original host assertion failed');
  const events: string[] = [];
  await expect(validateIntegrationRun(() => { events.push('host'); return Promise.reject(failure); },
    async () => { events.push('logs'); return checkIntegrationLogs(directory); },
    (message) => { events.push('report'); expect(message).toContain('VSCODE-HOST-001'); expect(message).toContain(approved); }))
    .rejects.toBe(failure);
  expect(events).toEqual(['host', 'logs', 'report']);
});

test('T-030: Given a successful host and an unavailable runtime-log directory, When validation finishes, Then missing evidence still fails', async () => {
  const directory = await logs('2026-10-31 05:58:51.366 [info] Fixture\n');
  await expect(validateIntegrationRun(async () => {}, () => checkIntegrationLogs(join(directory, 'missing')), () => {})).rejects.toThrow('ENOENT');
});

test('T-030: Given a successful host and an unapproved runtime warning, When validation finishes, Then the unchanged warning gate still fails', async () => {
  const directory = await logs('2026-10-31 05:58:51.366 [warning] Unapproved fixture warning\n');
  await expect(validateIntegrationRun(async () => {}, () => checkIntegrationLogs(directory), () => {})).rejects.toThrow('Unapproved fixture warning');
});

test('T-030: Given a successful host and accepted runtime logs, When validation finishes, Then validation succeeds and reports exact approved metadata once', async () => {
  const directory = await logs(`2026-10-31 05:58:51.366 [warning] ${approved}\n`);
  const reports: string[] = [];
  await expect(validateIntegrationRun(async () => {}, () => checkIntegrationLogs(directory), (message) => { reports.push(message); })).resolves.toBeUndefined();
  expect(reports).toHaveLength(1);
  expect(reports[0]).toContain('20261031T055851/window1/renderer.log');
  expect(reports[0]).toContain('"severity":"warning","rule":"VSCODE-HOST-001"');
});
