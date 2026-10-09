import { mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from './checks.mts';
import { checkIntegrationLogs, formatApprovedHostDiagnostics } from './integration-logs.mts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const outputDirectory = join(root, 'out');
  await mkdir(outputDirectory, { recursive: true });
  const profile = await mkdtemp(join(outputDirectory, 'integration-profile-'));
  await runCheck({
    name: 'VS Code integration tests',
    command: process.execPath,
    args: ['node_modules/@vscode/test-cli/out/bin.mjs'],
  }, {
    cwd: root,
    env: { ...process.env, LITE_VOYAGER_TEST_PROFILE: profile },
  });
  const approved = await checkIntegrationLogs(join(profile, 'logs'));
  process.stdout.write(formatApprovedHostDiagnostics(approved));
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
