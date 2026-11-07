import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck, type Check } from './checks.mts';
import { integrationEnvironment } from './integration-environment.mts';
import { checkIntegrationLogs } from './integration-logs.mts';
import { validateIntegrationRun } from './integration-validation.mts';

/** Select the original whole test, including all four populated inputs. */
export function jsonMemoryProbeCheck(root: string): Check {
  const title = 'T-023 populated JSON memory NFR-003: Given populated 1/5-GB JSON and JSONL, When streaming native imports, Then actual helper/host residency stays bounded, sources match hashes and host timers stay responsive';
  return { name: 'Focused macOS JSON memory diagnostic', command: process.execPath,
    args: [join(root, 'node_modules', '@vscode', 'test-cli', 'out', 'bin.mjs'), '--run', 'out/integration/test/json-import-memory.test.js', '--fgrep', title, '--fail-zero', '--retries', '0'] };
}

export async function runMacJsonMemoryProbe(root: string, platform: NodeJS.Platform = process.platform): Promise<void> {
  if (platform !== 'darwin') { throw new Error('This diagnostic is macOS only; no test was executed.'); }
  const output = join(root, 'out'); await mkdir(output, { recursive: true });
  const profile = await mkdtemp(join(output, 'integration-profile-macos-json-'));
  const check = jsonMemoryProbeCheck(root); const started = new Date().toISOString();
  const report = (message: string): void => { process.stdout.write(message); };
  report(`One supplemental macOS diagnostic, not full verification. Profile: ${profile}\n`);
  let failure: string | null = null; let originalFailure: unknown;
  try {
    await validateIntegrationRun(() => runCheck(check, { cwd: root,
      env: integrationEnvironment({ ...process.env, LITE_VOYAGER_INTERVAL_DIAGNOSTICS: '1' }, profile),
      failureLogPath: join(profile, 'integration-console.log'),
    }), () => checkIntegrationLogs(join(profile, 'logs')), report);
  } catch (error: unknown) {
    originalFailure = error; failure = error instanceof Error ? error.message : String(error); throw error;
  } finally {
    try {
      await writeFile(join(profile, 'json-memory-probe-status.json'), JSON.stringify({
        started, finished: new Date().toISOString(), commit: process.env['GITHUB_SHA'] ?? null,
        platform, check, diagnosticPassed: failure === null, failure, fullVerification: false,
        scope: 'One requested diagnostic execution of the original populated JSON memory test. No retries or changed assertions. Does not replace the failed full run or establish its cause.',
      }, null, 2), { flag: 'wx' });
    } catch (saveError: unknown) {
      if (failure !== null) { throw new AggregateError([originalFailure, saveError], `${failure}\nProbe status could not be saved: ${saveError instanceof Error ? saveError.message : String(saveError)}`); }
      throw saveError;
    }
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runMacJsonMemoryProbe(resolve(dirname(fileURLToPath(import.meta.url)), '..')); }
  catch (error: unknown) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
}
