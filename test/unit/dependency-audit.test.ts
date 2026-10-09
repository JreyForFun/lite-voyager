import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { expect, test } from 'vitest';

interface LockedPackage {
  version: string;
  license?: string;
  dev?: boolean;
  optional?: boolean;
  peer?: boolean;
}

interface LicenseEntry {
  path: string;
  name: string;
  version: string;
  declaredLicense: string | null;
  license: string;
  licenseSource: string;
  licenseSha256?: string;
  tarballIntegrityVerified?: boolean;
  dev: boolean;
  optional: boolean;
  peer: boolean;
  direct: boolean;
}

interface Inventory {
  lockfileSha256: string;
  packages: LicenseEntry[];
  shippedPackages: { name: string; notice: string }[];
}

const root = resolve(import.meta.dirname, '../..');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const execute = promisify(execFile);
const inventory = async () => JSON.parse(await readFile(resolve(root, 'specs/dependency-licenses.json'), 'utf8')) as Inventory;

test('T-050: Given the lockfile, When reviewing licenses, Then every package path version license and scope is recorded without omissions', async () => {
  const report = await inventory();
  const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, LockedPackage>;
  };
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  expect(report.lockfileSha256).toBe(sha256(JSON.stringify(lock)));
  const locked = Object.entries(lock.packages).filter(([path]) => path !== '');
  expect(report.packages.map((entry) => entry.path).sort()).toEqual(locked.map(([path]) => path).sort());
  for (const [path, entry] of locked) {
    const recorded = report.packages.find((candidate) => candidate.path === path);
    const name = path.split('node_modules/').at(-1);
    expect(recorded, path).toMatchObject({
      name, version: entry.version, declaredLicense: entry.license ?? null,
      dev: entry.dev === true, optional: entry.optional === true, peer: entry.peer === true,
      direct: name !== undefined && path === `node_modules/${name}` && (name in manifest.dependencies || name in manifest.devDependencies),
    });
    expect(recorded?.license, path).toBeTruthy();
    expect(recorded?.licenseSource, path).toBeTruthy();
    if (entry.license !== undefined && !entry.license.startsWith('SEE LICENSE')) {
      expect(recorded?.license, path).toBe(entry.license);
    }
  }
});

test('T-050: Given missing or custom license metadata, When resolving it, Then shipped license text and integrity evidence back every exception', async () => {
  const report = await inventory();
  const memory = report.packages.find((entry) => entry.name === 'memorystream');
  expect(memory).toMatchObject({ declaredLicense: null, license: 'MIT', licenseSource: 'node_modules/memorystream/LICENSE' });
  expect(memory?.licenseSha256).toBe(sha256(await readFile(resolve(root, 'node_modules/memorystream/LICENSE'), 'utf8')));
  const custom = report.packages.filter((entry) => entry.declaredLicense?.startsWith('SEE LICENSE'));
  expect(custom).toHaveLength(10);
  const signingLicense = await readFile(resolve(root, 'node_modules/@vscode/vsce-sign/LICENSE.txt'), 'utf8');
  expect(signingLicense).toContain('MICROSOFT SOFTWARE LICENSE TERMS');
  for (const entry of custom) {
    expect(entry).toMatchObject({ license: 'LicenseRef-Microsoft-VSCE-Sign', dev: true, tarballIntegrityVerified: true });
    expect(entry.licenseSource).toBe(`${entry.path}/LICENSE.txt (integrity-verified npm tarball)`);
    expect(entry.licenseSha256).toBe(sha256(signingLicense));
  }
  expect(report.packages.filter((entry) => entry.declaredLicense === null).map((entry) => entry.name)).toEqual(['memorystream']);
});

test('T-050: Given production bundles, When building, Then every embedded dependency has its complete notice and tooling is excluded', async () => {
  const report = await inventory();
  await execute(process.execPath, ['esbuild.js', '--production'], { cwd: root });
  const bundled = new Set<string>(['sql.js']); // Copied loader/WASM rather than a bundled import.
  for (const [entryPoint, platform] of [
    ['src/extension.ts', 'node'], ['src/worker/sqlite-spike-process.ts', 'node'],
    ['src/worker/sqlite-spike-worker.ts', 'node'], ['webview/main.ts', 'browser'],
  ] as const) {
    const result = await build({
      absWorkingDir: root, entryPoints: [entryPoint], platform, bundle: true,
      write: false, metafile: true, outfile: 'dist/t050-inspect.js', logLevel: 'silent',
      external: ['vscode', 'node:sqlite'],
    });
    expect(result.warnings).toEqual([]);
    for (const input of Object.keys(result.metafile.inputs)) {
      const name = /^node_modules\/(@[^/]+\/[^/]+|[^/]+)/.exec(input)?.[1];
      if (name !== undefined) { bundled.add(name); }
    }
  }
  expect(report.shippedPackages.map((entry) => entry.name).sort()).toEqual([...bundled].sort());
  const ignore = await readFile(resolve(root, '.vscodeignore'), 'utf8');
  expect(ignore.split(/\r?\n/)[0]).toBe('**/*');
  expect(ignore).not.toMatch(/^!.*node_modules/m);
  for (const entry of report.shippedPackages) {
    expect(ignore.split(/\r?\n/)).toContain(`!${entry.notice}`);
    expect(await readFile(resolve(root, entry.notice), 'utf8')).toContain(await readFile(resolve(root, `node_modules/${entry.name}/LICENSE`), 'utf8'));
    expect(report.packages.find((candidate) => candidate.path === `node_modules/${entry.name}`)?.license).toBe('MIT');
  }
}, 20_000);
