import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from './checks.mts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'lite-voyager-package-'));

try {
  const packagePath = join(temporaryDirectory, 'lite-voyager.vsix');
  await runCheck({
    name: 'VSIX packaging',
    command: process.execPath,
    args: ['node_modules/@vscode/vsce/vsce', 'package', '--no-dependencies', '--out', packagePath],
  }, { cwd: root });
  if ((await stat(packagePath)).size === 0) {
    throw new Error('VSIX packaging produced an empty file.');
  }
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
