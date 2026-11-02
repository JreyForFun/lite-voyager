import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, open, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { checkIntegrationLogs } from './integration-logs.mts';
import { integrationEnvironment } from './integration-environment.mts';

export async function diagnoseWatcherFailure(error: unknown, run: () => Promise<void>,
  platform: NodeJS.Platform = process.platform, enabled = process.env['LITE_VOYAGER_INTERVAL_DIAGNOSTICS']): Promise<void> {
  if (platform !== 'darwin' || enabled !== '1' || !(error instanceof Error)) { return; }
  if (/^\d{8}T\d{6}\/window\d+\/fileWatcher\.log:\d+: \d{4}-\d{2}-\d{2} .* \[warning\] \[File Watcher \(node\.js\)\] Watcher shutdown because watched path got deleted(?:\r?\n|$)/mu.test(error.message)) { await run(); }
}

/** A probe is supplemental evidence and can never clear the original rejection. */
export async function reportIntegrationFailure(error: unknown, probe: () => Promise<void>, report: (message: string) => void,
  platform: NodeJS.Platform = process.platform, enabled = process.env['LITE_VOYAGER_INTERVAL_DIAGNOSTICS']): Promise<1> {
  report(`${error instanceof Error ? error.message : String(error)}\n`);
  try { await diagnoseWatcherFailure(error, probe, platform, enabled); }
  catch (probeError: unknown) { report(`Watcher diagnostic probe could not complete: ${probeError instanceof Error ? probeError.message : String(probeError)}\n`); }
  return 1;
}

export async function readWatcherProbeTail(profile: string): Promise<string[]> {
  const records: string[] = []; let characters = 0; let traced = false;
  const logs = join(profile, 'logs');
  for (const session of await readdir(logs)) {
    if (!/^\d{8}T\d{6}$/.test(session)) { continue; }
    for (const window of await readdir(join(logs, session))) {
      if (!/^window\d+$/.test(window)) { continue; }
      const source = `${session}/${window}/fileWatcher.log`;
      const input = createReadStream(join(logs, source));
      const lines = createInterface({ input, crlfDelay: Infinity }); let number = 0;
      try {
        for await (const line of lines) {
          number++;
          if (!line.includes('[File Watcher ')) { continue; }
          if (/\[trace\] \[File Watcher /u.test(line)) { traced = true; }
          const record = JSON.stringify({ source, line: number, text: line.length <= 1024 ? line : `${line.slice(0, 1012)} [truncated]` });
          records.push(record); characters += record.length + 1;
          while (records.length > 64 || characters > 16384) { characters -= (records.shift()?.length ?? 0) + 1; }
        }
      } finally { lines.close(); input.destroy(); }
    }
  }
  if (!traced) { throw new Error('No native watcher trace was retained by the diagnostic probe.'); }
  return records;
}

/** One separate early-suite trace run, after failure; never a verification retry. */
export async function runWatcherProbe(root: string, report: (message: string) => void): Promise<void> {
  const output = resolve(root, 'out'); await mkdir(output, { recursive: true });
  const profile = await mkdtemp(join(output, 'integration-profile-watcher-probe-'));
  const config = join(profile, 'watcher-probe.mjs');
  const files = ['xlsx-import', 'webview-spike', 't027-import-startup', 'staged-edits'].map((name) => join(output, 'integration', 'test', `${name}.test.js`));
  await writeFile(config, `import config from ${JSON.stringify(pathToFileURL(join(root, '.vscode-test.mjs')).href)};\nexport default { ...config, files: ${JSON.stringify(files)}, launchArgs: [...config.launchArgs, '--log=trace'] };\n`, { flag: 'wx' });
  const log = await open(join(profile, 'watcher-probe-console.log'), 'wx');
  let exitCode: number | null;
  report(`Starting one focused watcher trace probe after the rejected full run. Profile: ${profile}. Its exit status cannot establish acceptance.\n`);
  try {
    exitCode = await new Promise<number | null>((accept, reject) => {
      const child = spawn(process.execPath, [join(root, 'node_modules', '@vscode', 'test-cli', 'out', 'bin.mjs'), '--config', config], {
        cwd: root, windowsHide: true, stdio: ['ignore', log.fd, log.fd], env: integrationEnvironment(process.env, profile),
      });
      child.once('error', reject); child.once('close', accept);
    });
  } finally { await log.close(); }
  let diagnostics: unknown;
  try { diagnostics = { approved: await checkIntegrationLogs(join(profile, 'logs')) }; }
  catch (error: unknown) { diagnostics = { rejected: error instanceof Error ? error.message : String(error) }; }
  const status = { exitCode, diagnostics, scope: 'Separate focused trace diagnostic; raw console retained without filtering. Not a passing gate or proof of the original cause.' };
  await writeFile(join(profile, 'watcher-probe-status.json'), JSON.stringify(status, null, 2), { flag: 'wx' });
  report(`Watcher probe status: ${JSON.stringify(status)}\nWatcher probe native records (tail, at most64 records/16384 characters; older records omitted, long lines explicitly truncated):\n${(await readWatcherProbeTail(profile)).join('\n')}\n`);
  if (exitCode !== 0) { throw new Error(`Focused watcher diagnostic host exited ${String(exitCode)}; raw console retained in ${profile}.`); }
}
