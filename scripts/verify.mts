import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runChecks, type Check } from './checks.mts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeCheck = (name: string, args: readonly string[]): Check => ({ name, command: process.execPath, args });
const checks = [
  nodeCheck('host typecheck', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.json', '--noEmit']),
  nodeCheck('webview typecheck', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.webview.json', '--noEmit']),
  nodeCheck('tooling and unit-test typecheck', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.tooling.json', '--noEmit']),
  nodeCheck('lint', ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings', '0']),
  nodeCheck('unit tests', ['node_modules/vitest/vitest.mjs', 'run']),
  nodeCheck('production host and webview build', ['esbuild.js', '--production']),
  nodeCheck('VSIX package dry run', ['scripts/package-check.mts']),
];

if (process.argv.includes('--full')) {
  checks.push(
    nodeCheck('integration-test compilation', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.integration.json']),
    nodeCheck('VS Code integration tests and runtime logs', ['scripts/integration-check.mts']),
  );
}

try {
  await runChecks(checks, { cwd: root });
  process.stdout.write('\nAll verification checks passed.\n');
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
