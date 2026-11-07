import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { jsonMemoryProbeCheck, runMacJsonMemoryProbe } from '../../scripts/macos-json-memory-probe.mts';

const mocks = vi.hoisted(() => ({ run: vi.fn<typeof import('../../scripts/checks.mts').runCheck>(), scan: vi.fn<() => Promise<[]>>() }));
vi.mock('../../scripts/checks.mts', () => ({ runCheck: mocks.run }));
vi.mock('../../scripts/integration-logs.mts', async (original) => ({ ...await original<typeof import('../../scripts/integration-logs.mts')>(), checkIntegrationLogs: mocks.scan }));
const roots: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); mocks.run.mockReset(); mocks.scan.mockReset(); await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
async function root(): Promise<string> { const path = await mkdtemp(join(tmpdir(), 'lv-macos-json-probe-')); roots.push(path); return path; }

test('T-030: Given the requested macOS diagnostic, When selecting the host test, Then only the exact populated JSON memory case runs with zero retries and zero-test rejection', async () => {
  const check = jsonMemoryProbeCheck('/workspace');
  const title = 'NFR-003: Given populated 1/5-GB JSON and JSONL, When streaming native imports, Then actual helper/host residency stays bounded, sources match hashes and host timers stay responsive';
  expect(await readFile('src/test/json-import-memory.test.ts', 'utf8')).toContain(`test('${title}'`);
  expect(check.command).toBe(process.execPath);
  expect(check.args.slice(1)).toEqual(['--run', 'out/integration/test/json-import-memory.test.js', '--fgrep', `T-023 populated JSON memory ${title}`, '--fail-zero', '--retries', '0']);
});

test.each(['win32', 'linux'] as const)('T-030: Given %s, When requesting the macOS test, Then refusal precedes profile creation or host launch', async (platform) => {
  const path = await root(); await expect(runMacJsonMemoryProbe(path, platform)).rejects.toThrow('macOS only');
  expect(await readdir(path)).toEqual([]); expect(mocks.run).not.toHaveBeenCalled();
});

test.each(['host', 'logs'] as const)('T-030: Given a rejected %s check, When one diagnostic finishes, Then saved evidence and the original failure survive without another attempt', async (failure) => {
  const path = await root(); const rejection = new Error(`${failure} rejected`);
  mocks.run.mockImplementation(() => failure === 'host' ? Promise.reject(rejection) : Promise.resolve());
  mocks.scan.mockImplementation(() => failure === 'logs' ? Promise.reject(rejection) : Promise.resolve([]));
  vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  await expect(runMacJsonMemoryProbe(path, 'darwin')).rejects.toBe(rejection);
  expect(mocks.run).toHaveBeenCalledOnce(); expect(mocks.scan).toHaveBeenCalledOnce();
  const profiles = await readdir(join(path, 'out')); expect(profiles).toHaveLength(1);
  const profile = join(path, 'out', profiles[0] ?? 'missing');
  expect(JSON.parse(await readFile(join(profile, 'json-memory-probe-status.json'), 'utf8'))).toMatchObject({ diagnosticPassed: false, failure: `${failure} rejected`, fullVerification: false });
  expect(mocks.run).toHaveBeenCalledWith(jsonMemoryProbeCheck(path), expect.objectContaining({ cwd: path, failureLogPath: join(profile, 'integration-console.log') }));
  expect(mocks.run.mock.calls[0]?.[1]?.env).toMatchObject({ LITE_VOYAGER_TEST_PROFILE: profile, LITE_VOYAGER_INTERVAL_DIAGNOSTICS: '1' });
});

test('T-030: Given a successful focused diagnostic, When status is saved, Then it cannot claim full verification', async () => {
  const path = await root(); mocks.run.mockResolvedValue(); mocks.scan.mockResolvedValue([]); vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  await runMacJsonMemoryProbe(path, 'darwin'); const [profile] = await readdir(join(path, 'out')); expect(profile).toBeDefined();
  expect(JSON.parse(await readFile(join(path, 'out', profile ?? 'missing', 'json-memory-probe-status.json'), 'utf8'))).toMatchObject({ diagnosticPassed: true, failure: null, fullVerification: false });
  expect(mocks.run).toHaveBeenCalledOnce();
});

test('T-030: Given a rejected host and failed status persistence, When the diagnostic ends, Then both failures survive with the original host error first', async () => {
  const path = await root(); const rejection = new Error('original host rejection'); mocks.scan.mockResolvedValue([]);
  mocks.run.mockImplementation(async (_check, options) => {
    const log = options?.failureLogPath; if (log === undefined) { throw new Error('Missing evidence path'); }
    await mkdir(join(dirname(log), 'json-memory-probe-status.json')); throw rejection;
  });
  vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  let captured: unknown; try { await runMacJsonMemoryProbe(path, 'darwin'); } catch (error: unknown) { captured = error; }
  expect(captured).toBeInstanceOf(AggregateError); if (!(captured instanceof AggregateError)) { throw captured; }
  expect(captured.errors).toHaveLength(2); expect(captured.errors[0]).toBe(rejection);
  expect(captured.message).toContain('original host rejection'); expect(captured.message).toContain('Probe status could not be saved');
  expect(mocks.run).toHaveBeenCalledOnce();
});

test('T-030: Given the manual JSON memory workflow, When inspected, Then only macOS runs and both success and failure retain raw console, status and host logs', async () => {
  const text = await readFile('.github/workflows/macos-json-memory.yml', 'utf8');
  expect(text).toMatch(/^on: workflow_dispatch$/m); expect(text).toContain('runs-on: macos-latest');
  expect(text).toContain('contents: read'); expect(text).toContain('persist-credentials: false');
  expect(text).toContain('npm ci'); expect(text).toContain('npm run compile-tests'); expect(text).toContain('npm run build');
  expect(text).toContain('node scripts/macos-json-memory-probe.mts 2>&1 | tee out/macos-json-memory-console.log');
  expect(text).toContain("steps.probe.outcome == 'success'"); expect(text).toContain("steps.probe.outcome == 'failure'");
  expect(text).toContain('out/integration-profile-macos-json-*/logs/'); expect(text).toContain('out/integration-profile-macos-json-*/json-memory-probe-status.json');
  expect(text).toContain('out/macos-json-memory-console.log'); expect(text).toContain('if-no-files-found: error');
  expect(text).not.toMatch(/pull_request|\bpush:|continue-on-error|verify:full|sudo|--timeout/);
});
