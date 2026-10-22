import { execFile } from 'node:child_process';
import { access, copyFile, cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify, stripVTControlCharacters } from 'node:util';
import { expect, test } from 'vitest';

test('FR-012: Given a fresh isolated checkout without out, When the real autocomplete worker suite runs first, Then all four Unicode and wide-schema cases pass on both engines', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t026-clean-'));
  expect(dirname(directory)).toBe(resolve(tmpdir())); expect(basename(directory)).toMatch(/^lv-t026-clean-/u);
  try {
    for (const name of ['src', 'webview']) { await cp(resolve(name), join(directory, name), { recursive: true }); }
    for (const name of ['esbuild.js', 'package.json', 'vitest.config.mts']) { await copyFile(resolve(name), join(directory, name)); }
    await mkdir(join(directory, 'test/unit'), { recursive: true });
    await copyFile(resolve('test/unit/sql-completion-engine.test.ts'), join(directory, 'test/unit/sql-completion-engine.test.ts'));
    await symlink(resolve('node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(access(join(directory, 'out'))).rejects.toMatchObject({ code: 'ENOENT' });
    let result: { stdout: string; stderr: string };
    try {
      result = await promisify(execFile)(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', join(directory, 'vitest.config.mts')],
        { cwd: directory, windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null) {
        if ('stdout' in error && typeof error.stdout === 'string') { process.stdout.write(error.stdout); }
        if ('stderr' in error && typeof error.stderr === 'string') { process.stderr.write(error.stderr); }
      }
      throw error;
    }
    process.stdout.write(result.stdout);
    const output = stripVTControlCharacters(result.stdout);
    expect(output).toMatch(/Test Files\s+1 passed \(1\)/u);
    expect(output).toMatch(/Tests\s+4 passed \(4\)/u);
    expect(result.stderr).toBe('');
  } finally {
    // This is the owned mkdtemp root, never the repository or dependency target.
    expect(dirname(directory)).toBe(resolve(tmpdir())); expect(basename(directory)).toMatch(/^lv-t026-clean-/u);
    await rm(join(directory, 'node_modules'), { force: true });
    await rm(directory, { recursive: true, force: true });
  }
  // Wrapper includes the existing 30 s setup and four 15 s case budgets.
}, 100000);
