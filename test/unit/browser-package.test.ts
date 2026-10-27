import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { expect, test } from 'vitest';

test('FR-020: Given the staged-edit snapshot worker, When listing actual VSIX contents, Then native Save As ships its helper without development files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-package-'));
  try {
    for (const name of ['package.json', '.vscodeignore', 'README.md', 'CHANGELOG.md', 'LICENSE']) { await copyFile(name, join(directory, name)); }
    await mkdir(join(directory, 'dist'));
    const result = await build({ entryPoints: [resolve('src/worker/sqlite-edit-copy-worker.ts')], outfile: join(directory, 'dist/sqlite-edit-copy-worker.js'), bundle: true, platform: 'node', format: 'cjs', target: 'es2022', external: ['node:sqlite'], logLevel: 'silent' });
    expect(result.warnings).toEqual([]);
    const packaged = await promisify(execFile)(process.execPath, [resolve('node_modules/@vscode/vsce/vsce'), 'ls', '--no-dependencies'], { cwd: directory });
    expect(packaged.stderr).toBe(''); expect(packaged.stdout.trim().split(/\r?\n/u)).toContain('dist/sqlite-edit-copy-worker.js');
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);

test('FR-006: Given XLSX workers and notice, When listing the actual VSIX, Then the two workers and Apache license ship without the vendor tarball', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-xlsx-package-'));
  try {
    for (const name of ['package.json', '.vscodeignore', 'README.md', 'CHANGELOG.md', 'LICENSE']) { await copyFile(name, join(directory, name)); }
    await mkdir(join(directory, 'dist'));
    for (const name of ['xlsx-preview-worker', 'xlsx-import-worker']) {
      const built = await build({ entryPoints: [resolve(`src/worker/${name}.ts`)], outfile: join(directory, `dist/${name}.js`), bundle: true, platform: 'node', format: 'cjs', target: 'es2022', external: ['node:sqlite'], logLevel: 'silent' });
      expect(built.warnings).toEqual([]);
    }
    await copyFile('node_modules/xlsx/LICENSE', join(directory, 'dist/xlsx-LICENSE'));
    const result = await promisify(execFile)(process.execPath, [resolve('node_modules/@vscode/vsce/vsce'), 'ls', '--no-dependencies'], { cwd: directory });
    expect(result.stderr).toBe(''); const files = result.stdout.trim().split(/\r?\n/u);
    for (const name of ['xlsx-preview-worker.js', 'xlsx-import-worker.js', 'xlsx-LICENSE']) { expect(files).toContain(`dist/${name}`); }
    expect(files.some((file) => file.endsWith('.tgz') || file.endsWith('.xlsx'))).toBe(false);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);

test('FR-005: Given JSON production workers, When listing the actual package, Then both required workers ship without fixtures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-json-package-'));
  try {
    for (const name of ['package.json', '.vscodeignore', 'README.md', 'CHANGELOG.md', 'LICENSE']) { await copyFile(name, join(directory, name)); }
    await mkdir(join(directory, 'dist'));
    for (const name of ['json-preview-worker', 'json-import-worker']) {
      const built = await build({ entryPoints: [resolve(`src/worker/${name}.ts`)], outfile: join(directory, `dist/${name}.js`), bundle: true, platform: 'node', format: 'cjs', target: 'es2022', external: ['node:sqlite'], logLevel: 'silent' });
      expect(built.warnings).toEqual([]);
    }
    const result = await promisify(execFile)(process.execPath, [resolve('node_modules/@vscode/vsce/vsce'), 'ls', '--no-dependencies'], { cwd: directory });
    expect(result.stderr).toBe(''); const files = result.stdout.trim().split(/\r?\n/u);
    expect(files).toContain('dist/json-preview-worker.js'); expect(files).toContain('dist/json-import-worker.js');
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);

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
    const cellWorker = await build({ entryPoints: [resolve('src/worker/cell-worker.ts')], outfile: join(directory, 'dist/cell-worker.js'), bundle: true, platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent' });
    expect(cellWorker.warnings).toEqual([]);
    await copyFile('scripts/browser-fixture.mts', join(directory, 'browser-fixture.mts'));
    const packaged = await execute(process.execPath, [resolve('node_modules/@vscode/vsce/vsce'), 'ls', '--no-dependencies'], { cwd: directory });
    expect(packaged.stderr).toBe('');
    const files = packaged.stdout.trim().split(/\r?\n/u);
    expect(files).toContain('dist/sqlite-browser.js');
    expect(files).toContain('dist/sqlite-browser.css');
    expect(files).toContain('dist/cell-worker.js');
    expect(files.some((file) => file.includes('browser-fixture') || file.endsWith('.sqlite'))).toBe(false);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);

test('FR-007: Given the SQLite save worker build, When listing the actual VSIX whitelist, Then the required worker ships', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-save-package-'));
  try {
    for (const name of ['package.json', '.vscodeignore', 'README.md', 'CHANGELOG.md', 'LICENSE']) { await copyFile(name, join(directory, name)); }
    await mkdir(join(directory, 'dist'));
    const built = await build({ entryPoints: [resolve('src/worker/sqlite-save-worker.ts')], outfile: join(directory, 'dist/sqlite-save-worker.js'), bundle: true, platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent' });
    expect(built.warnings).toEqual([]);
    const packaged = await promisify(execFile)(process.execPath, [resolve('node_modules/@vscode/vsce/vsce'), 'ls', '--no-dependencies'], { cwd: directory });
    expect(packaged.stderr).toBe(''); expect(packaged.stdout.trim().split(/\r?\n/u)).toContain('dist/sqlite-save-worker.js');
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);
