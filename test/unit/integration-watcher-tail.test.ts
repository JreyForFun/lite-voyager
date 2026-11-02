import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { readWatcherProbeTail } from '../../scripts/integration-watcher-probe.mts';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) { await rm(directory, { recursive: true, force: true }); } });
async function profile(contents?: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-tail-')); directories.push(directory);
  const window = join(directory, 'logs', '20261102T143927', 'window1'); await mkdir(window, { recursive: true });
  if (contents !== undefined) { await writeFile(join(window, 'fileWatcher.log'), contents); }
  return directory;
}

test('T-030: Given an unreadable or absent watcher log, When reading probe evidence, Then the error is catchable without a false trace report', async () => {
  await expect(readWatcherProbeTail(await profile())).rejects.toThrow('ENOENT');
});

test('T-030: Given a warning-only probe log, When trace was not enabled, Then the missing trace evidence fails explicitly', async () => {
  await expect(readWatcherProbeTail(await profile('2026-11-02 00:00:00.000 [warning] [File Watcher (node.js)] Watcher shutdown because watched path got deleted'))).rejects.toThrow('No native watcher trace');
});

test('T-030: Given extensive native trace and JSON-escaped long paths, When reading probe evidence, Then only a bounded recent tail with exact line numbers is returned', async () => {
  const contents = Array.from({ length: 200 }, (_, index) => `2026-11-02 00:00:00.000 [trace] [File Watcher (node.js)] watching ${String(index)} ${'\\'.repeat(3000)}`).join('\n');
  const records = await readWatcherProbeTail(await profile(contents));
  expect(records.length).toBeLessThanOrEqual(64);
  expect(records.join('\n').length + 1).toBeLessThanOrEqual(16384);
  const last: unknown = JSON.parse(records.at(-1) ?? 'null');
  expect(last).toMatchObject({ source: '20261102T143927/window1/fileWatcher.log', line: 200 });
  const texts = records.map((record) => (JSON.parse(record) as { text: string }).text);
  expect(texts.every((text) => text.length <= 1024 && text.endsWith('[truncated]'))).toBe(true);
  expect(texts.at(-1)).toContain('watching 199');
});
