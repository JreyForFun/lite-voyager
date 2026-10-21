import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

interface AwakeLease { release(): Promise<void>; }
interface Helper { command: string; args: readonly string[]; }
interface AwakeOptions { platform?: NodeJS.Platform; acquire?: () => Promise<AwakeLease>; }

/** Only verification owns this request. The shipped extension never imports it. */
export async function withSystemAwake<T>(run: () => Promise<T>, options: AwakeOptions = {}): Promise<T> {
  if ((options.platform ?? process.platform) !== 'win32') { return run(); }
  const lease = await (options.acquire ?? acquireWindowsAwake)();
  let result: { ok: true; value: T } | { ok: false; error: unknown };
  try { result = { ok: true, value: await run() }; }
  catch (error: unknown) { result = { ok: false, error }; }
  try { await lease.release(); }
  catch (error: unknown) {
    if (!result.ok) {
      const describe = (value: unknown): string => value instanceof Error ? value.message : String(value);
      throw new AggregateError([result.error, error], `Verification checks failed: ${describe(result.error)}\nWindows awake cleanup failed: ${describe(error)}`);
    }
    throw error;
  }
  if (!result.ok) { throw result.error; }
  return result.value;
}

export async function acquireWindowsAwake(options: { helper?: Helper; startupMs?: number } = {}): Promise<AwakeLease & { exited: Promise<void>; pid: number | undefined }> {
  const helper = options.helper ?? { command: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./windows-awake.ps1', import.meta.url)), '-OwnerProcessId', String(process.pid)] };
  const child = spawn(helper.command, [...helper.args], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = ''; let diagnostic = ''; let failure: Error | undefined; let requested = false;
  let finishStartup: () => void = () => {};
  let rejectStartup: (error: Error) => void = () => {};
  const ready = new Promise<void>((accept, reject) => { finishStartup = accept; rejectStartup = reject; });
  const fail = (error: Error): void => { failure ??= error; rejectStartup(error); };
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
    if (output.length > 65536) { fail(new Error('Windows awake helper exceeded its output bound.')); child.kill(); }
    if (output.replaceAll('\r\n', '\n') === 'lite-voyager-awake-ready\n') { finishStartup(); }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    diagnostic += chunk.toString();
    fail(new Error(`Windows awake helper emitted a diagnostic: ${diagnostic}`));
    child.kill();
  });
  child.stdin.on('error', (error: Error) => fail(new Error(`Windows awake helper input failed: ${error.message}`)));
  const exited = new Promise<void>((accept) => {
    child.once('error', (error: Error) => { fail(new Error(`Windows awake helper could not start: ${error.message}`)); accept(); });
    child.once('close', (code, signal) => {
      if (!requested || code !== 0 || signal !== null) { fail(new Error(`Windows awake helper exited ${requested ? 'during release' : 'prematurely'}: code=${String(code)}, signal=${String(signal)}.`)); }
      accept();
    });
  });
  const startup = setTimeout(() => {
    fail(new Error('Windows awake helper acknowledgement deadline exceeded.'));
    child.kill();
  }, options.startupMs ?? 15000);
  try { await ready; }
  catch (error: unknown) { child.kill(); await exited; throw error; }
  finally { clearTimeout(startup); }
  return {
    pid: child.pid,
    exited,
    release: async () => {
      requested = true;
      child.stdin.end();
      const shutdown = setTimeout(() => { fail(new Error('Windows awake helper release deadline exceeded.')); child.kill(); }, 5000);
      try {
        await exited;
        if (failure !== undefined) { throw failure; }
        if (output.replaceAll('\r\n', '\n') !== 'lite-voyager-awake-ready\nlite-voyager-awake-released\n' || diagnostic !== '') { throw new Error('Windows awake helper did not acknowledge native request release.'); }
      } finally { clearTimeout(shutdown); }
    },
  };
}
