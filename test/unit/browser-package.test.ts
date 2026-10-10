import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { expect, test } from 'vitest';

test('FR-002: Given a built extension, When listing actual VSIX contents, Then both browser assets ship and disposable test fixtures do not', async () => {
  const execute = promisify(execFile);
  // Exercise the real whitelist with real built assets, without recursively
  // traversing the cached VS Code installation, node_modules and test profiles.
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-browser-package-'));
  try {
    for (const name of ['package.json', '.vscodeignore', 'README.md', 'CHANGELOG.md', 'LICENSE']) { await copyFile(name, join(directory, name)); }
    await mkdir(join(directory, 'dist'));
    const built = await build({ entryPoints: [resolve('webview/sqlite-browser.ts')], outfile: join(directory, 'dist/sqlite-browser.js'), bundle: true, platform: 'browser', format: 'iife', target: 'es2022', logLevel: 'silent' });
    expect(built.warnings).toEqual([]);
    await copyFile('scripts/browser-fixture.mts', join(directory, 'browser-fixture.mts'));
    const packaged = await execute(process.execPath, [resolve('node_modules/@vscode/vsce/vsce'), 'ls', '--no-dependencies'], { cwd: directory });
    expect(packaged.stderr).toBe('');
    const files = packaged.stdout.trim().split(/\r?\n/u);
    expect(files).toContain('dist/sqlite-browser.js');
    expect(files).toContain('dist/sqlite-browser.css');
    expect(files.some((file) => file.includes('browser-fixture') || file.endsWith('.sqlite'))).toBe(false);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);
