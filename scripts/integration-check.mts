import { mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from './checks.mts';
import { checkIntegrationLogs } from './integration-logs.mts';
import { integrationEnvironment } from './integration-environment.mts';
import { integrationFailureLog, validateIntegrationRun } from './integration-validation.mts';
import { reportIntegrationFailure, runWatcherProbe } from './integration-watcher-probe.mts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const outputDirectory = join(root, 'out');
  await mkdir(outputDirectory, { recursive: true });
  const profile = await mkdtemp(join(outputDirectory, 'integration-profile-'));
  await validateIntegrationRun(() => runCheck({
    name: 'VS Code integration tests',
    command: process.execPath,
    args: ['node_modules/@vscode/test-cli/out/bin.mjs'],
  }, {
    cwd: root,
    env: integrationEnvironment(process.env, profile),
    failureLogPath: integrationFailureLog(profile, process.platform, process.env['LITE_VOYAGER_INTERVAL_DIAGNOSTICS']),
  }), () => checkIntegrationLogs(join(profile, 'logs')), (message) => { process.stdout.write(message); });
} catch (error: unknown) {
  process.exitCode = await reportIntegrationFailure(error, () => runWatcherProbe(root, (message) => { process.stdout.write(message); }),
    (message) => { process.stderr.write(message); });
}
