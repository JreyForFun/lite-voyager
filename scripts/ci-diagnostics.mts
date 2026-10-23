import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

export interface ShutdownSignal { phase: 'started' | 'exited'; pid: number; }
interface Collector { accept(value: ShutdownSignal): void; finish(): Promise<void>; }
type Write = (chunk: Buffer, stream: 'stdout' | 'stderr') => void;

export class HostExitLines {
  private partial = '';
  private discarding = false;
  droppedLines = 0;
  constructor(private readonly maximum = 65536) {}
  feed(text: string): ShutdownSignal[] {
    const signals: ShutdownSignal[] = [];
    for (const character of text) {
      if (character === '\n') {
        if (!this.discarding) {
          const line = stripVTControlCharacters(this.partial);
          const start = /\bStarted local extension host with pid (\d+)\./u.exec(line);
          const end = /\bExtension host with pid (\d+) exited with code: -?\d+, signal:/u.exec(line);
          const pid = Number(start?.[1] ?? end?.[1]);
          if (Number.isSafeInteger(pid) && pid > 0) { signals.push({ phase: start === null ? 'exited' : 'started', pid }); }
        }
        this.partial = ''; this.discarding = false;
      } else if (!this.discarding) {
        if (this.partial.length + character.length > this.maximum) { this.partial = ''; this.discarding = true; this.droppedLines++; }
        else { this.partial += character; }
      }
    }
    return signals;
  }
}

/** Forward the original byte streams and status; collection cannot turn failure green. */
export async function runDiagnosticCommand(command: string, args: string[], collector?: Collector,
  write: Write = (chunk, stream) => { process[stream].write(chunk); }) {
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
    LITE_VOYAGER_INTERVAL_DIAGNOSTICS: '1', LITE_VOYAGER_DIAGNOSTIC_CHILD: '1' } });
  const readers = [new HostExitLines(), new HostExitLines()]; const decoders = [new StringDecoder('utf8'), new StringDecoder('utf8')];
  let collectorFailure: string | undefined;
  const accept = (text: string, index: number): void => {
    if (collector === undefined) { return; }
    for (const value of readers[index]?.feed(text) ?? []) {
      try { collector?.accept(value); } catch (error: unknown) { collectorFailure ??= String(error); }
    }
  };
  child.stdout.on('data', (chunk: Buffer) => { write(chunk, 'stdout'); accept(decoders[0]?.write(chunk) ?? '', 0); });
  child.stderr.on('data', (chunk: Buffer) => { write(chunk, 'stderr'); accept(decoders[1]?.write(chunk) ?? '', 1); });
  const status = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((acceptStatus) => {
    child.once('error', (error) => { collectorFailure ??= `Verification startup: ${error.message}`; });
    child.once('close', (code, signal) => { acceptStatus({ code, signal }); });
  });
  for (let index = 0; index < readers.length; index++) { accept(`${decoders[index]?.end() ?? ''}\n`, index); }
  if (readers.some((reader) => reader.droppedLines > 0)) { collectorFailure ??= 'Lifecycle console trace exceeded its explicit line bound.'; }
  try { await collector?.finish(); } catch (error: unknown) { collectorFailure ??= String(error); }
  return { code: status.code === 0 && collectorFailure !== undefined ? 1 : status.code, signal: status.signal, collectorFailure };
}

/** External CIM snapshots do not retain an original target handle or send signals. */
export async function startWindowsIdentityCollector(write: (text: string) => void): Promise<Collector> {
  if (process.platform !== 'win32') { throw new Error('Windows identity collection requires Windows.'); }
  const directory = dirname(fileURLToPath(import.meta.url));
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(directory, 'windows-exit-diagnostics.ps1')],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let ready: () => void = () => {}; let rejectReady: (error: Error) => void = () => {};
  const initialized = new Promise<void>((accept, reject) => { ready = accept; rejectReady = reject; });
  let finishing = false; let failure: Error | undefined;
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => { if (line === 'T026 identity ready') { ready(); } else { write(`${line}\n`); } });
  child.stderr.on('data', (chunk: Buffer) => { failure ??= new Error(`Windows identity collector diagnostic: ${chunk.toString().slice(0, 4096)}`); rejectReady(failure); });
  child.stdin.on('error', (error) => { failure ??= error; rejectReady(error); });
  child.on('error', (error) => { failure ??= error; rejectReady(error); });
  const closed = once(child, 'close').then(([code]) => {
    lines.close();
    if (!finishing || code !== 0) { failure ??= new Error(`Windows identity collector stopped (code ${String(code)}).`); }
    if (failure !== undefined) { rejectReady(failure); }
  });
  void closed.catch((error: unknown) => { failure ??= error instanceof Error ? error : new Error(String(error)); rejectReady(failure); });
  const startup = setTimeout(() => { rejectReady(new Error('Windows identity collector startup exceeded 15000 ms.')); }, 15000);
  try { await initialized; }
  catch (error: unknown) { child.kill(); await closed.catch(() => {}); throw error; }
  finally { clearTimeout(startup); }
  let completion: Promise<void> | undefined;
  return {
    accept: (value) => {
      if (!Number.isSafeInteger(value.pid) || value.pid <= 0 || value.pid > 2147483647) { throw new Error('Invalid diagnostic target PID.'); }
      if (failure !== undefined) { throw failure; }
      child.stdin.write(`${value.phase} ${String(value.pid)}\n`);
    },
    finish: () => {
      completion ??= (async () => {
        finishing = true; child.stdin.end();
        const deadline = setTimeout(() => { failure ??= new Error('Windows identity collector shutdown exceeded 10000 ms.'); child.kill(); }, 10000);
        try { await closed; if (failure !== undefined) { throw failure; } } finally { clearTimeout(deadline); }
      })();
      return completion;
    },
  };
}

export async function runCiDiagnostics(): Promise<void> {
  const collector = process.platform === 'win32' ? await startWindowsIdentityCollector((text) => { process.stdout.write(text); }) : undefined;
  const command = process.platform === 'win32' ? process.env['ComSpec'] ?? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run verify:full'] : ['run', 'verify:full'];
  const status = await runDiagnosticCommand(command, args, collector);
  if (status.collectorFailure !== undefined) { process.stderr.write(`CI diagnostic collection failed: ${status.collectorFailure}\n`); }
  process.exitCode = status.code ?? 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runCiDiagnostics().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
