import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { checkIntegrationLogs } from '../../scripts/integration-logs.mts';

const directories: string[] = [];
const warning = '2026-11-02 14:39:47.953 [warning] [File Watcher (node.js)] Watcher shutdown because watched path got deleted';
const trace = (value: string): string => `2026-11-02 14:39:47.953 [trace] [File Watcher (node.js)] ${value}`;

afterEach(async () => {
  for (const directory of directories.splice(0)) { await rm(directory, { recursive: true, force: true }); }
});

async function logs(contents: string, filename = 'fileWatcher.log'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-watcher-'));
  directories.push(directory);
  const window = join(directory, '20261102T143927', 'window1');
  await mkdir(window, { recursive: true });
  await writeFile(join(window, filename), contents);
  return directory;
}

async function failure(directory: string): Promise<string> {
  try { await checkIntegrationLogs(directory); }
  catch (error: unknown) { expect(error).toBeInstanceOf(Error); return (error as Error).message; }
  throw new Error('The strict diagnostic gate unexpectedly accepted a watcher failure.');
}

test('T-030: Given a watcher deletion with adjacent native trace, When strict scanning fails, Then exact diagnostic metadata and before/after path evidence survive', async () => {
  const directory = await logs([trace('watching /owned/source.sqlite'), warning, trace(' >> normalized [DELETED] /owned/source.sqlite'),
    '2026-11-02 14:39:47.954 [error] A separate defect.',
    '2026-11-02 14:39:47.955 [info] Unrelated cell payload.'].join('\n'));
  const message = await failure(directory);
  expect(message).toContain(`20261102T143927/window1/fileWatcher.log:2: ${warning}`);
  expect(message).toContain('A separate defect.');
  expect(message).toContain('VS Code watcher context');
  expect(message).toContain('watching /owned/source.sqlite');
  expect(message).toContain('normalized [DELETED] /owned/source.sqlite');
  expect(message).toContain('"line":3');
  expect(message).not.toContain('Unrelated cell payload.');
});

test('T-030: Given duplicate renderer/file-watcher deletion records without trace, When scanned, Then both remain failures and absent path evidence is explicit', async () => {
  const directory = await logs(warning);
  await writeFile(join(directory, '20261102T143927', 'window1', 'renderer.log'), warning);
  const message = await failure(directory);
  expect(message).toContain('window1/fileWatcher.log:1:');
  expect(message).toContain('window1/renderer.log:1:');
  expect(message).toContain('No adjacent watcher trace records');
});

test('T-030: Given extensive watcher trace and a very long watched path, When failure context is reported, Then output is bounded with explicit truncation and all severity records remain', async () => {
  const contents = Array.from({ length: 80 }, (_, index) => [trace(`watching ${String(index)} /${'x'.repeat(3000)}`), warning]).flat();
  contents.push('2026-11-02 14:40:00.000 [error] Final defect beyond context capacity.');
  const message = await failure(await logs(contents.join('\n')));
  const context = message.slice(message.indexOf('VS Code watcher context'));
  expect(context.slice(context.indexOf('\n') + 1).length).toBeLessThanOrEqual(16384);
  expect(context).toContain('truncated');
  expect(message).toContain('fileWatcher.log:161:');
  expect(message).toContain('Final defect beyond context capacity.');
});

test('T-030: Given ordinary watcher trace without a diagnostic, When scanned, Then trace is accepted without inventing a warning', async () => {
  await expect(checkIntegrationLogs(await logs(trace('watching /owned/source.sqlite')))).resolves.toEqual([]);
});

test('T-030: Given watcher failures across many windows, When context capacity is reached, Then the shared bound applies and every diagnostic is still reported', async () => {
  const directory = await logs(warning);
  for (let index = 2; index <= 80; index++) {
    const window = join(directory, '20261102T143927', `window${String(index)}`);
    await mkdir(window);
    await writeFile(join(window, 'fileWatcher.log'), warning);
  }
  const message = await failure(directory);
  expect(message).toContain('window80/fileWatcher.log:1:');
  const context = message.slice(message.indexOf('VS Code watcher context'));
  expect(context.slice(context.indexOf('\n') + 1).length).toBeLessThanOrEqual(16384);
  expect(context.trim().split('\n').length).toBeLessThanOrEqual(65);
  expect(context).toContain('truncated');
});
