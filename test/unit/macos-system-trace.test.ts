import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test, vi } from 'vitest';
import { captureTraceHost, closeTraceFiles, recordingCheck, retainNativeCapture, runTraceSession, timingFailure } from '../../scripts/macos-system-trace.mts';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(async path => {
  const target = resolve(path); if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('lv-trace-host-')) { throw new Error('Unexpected cleanup target'); }
  await rm(target, { recursive: true, force: true });
})); });
async function directory(): Promise<string> { const path = await mkdtemp(join(tmpdir(), 'lv-trace-host-')); directories.push(path); return path; }

function operations() {
  return { preflight: vi.fn<() => Promise<void>>(() => Promise.resolve()), start: vi.fn<() => Promise<{ stop(reason: string): Promise<void> }>>(() => Promise.resolve({ stop: vi.fn(() => Promise.resolve()) })),
    host: vi.fn<(failure: (reason: string) => void) => Promise<void>>(() => Promise.resolve()), exportTrace: vi.fn<() => Promise<void>>(() => Promise.resolve()) };
}
test('T-030: Given a native System Trace, When constructing capture commands, Then all processes, fixed time/window bounds and noninteractive output use the installed manual grammar', () => {
  expect(recordingCheck('capture.trace', true)).toEqual({ name: 'preflight', command: 'xcrun', args: ['xctrace', 'record', '--template', 'System Trace', '--all-processes', '--time-limit', '2s', '--window', '1s', '--output', 'capture.trace', '--no-prompt'] });
  expect(recordingCheck('capture.trace', false).args).toContain('45m'); expect(recordingCheck('capture.trace', false).args).toContain('120s');
});
test.each(['T-030 first host timing breach: ', 'T-015 host export evidence: ', 'T-025 JSON host interval evidence: '])('T-030: Given original %s timer evidence, When a raw gap exceeds 100ms, Then capture stops at that interval without adjusting it', (prefix) => {
  expect(timingFailure(prefix + '{"maxGapMs":286.739084}')).toContain('286.739084');
  expect(timingFailure(prefix + '{"maxGapMs":100}')).toBeUndefined();
  expect(timingFailure(prefix + '{"maxGapMs":99.9}')).toBeUndefined();
  expect(() => timingFailure(prefix + 'broken')).toThrow('Malformed timing evidence');
});
test('T-030: Given OS memory-observer gaps with different limits, When inspecting console evidence, Then they cannot prematurely stop the export trace', () => {
  expect(timingFailure('T-016 memory evidence: {"maxGapMs":759}')).toBeUndefined();
});
test('T-030: Given denied native preflight, When collection starts, Then neither recorder nor original host workload runs', async () => {
  const ops = operations(); const rejection = new Error('recording denied'); ops.preflight = vi.fn(() => Promise.reject(rejection));
  await expect(runTraceSession(ops)).rejects.toBe(rejection); expect(ops.start).not.toHaveBeenCalled(); expect(ops.host).not.toHaveBeenCalled();
});
test('T-030: Given a recorder that cannot start, When preflight succeeded, Then no host workload runs', async () => {
  const ops = operations(); const rejection = new Error('recorder unavailable'); ops.start = vi.fn(() => Promise.reject(rejection));
  await expect(runTraceSession(ops)).rejects.toBe(rejection); expect(ops.host).not.toHaveBeenCalled();
});
test('T-030: Given a timing failure followed by a host rejection, When later tests finish, Then the first interval is preserved by exactly one early stop and the original rejection survives', async () => {
  const ops = operations(); const rejection = new Error('original host rejected'); const order: string[] = [];
  const stop = vi.fn((reason: string) => { order.push(reason); return Promise.resolve(); }); ops.start = vi.fn(() => Promise.resolve({ stop }));
  ops.host = vi.fn((failure: (reason: string) => void) => { failure('first gap'); failure('later gap'); order.push('later tests'); return Promise.reject(rejection); });
  await expect(runTraceSession(ops)).rejects.toBe(rejection); expect(stop).toHaveBeenCalledExactlyOnceWith('first gap');
  expect(order).toEqual(['first gap', 'later tests']); expect(ops.exportTrace).toHaveBeenCalledOnce(); expect(ops.host).toHaveBeenCalledOnce();
});
test('T-030: Given host, recorder-stop and export failures, When cleanup finishes, Then all three errors survive with host failure first', async () => {
  const ops = operations(); const host = new Error('host rejected'); const stop = new Error('stop rejected'); const output = new Error('export rejected');
  ops.host = vi.fn(() => Promise.reject(host)); ops.start = vi.fn(() => Promise.resolve({ stop: vi.fn(() => Promise.reject(stop)) })); ops.exportTrace = vi.fn(() => Promise.reject(output));
  let captured: unknown; try { await runTraceSession(ops); } catch (error: unknown) { captured = error; }
  expect(captured).toBeInstanceOf(AggregateError); if (!(captured instanceof AggregateError)) { throw captured; }
  expect(captured.errors).toEqual([host, stop, output]); expect(ops.host).toHaveBeenCalledOnce();
});
test('T-030: Given no timing failure, When the original host completes, Then capture stops once at completion and exports evidence', async () => {
  const ops = operations(); const stop = vi.fn(() => Promise.resolve()); ops.start = vi.fn(() => Promise.resolve({ stop }));
  await runTraceSession(ops); expect(stop).toHaveBeenCalledExactlyOnceWith('host finished'); expect(ops.exportTrace).toHaveBeenCalledOnce();
});
const fixture = { command: process.execPath, echo: false, args: ['-e', 'process.stdout.write("T-015 host export evidence: ",()=>process.stderr.write("retained stderr\\n",()=>setTimeout(()=>{process.stdout.write("{\\"maxGapMs\\":286.739084}\\n");process.exitCode=7},20)))'] };

test('T-030: Given synchronous launch argument rejection, When capture cannot spawn, Then the raw handle closes and launch status survives', async () => {
  const path = await directory();
  await expect(captureTraceHost(path, resolve('.'), () => {}, { command: process.execPath, args: ['\0'], echo: false })).rejects.toThrow();
  expect(JSON.parse(await readFile(join(path, 'host.status.json'), 'utf8'))).toMatchObject({ code: null, signal: null, capturedBytes: 0, writtenBytes: 0 });
  await rm(join(path, 'integration-console.log'));
});
test('T-030: Given split console timing records and a nonzero host exit, When the real capture transport finishes, Then unfiltered stdout/stderr, first-gap notification and original status survive', async () => {
  const path = await directory(); const failure = vi.fn();
  await expect(captureTraceHost(path, resolve('.'), failure, fixture)).rejects.toThrow('Original integration host rejected: code=7');
  expect(failure).toHaveBeenCalledExactlyOnceWith('T-015 host export evidence: raw gap 286.739084ms');
  const raw = await readFile(join(path, 'integration-console.log'), 'utf8'); expect(raw).toContain('T-015 host export evidence: '); expect(raw).toContain('{"maxGapMs":286.739084}\n'); expect(raw).toContain('retained stderr\n');
  expect(JSON.parse(await readFile(join(path, 'host.status.json'), 'utf8'))).toMatchObject({ code: 7, signal: null });
});
test('T-030: Given a host rejection and blocked status path, When status persistence fails, Then it cannot replace the original rejection', async () => {
  const path = await directory(); await mkdir(join(path, 'host.status.json'));
  let captured: unknown; try { await captureTraceHost(path, resolve('.'), () => {}, fixture); } catch (error: unknown) { captured = error; }
  expect(captured).toBeInstanceOf(AggregateError); if (!(captured instanceof AggregateError)) { throw captured; }
  expect(captured.errors).toHaveLength(2); expect(captured.message).toContain('Original integration host rejected: code=7');
  expect(captured.message).toContain('Host status could not be saved');
});
test('T-030: Given a failed first recorder-file close, When cleanup runs, Then every other handle still closes and its failure is retained', async () => {
  const first = new Error('first close rejected'); const left = { close: vi.fn(() => Promise.reject(first)) }; const right = { close: vi.fn(() => Promise.resolve()) };
  expect(await closeTraceFiles([left, right])).toEqual([first]); expect(left.close).toHaveBeenCalledOnce(); expect(right.close).toHaveBeenCalledOnce();
});
test('T-030: Given native exit failure and blocked native status persistence, When evidence is retained, Then both raw streams survive and native exit failure remains first', async () => {
  const path = await directory(); await mkdir(join(path, 'preflight.status.json'));
  let captured: unknown;
  try { await retainNativeCapture(path, recordingCheck('capture.trace', true), { stdout: Buffer.from([255, 0, 97]), stderr: Buffer.from('native diagnostic'), exitCode: 7, signal: null, killed: false, failureCode: null }); }
  catch (error: unknown) { captured = error; }
  expect(captured).toBeInstanceOf(AggregateError); if (!(captured instanceof AggregateError)) { throw captured; }
  expect(captured.errors).toHaveLength(2); expect(captured.message).toContain('Native preflight failed: code=7');
  expect(await readFile(join(path, 'preflight.stdout.log'))).toEqual(Buffer.from([255, 0, 97]));
  expect(await readFile(join(path, 'preflight.stderr.log'), 'utf8')).toBe('native diagnostic');
});
test('T-030: Given the native trace workflow, When configured, Then only one manual macOS full-host diagnostic runs and both outcomes retain its raw trace and logs', async () => {
  const text = await readFile('.github/workflows/macos-system-trace.yml', 'utf8');
  expect(text).toMatch(/^on: workflow_dispatch$/m); expect(text).toContain('runs-on: macos-latest'); expect(text).toContain('contents: read'); expect(text).toContain('persist-credentials: false');
  expect(text).toContain('npm run verify'); expect(text).toContain('npm run compile-tests'); expect(text).toContain('node scripts/macos-system-trace.mts');
  expect(text).toContain("steps.probe.outcome == 'failure'"); expect(text).toContain("steps.probe.outcome == 'success'");
  expect(text).toContain('out/macos-system-trace-*/'); expect(text).toContain('out/integration-profile-*/logs/'); expect(text).toContain('include-hidden-files: true');
  expect(text).not.toMatch(/pull_request|\bpush:|continue-on-error|sudo|--timeout|--retries/);
});
