import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const execute = promisify(execFile);

test('T-006: Given an integration run, When its configuration loads, Then installed and built-in extensions use empty isolated directories', async () => {
  const output = resolve('out');
  await mkdir(output, { recursive: true });
  const profile = await mkdtemp(join(output, 'integration-profile-config-test-'));
  try {
    const { stdout } = await execute(process.execPath, [
      '--input-type=module', '-e',
      'const { default: config } = await import("./.vscode-test.mjs"); console.log(JSON.stringify(config.launchArgs));',
    ], { cwd: resolve('.'), env: { ...process.env, LITE_VOYAGER_TEST_PROFILE: profile } });
    const args: unknown = JSON.parse(stdout);
    expect(args).toEqual(expect.arrayContaining([
      `--extensions-dir=${join(profile, 'extensions')}`,
      `--builtin-extensions-dir=${join(profile, 'builtin-extensions')}`,
    ]));
    expect(await readdir(join(profile, 'extensions'))).toEqual([]);
    expect(await readdir(join(profile, 'builtin-extensions'))).toEqual([]);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});
