import { afterEach, expect, test, vi } from 'vitest';
import { diagnoseWatcherFailure, reportIntegrationFailure } from '../../scripts/integration-watcher-probe.mts';

const failure = new Error('VS Code runtime logs contain diagnostics:\n20261102T143927/window1/fileWatcher.log:1: 2026-11-02 14:39:47.953 [warning] [File Watcher (node.js)] Watcher shutdown because watched path got deleted');
afterEach(() => { vi.unstubAllEnvs(); });

test.each([
  { platform: 'darwin', enabled: '1', runs: 1 },
  { platform: 'darwin', enabled: '0', runs: 0 },
  { platform: 'darwin', enabled: 'true', runs: 0 },
  { platform: 'darwin', enabled: undefined, runs: 0 },
  { platform: 'win32', enabled: '1', runs: 0 },
  { platform: 'linux', enabled: '1', runs: 0 },
] as const)('T-030: Given watcher failure on $platform with diagnostics=$enabled, When diagnosis is requested, Then exactly $runs focused probes run', async ({ platform, enabled, runs }) => {
  vi.stubEnv('LITE_VOYAGER_INTERVAL_DIAGNOSTICS', undefined);
  const run = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  await diagnoseWatcherFailure(failure, run, platform, enabled);
  expect(run).toHaveBeenCalledTimes(runs);
});

test.each(['1', '0', 'true', undefined])('T-030: Given inherited diagnostic flag %s, When no flag override is passed, Then only the exact enabled environment starts a probe', async (enabled) => {
  vi.stubEnv('LITE_VOYAGER_INTERVAL_DIAGNOSTICS', enabled);
  const run = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  await diagnoseWatcherFailure(failure, run, 'darwin');
  expect(run).toHaveBeenCalledTimes(enabled === '1' ? 1 : 0);
});

test.each([new Error('A different runtime warning'), new Error('Watcher shutdown because watched path got deleted'),
  new Error(failure.message.replace('20261102T143927/', 'other/20261102T143927/')), 'not an Error'])(
  'T-030: Given a different or unstructured failure %s, When diagnosis is requested, Then no probe runs', async (error) => {
    const run = vi.fn<() => Promise<void>>();
    await diagnoseWatcherFailure(error, run, 'darwin', '1');
    expect(run).not.toHaveBeenCalled();
  },
);

test('T-030: Given a probe failure after the original watcher rejection, When diagnosing, Then the failure propagates without another attempt', async () => {
  const probeFailure = new Error('Probe failed');
  const run = vi.fn<() => Promise<void>>().mockRejectedValue(probeFailure);
  await expect(diagnoseWatcherFailure(failure, run, 'darwin', '1')).rejects.toBe(probeFailure);
  expect(run).toHaveBeenCalledTimes(1);
});

test.each([false, true])('T-030: Given the original rejection and probe failure=%s, When reporting finishes, Then status stays1 and original evidence is reported before the single probe', async (fails) => {
  const events: string[] = []; const reports: string[] = [];
  const probe = vi.fn(() => { events.push('probe'); return fails ? Promise.reject(new Error('Trace host stopped')) : Promise.resolve(); });
  const status = await reportIntegrationFailure(failure, probe, (message) => { events.push('report'); reports.push(message); }, 'darwin', '1');
  expect(status).toBe(1);
  expect(events.slice(0, 2)).toEqual(['report', 'probe']);
  expect(reports[0]).toBe(`${failure.message}\n`);
  expect(reports.join('')).toContain(failure.message);
  expect(reports.join('')).toContain(fails ? 'Trace host stopped' : failure.message);
  expect(probe).toHaveBeenCalledTimes(1);
});
