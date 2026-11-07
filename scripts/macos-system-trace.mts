import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, open, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { executeCapability, type CapabilityCommand, type CapabilityResult } from './macos-native-capabilities.mts';

export function recordingCheck(output: string, preflight: boolean): CapabilityCommand {
  return { name: preflight ? 'preflight' : 'recording', command: 'xcrun', args: ['xctrace', 'record', '--template', 'System Trace', '--all-processes',
    '--time-limit', preflight ? '2s' : '45m', '--window', preflight ? '1s' : '120s', '--output', output, '--no-prompt'] };
}
export function timingFailure(line: string): string | undefined {
  const prefix = ['T-030 first host timing breach: ', 'T-015 host export evidence: ', 'T-025 JSON host interval evidence: '].find(value => line.startsWith(value));
  if (prefix === undefined) { return undefined; }
  let value: unknown; try { value = JSON.parse(line.slice(prefix.length)); } catch { throw new Error('Malformed timing evidence.'); }
  if (typeof value !== 'object' || value === null || !('maxGapMs' in value) || typeof value.maxGapMs !== 'number' || !Number.isFinite(value.maxGapMs)) { throw new Error('Malformed timing evidence.'); }
  return value.maxGapMs > 100 ? `${prefix.trim()} raw gap ${String(value.maxGapMs)}ms` : undefined;
}
export interface TraceOperations {
  preflight(): Promise<void>;
  start(): Promise<{ stop(reason: string): Promise<void> }>;
  host(failure: (reason: string) => void): Promise<void>;
  exportTrace(): Promise<void>;
}
/** Supplemental evidence only; an early trace stop never clears host rejection. */
export async function runTraceSession(operations: TraceOperations): Promise<void> {
  await operations.preflight(); const recorder = await operations.start();
  let stopped: Promise<void> | undefined;
  const stop = (reason: string): Promise<void> => { stopped ??= recorder.stop(reason); return stopped; };
  const failures: unknown[] = [];
  try { await operations.host(reason => { void stop(reason).catch(() => {}); }); } catch (error: unknown) { failures.push(error); }
  try { await stop('host finished'); } catch (error: unknown) { failures.push(error); }
  try { await operations.exportTrace(); } catch (error: unknown) { failures.push(error); }
  if (failures.length === 1) { throw failures[0]; }
  if (failures.length > 1) { throw new AggregateError(failures, failures.map(describe).join('\n')); }
}
const describe = (error: unknown): string => error instanceof Error ? error.message : String(error);
const combinedFailure = (failures: unknown[]): unknown => failures.length === 1 ? failures[0] : new AggregateError(failures, failures.map(describe).join('\n'));
export async function closeTraceFiles(files: readonly { close(): Promise<void> }[]): Promise<unknown[]> {
  const outcomes = await Promise.allSettled(files.map(file => file.close()));
  return outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected').map(outcome => outcome.reason as unknown);
}

async function native(directory: string, command: CapabilityCommand, limit = 1048576): Promise<string> {
  const result = await executeCapability(command, { timeoutMs: command.name === 'preflight' ? 30000 : 60000, maxBuffer: limit });
  await retainNativeCapture(directory, command, result);
  return result.stdout.toString('utf8');
}
export async function retainNativeCapture(directory: string, command: CapabilityCommand, result: CapabilityResult): Promise<void> {
  const failures: unknown[] = [];
  if (result.exitCode !== 0 || result.signal !== null || result.killed || result.failureCode !== null) { failures.push(new Error(`Native ${command.name} failed: code=${String(result.exitCode)}, signal=${String(result.signal)}, killed=${String(result.killed)}, failureCode=${String(result.failureCode)}.`)); }
  const writes = await Promise.allSettled([
    writeFile(join(directory, `${command.name}.stdout.log`), result.stdout, { flag: 'wx' }),
    writeFile(join(directory, `${command.name}.stderr.log`), result.stderr, { flag: 'wx' }),
    writeFile(join(directory, `${command.name}.status.json`), JSON.stringify({ command, ...result, stdout: { bytes: result.stdout.length }, stderr: { bytes: result.stderr.length } }, null, 2), { flag: 'wx' }),
  ]);
  for (const write of writes) { if (write.status === 'rejected') { failures.push(write.reason as unknown); } }
  if (failures.length > 0) { throw combinedFailure(failures); }
}
async function exportToc(directory: string, input: string, name: string): Promise<string> {
  const toc = await native(directory, { name, command: 'xcrun', args: ['xctrace', 'export', '--input', input, '--toc'] });
  if (!toc.includes('<trace-toc') || !toc.includes('<table')) { throw new Error(`Native ${name} contains no readable trace tables.`); }
  return toc;
}
async function startRecorder(directory: string, output: string) {
  const stdout = await open(join(directory, 'recording.stdout.log'), 'wx'); let stderr: Awaited<ReturnType<typeof open>>;
  try { stderr = await open(join(directory, 'recording.stderr.log'), 'wx'); }
  catch (error: unknown) { throw combinedFailure([error, ...await closeTraceFiles([stdout])]); }
  const command = recordingCheck(output, false); const started = new Date().toISOString();
  let child: ReturnType<typeof spawn>;
  try { child = spawn(command.command, [...command.args], { shell: false, stdio: ['ignore', stdout.fd, stderr.fd] }); }
  catch (error: unknown) { throw combinedFailure([error, ...await closeTraceFiles([stdout, stderr])]); }
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(accept => { child.once('close', (code, signal) => { accept({ code, signal }); }); });
  try { await new Promise<void>((accept, reject) => { child.once('spawn', accept); child.once('error', reject); }); }
  catch (error: unknown) { await closed; throw combinedFailure([error, ...await closeTraceFiles([stdout, stderr])]); }
  return { stop: async (reason: string): Promise<void> => {
    const alreadyExited = child.exitCode !== null || child.signalCode !== null;
    const requestedAt = new Date().toISOString(); let forced = false;
    if (!alreadyExited) { child.kill('SIGINT'); }
    const deadline = setTimeout(() => { forced = true; child.kill('SIGKILL'); }, 30000);
    let result: Awaited<typeof closed>;
    try { result = await closed; } finally { clearTimeout(deadline); }
    const failures: unknown[] = [];
    if (alreadyExited || forced || result.code !== 0 || result.signal !== null) { failures.push(new Error(`Native recorder did not confirm a normal requested stop: code=${String(result.code)}, signal=${String(result.signal)}, early=${String(alreadyExited)}, forced=${String(forced)}.`)); }
    failures.push(...await closeTraceFiles([stdout, stderr]));
    try { await writeFile(join(directory, 'recording.status.json'), JSON.stringify({ command, pid: child.pid, started, requestedAt, finished: new Date().toISOString(),
      reason, requestedSignal: 'SIGINT', alreadyExited, forced, ...result, scope: 'Rolling120s native capture; process spawn is not proof of recording readiness. Inspect native trace timestamps/tables before attribution.' }, null, 2), { flag: 'wx' });
    } catch (error: unknown) { failures.push(error); }
    if (failures.length > 0) { throw combinedFailure(failures); }
  } };
}
export async function captureTraceHost(directory: string, root: string, failure: (reason: string) => void,
  options: { command: string; args: readonly string[]; echo?: boolean } = { command: process.execPath, args: [join(root, 'scripts', 'integration-check.mts')] }): Promise<void> {
  const log = await open(join(directory, 'integration-console.log'), 'wx'); let parsingFailure: unknown;
  const streams = { stdout: { pending: '', decoder: new StringDecoder('utf8') }, stderr: { pending: '', decoder: new StringDecoder('utf8') } };
  let child: ReturnType<typeof spawn> & { stdout: import('node:stream').Readable; stderr: import('node:stream').Readable };
  try {
    child = spawn(options.command, [...options.args], {
      cwd: root, env: { ...process.env, LITE_VOYAGER_INTERVAL_DIAGNOSTICS: '1' }, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    const failures = [error, ...await closeTraceFiles([log])];
    try { await writeFile(join(directory, 'host.status.json'), JSON.stringify({ code: null, signal: null, capturedBytes: 0, writtenBytes: 0, launchFailure: describe(error) }, null, 2), { flag: 'wx' }); }
    catch (statusError: unknown) { failures.push(statusError); }
    throw combinedFailure(failures);
  }
  let writing = Promise.resolve(); let writeFailure: unknown; let queued = 0; let capturedBytes = 0; let writtenBytes = 0;
  const inspect = (text: string, stream: 'stdout' | 'stderr', end = false): void => {
    if (parsingFailure !== undefined) { return; } const state = streams[stream];
    state.pending += text; const lines = state.pending.split(/\r?\n/u); state.pending = end ? '' : lines.pop() ?? '';
    try {
      if (state.pending.length > 65536 || lines.some(line => line.length > 65536)) { throw new Error('Timing evidence line exceeds diagnostic parser bound; raw bytes retained.'); }
      for (const line of lines) { const reason = timingFailure(line); if (reason !== undefined) { failure(reason); } }
    } catch (error: unknown) { parsingFailure = error; failure('diagnostic parser failure'); }
  };
  const capture = (chunk: Buffer, destination: NodeJS.WriteStream, stream: 'stdout' | 'stderr'): void => {
    queued += chunk.length; capturedBytes += chunk.length;
    if (queued > 1048576) { child.stdout.pause(); child.stderr.pause(); }
    writing = writing.then(async () => {
      try {
        if (writeFailure === undefined) {
          let offset = 0; while (offset < chunk.length) { const result = await log.write(chunk, offset, chunk.length - offset); if (result.bytesWritten <= 0) { throw new Error('Raw console write made no progress.'); } offset += result.bytesWritten; writtenBytes += result.bytesWritten; }
        }
      } catch (error: unknown) { writeFailure ??= error; }
      finally { queued -= chunk.length; if (queued < 524288) { child.stdout.resume(); child.stderr.resume(); } }
    });
    if (options.echo !== false) { destination.write(chunk); } inspect(streams[stream].decoder.write(chunk), stream);
  };
  child.stdout.on('data', (chunk: Buffer) => { capture(chunk, process.stdout, 'stdout'); }); child.stderr.on('data', (chunk: Buffer) => { capture(chunk, process.stderr, 'stderr'); });
  let launchFailure: Error | undefined; child.once('error', (error: Error) => { launchFailure = error; });
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(accept => { child.once('close', (code, signal) => { accept({ code, signal }); }); });
  inspect(streams.stdout.decoder.end(), 'stdout', true); inspect(streams.stderr.decoder.end(), 'stderr', true);
  await writing; let closeFailure: unknown; try { await log.close(); } catch (error: unknown) { closeFailure = error; }
  const failures: unknown[] = [];
  if (launchFailure !== undefined) { failures.push(launchFailure); }
  if (result.code !== 0 || result.signal !== null) { failures.push(new Error(`Original integration host rejected: code=${String(result.code)}, signal=${String(result.signal)}.`)); }
  if (parsingFailure !== undefined) { failures.push(parsingFailure); }
  if (writeFailure !== undefined) { failures.push(new Error(`Raw console persistence failed; ${String(capturedBytes - writtenBytes)} bytes are not retained.`, { cause: writeFailure })); }
  if (closeFailure !== undefined) { failures.push(closeFailure); }
  try { await writeFile(join(directory, 'host.status.json'), JSON.stringify({ ...result, capturedBytes, writtenBytes,
    launchFailure: launchFailure?.message ?? null, parsingFailure: parsingFailure === undefined ? null : describe(parsingFailure),
    writeFailure: writeFailure === undefined ? null : describe(writeFailure), closeFailure: closeFailure === undefined ? null : describe(closeFailure) }, null, 2), { flag: 'wx' }); }
  catch (error: unknown) { failures.push(new Error(`Host status could not be saved: ${describe(error)}`, { cause: error })); }
  if (failures.length === 1) { throw failures[0]; } if (failures.length > 1) { throw new AggregateError(failures, failures.map(describe).join('\n')); }
}
export async function collectMacSystemTrace(root: string, platform: NodeJS.Platform = process.platform): Promise<void> {
  if (platform !== 'darwin') { throw new Error('System Trace diagnostic is macOS only; no workload executed.'); }
  const output = join(root, 'out'); await mkdir(output, { recursive: true }); const directory = await mkdtemp(join(output, 'macos-system-trace-'));
  const recording = join(directory, 'recording.trace'); const started = new Date().toISOString(); let rejected: unknown; let failure: string | null = null;
  process.stdout.write(`Supplemental native System Trace diagnostic. Evidence: ${directory}. Original host status remains authoritative; this cannot establish full verification.\n`);
  try {
    await runTraceSession({
      preflight: async () => { const path = join(directory, 'preflight.trace'); await native(directory, recordingCheck(path, true)); await exportToc(directory, path, 'preflight-toc'); },
      start: () => startRecorder(directory, recording), host: onFailure => captureTraceHost(directory, root, onFailure),
      exportTrace: async () => {
        const toc = await exportToc(directory, recording, 'recording-toc');
        const schemas = [...new Set([...toc.matchAll(/\bschema="([A-Za-z0-9_.-]+)"/gu)].map(match => match[1]).filter((schema): schema is string => schema !== undefined))];
        const selected = schemas.filter(schema => /thread|sched|syscall|system-call|cpu-state|cpu-profile/iu.test(schema));
        await writeFile(join(directory, 'table-selection.json'), JSON.stringify({ schemas, selected, scope: 'Name-based candidate selection only, not proof of scheduler coverage. Original trace and TOC retained.' }, null, 2), { flag: 'wx' });
        const failures: unknown[] = [];
        for (const [index, schema] of selected.entries()) {
          try { await native(directory, { name: `table-${String(index)}`, command: 'xcrun', args: ['xctrace', 'export', '--input', recording, '--xpath', `/trace-toc/run[@number="1"]/data/table[@schema="${schema}"]`] }, 16777216); }
          catch (error: unknown) { failures.push(error); }
        }
        if (failures.length > 0) { throw new AggregateError(failures, failures.map(describe).join('\n')); }
      },
    });
  } catch (error: unknown) { rejected = error; failure = describe(error); throw error; }
  finally {
    try { await writeFile(join(directory, 'diagnostic.status.json'), JSON.stringify({ started, finished: new Date().toISOString(), commit: process.env['GITHUB_SHA'] ?? null,
      failure, diagnosticPassed: failure === null, fullVerification: false, retainedWindowSeconds: 120,
      scope: 'One instrumented original full host suite. Native profiling changes execution conditions; no acceptance replacement, cause claim or retry-to-green.' }, null, 2), { flag: 'wx' }); }
    catch (error: unknown) { if (failure !== null) { throw new AggregateError([rejected, error], `${failure}\nDiagnostic status could not be saved: ${describe(error)}`); } throw error; }
  }
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await collectMacSystemTrace(resolve(dirname(fileURLToPath(import.meta.url)), '..')); }
  catch (error: unknown) { process.stderr.write(`${describe(error)}\n`); process.exitCode = 1; }
}
