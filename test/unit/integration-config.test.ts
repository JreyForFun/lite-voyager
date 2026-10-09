import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const execute = promisify(execFile);

test('NFR-002: Given a compatibility version, When configuration loads, Then the exact requested VS Code version is selected', async () => {
  const { stdout } = await execute(process.execPath, ['--input-type=module', '-e',
    'const { default: config } = await import("./.vscode-test.mjs"); console.log(config.version);',
  ], { env: { ...process.env, LITE_VOYAGER_TEST_VSCODE_VERSION: '1.141.0' } });
  expect(stdout.trim()).toBe('1.141.0');
});

test('NFR-002: Given an invalid compatibility version, When configuration loads, Then it fails instead of silently choosing a version', async () => {
  await expect(execute(process.execPath, ['--input-type=module', '-e', 'await import("./.vscode-test.mjs");'],
    { env: { ...process.env, LITE_VOYAGER_TEST_VSCODE_VERSION: 'latest' } })).rejects.toThrow();
});

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
    // An empty manifest is metadata, not an installed extension.
    expect(await readdir(join(profile, 'extensions'))).toEqual(['extensions.json']);
    expect(JSON.parse(await readFile(join(profile, 'extensions', 'extensions.json'), 'utf8')) as unknown).toEqual([]);
    expect(await readdir(join(profile, 'builtin-extensions'))).toEqual([]);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});

test('T-007: Given an isolated host without GitHub authentication, When configuration loads, Then only the signed-out fixture accompanies the development extension', async () => {
  const output = resolve('out');
  await mkdir(output, { recursive: true });
  const profile = await mkdtemp(join(output, 'integration-profile-auth-test-'));
  try {
    const { stdout } = await execute(process.execPath, ['--input-type=module', '-e',
      'const { default: config } = await import("./.vscode-test.mjs"); console.log(JSON.stringify(config.extensionDevelopmentPath));',
    ], { env: { ...process.env, LITE_VOYAGER_TEST_PROFILE: profile } });
    const fixture = join(profile, 'authentication-fixture');
    expect(JSON.parse(stdout) as unknown).toEqual([resolve('.'), fixture]);
    const manifest: unknown = JSON.parse(await readFile(join(fixture, 'package.json'), 'utf8'));
    expect(manifest).toMatchObject({
      name: 'signed-out-authentication', publisher: 'lite-voyager-tests',
      main: './extension.js', contributes: { authentication: [{ id: 'github', label: 'Signed-out test fixture' }] },
    });
    expect(await readFile(join(fixture, 'extension.js'), 'utf8')).toContain('registerAuthenticationProvider');
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});
