import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify, stripVTControlCharacters } from 'node:util';
import { expect, test } from 'vitest';

test('T-006: Given unavailable OS fork startup, When the configured unit runner executes two suites, Then global, module, mock and environment state stay isolated without changing deadlines', async () => {
  const output = resolve('out'); await mkdir(output, { recursive: true });
  const directory = await mkdtemp(join(output, 't025-runner-'));
  expect(dirname(directory)).toBe(output);
  try {
    const config = join(directory, 'vitest.config.mjs');
    await writeFile(config, `import base from ${JSON.stringify(pathToFileURL(resolve('vitest.config.mts')).href)};
export default {...base, root: ${JSON.stringify(directory)}, test: {...base.test, include: ['*.test.mjs']}};`);
    // Simulate the failed bootstrap only in this disposable child. Named and
    // default builtin imports must both observe the unavailable fork function.
    const preload = join(directory, 'no-forks.mjs');
    await writeFile(preload, `import child from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
child.fork = () => { throw new Error('Synthetic unavailable OS fork startup'); };
syncBuiltinESMExports();`);
    await writeFile(join(directory, 'shared.mjs'), "export const state={value:'initial'};\n");
    await writeFile(join(directory, 'mocked.mjs'), "export const label='original';\n");
    for (const name of ['first', 'second']) {
      await writeFile(join(directory, `${name}.test.mjs`), `import {expect,test,vi} from 'vitest';
import {state} from './shared.mjs';
import {label} from './mocked.mjs';
vi.mock('./mocked.mjs',()=>({label:${JSON.stringify(name)}}));
test('T-006: ${name} file receives isolated state',()=>{
  expect(globalThis.__t025Isolation).toBeUndefined();
  expect(process.env.LITE_VOYAGER_T025_ISOLATION).toBeUndefined();
  expect(state.value).toBe('initial'); expect(label).toBe(${JSON.stringify(name)});
  globalThis.__t025Isolation=${JSON.stringify(name)};
  process.env.LITE_VOYAGER_T025_ISOLATION=${JSON.stringify(name)};
  state.value=${JSON.stringify(name)};
});`);
    }
    const environment = { ...process.env }; delete environment['LITE_VOYAGER_T025_ISOLATION'];
    let result: { stdout: string; stderr: string };
    try {
      result = await promisify(execFile)(process.execPath, ['--import', pathToFileURL(preload).href, resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', config],
        { cwd: resolve('.'), env: environment, timeout: 10000, windowsHide: true });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null) {
        if ('stdout' in error && typeof error.stdout === 'string') { process.stdout.write(error.stdout); }
        if ('stderr' in error && typeof error.stderr === 'string') { process.stderr.write(error.stderr); }
      }
      throw error;
    }
    process.stdout.write(result.stdout);
    expect(stripVTControlCharacters(result.stdout)).toMatch(/Test Files\s+2 passed \(2\)/u);
    expect(stripVTControlCharacters(result.stdout)).toMatch(/Tests\s+2 passed \(2\)/u);
    expect(result.stderr).toBe('');
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 15000);
