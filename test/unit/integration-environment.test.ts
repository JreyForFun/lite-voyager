import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { integrationEnvironment } from '../../scripts/integration-environment.mts';

const execute = promisify(execFile);
const parent: NodeJS.ProcessEnv = {
  ...process.env, VSCODE_NODE_COMPILE_CACHE_ROOT: 'wrong-host-cache',
  VSCODE_CODE_CACHE_PATH: 'wrong-host-code-cache', VSCODE_CWD: 'wrong-host-cwd',
  LITE_VOYAGER_ENV_TEST: 'preserved',
  LITE_VOYAGER_TEST_PROFILE: 'parent-profile',
};

test('FR-001: Given parent VS Code startup paths, When the integration environment is isolated, Then the parent remains intact and the child uses its own paths', () => {
  const child = integrationEnvironment(parent, 'test-profile');
  expect(child['VSCODE_NODE_COMPILE_CACHE_ROOT']).toBeUndefined();
  expect(child['VSCODE_CODE_CACHE_PATH']).toBeUndefined();
  expect(child['VSCODE_CWD']).toBeUndefined();
  expect(child['LITE_VOYAGER_TEST_PROFILE']).toBe('test-profile');
  expect(child['LITE_VOYAGER_ENV_TEST']).toBe('preserved');
  expect(parent['VSCODE_NODE_COMPILE_CACHE_ROOT']).toBe('wrong-host-cache');
  expect(parent['LITE_VOYAGER_TEST_PROFILE']).toBe('parent-profile');
});

test('FR-001: Given isolated startup variables, When a real child launches, Then stale paths are absent without changing diagnostic policy', async () => {
  const { stdout, stderr } = await execute(process.execPath, ['-e',
    "console.log(JSON.stringify([process.env.VSCODE_NODE_COMPILE_CACHE_ROOT, process.env.VSCODE_CODE_CACHE_PATH, process.env.VSCODE_CWD, process.env.LITE_VOYAGER_ENV_TEST]));",
  ], { env: integrationEnvironment(parent, 'test-profile') });
  expect(stderr).toBe('');
  expect(JSON.parse(stdout) as unknown).toEqual([null, null, null, 'preserved']);
});
