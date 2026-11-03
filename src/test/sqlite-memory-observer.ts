import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

/** One persistent OS reader. Cold initialization precedes the observed window;
 * every subsequent snapshot still has the strict 3 s watchdog and gap gate. */
export function observeProcessLines(command: string, args: string[], onLine: (line: string) => void | Promise<void>, signal: AbortSignal, startupMs = 20000, snapshotMs = 3000, acknowledge = false, retainStderr = false): Promise<void> {
  if (signal.aborted) { return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const child = acknowledge ? spawn(command, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = createInterface({ input: child.stdout });
    let failure: Error | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let drain: ReturnType<typeof setTimeout> | undefined;
    let diagnostic: Buffer | undefined; let diagnosticBytes = 0;
    let diagnosticFirst = false; let truncated = false; let terminated = false;
    let stage = 'waiting for first snapshot'; let snapshots = 0;
    const stop = (): void => { terminated = true; clearTimeout(drain); child.kill('SIGKILL'); };
    const fail = (error: Error): void => { failure ??= error; stop(); };
    const arm = (phase: string, milliseconds: number): void => {
      clearTimeout(timer);
      timer = setTimeout(() => { fail(new Error(`OS observer ${phase} exceeded ${String(milliseconds)} ms; stage=${stage}; snapshots=${String(snapshots)}.`)); }, milliseconds);
    };
    arm('startup', startupMs);
    signal.addEventListener('abort', stop, { once: true });
    child.once('error', (error) => { failure ??= error; clearTimeout(drain); });
    child.stderr.on('data', (chunk: Buffer) => {
      if (!retainStderr) { fail(new Error(`OS observer diagnostic: ${chunk.toString()}`)); return; }
      if (diagnostic === undefined) {
        diagnostic = Buffer.alloc(16384); diagnosticFirst = failure === undefined;
        failure ??= new Error('OS observer diagnostic');
        // Failure is immediate. Only capture is deferred, with no watchdog
        // reset and no more snapshots/acknowledgments after the first byte.
        if (!terminated) { drain = setTimeout(stop, 100); }
      }
      const copied = chunk.copy(diagnostic, diagnosticBytes); diagnosticBytes += copied;
      if (copied < chunk.length) { truncated = true; stop(); }
    });
    lines.on('line', (line) => {
      if (failure !== undefined || signal.aborted) { return; }
      try {
        if (Buffer.byteLength(line) > 4 * 1024 * 1024) { throw new Error('OS observer snapshot exceeds 4 MiB.'); }
        const snapshot = ++snapshots; stage = 'processing snapshot';
        arm('snapshot', snapshotMs);
        void Promise.resolve(onLine(line)).then(() => {
          // Diagnostics must not re-arm the watchdog: processing and the next
          // native read still share the original strict snapshot deadline.
          if (snapshot === snapshots) { stage = 'waiting for next snapshot'; }
          if (acknowledge && failure === undefined && !signal.aborted) { child.stdin?.write('\n'); }
        }, (error: unknown) => { fail(error instanceof Error ? error : new Error('OS observer snapshot failed.')); });
      } catch (error: unknown) { fail(error instanceof Error ? error : new Error('OS observer snapshot failed.')); }
    });
    child.once('close', (code, exitSignal) => {
      clearTimeout(timer); clearTimeout(drain); lines.close(); signal.removeEventListener('abort', stop);
      if (diagnostic !== undefined) {
        const suffix = `${truncated ? '\n[diagnostic truncated at 16384 bytes]' : ''}${terminated ? '\n[diagnostic incomplete: native process terminated]' : ''}`;
        const message = `OS observer diagnostic: ${diagnostic.subarray(0, diagnosticBytes).toString('utf8')}${suffix}`;
        failure = new Error(diagnosticFirst ? message : `${failure?.message ?? 'OS observer failed'}\n${message}`);
      }
      if (failure !== undefined) { reject(failure); }
      else if (signal.aborted) { resolve(); }
      else { reject(new Error(`OS observer stopped unexpectedly (code ${String(code)}, signal ${String(exitSignal)}).`)); }
    });
  });
}
