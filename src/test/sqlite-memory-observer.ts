import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

/** One persistent OS reader. Cold initialization precedes the observed window;
 * every subsequent snapshot still has the strict 3 s watchdog and gap gate. */
export function observeProcessLines(command: string, args: string[], onLine: (line: string) => void | Promise<void>, signal: AbortSignal, startupMs = 20000, snapshotMs = 3000, acknowledge = false): Promise<void> {
  if (signal.aborted) { return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const child = acknowledge ? spawn(command, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = createInterface({ input: child.stdout });
    let failure: Error | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const stop = (): void => { child.kill('SIGKILL'); };
    const fail = (error: Error): void => { failure ??= error; stop(); };
    const arm = (phase: string, milliseconds: number): void => {
      clearTimeout(timer);
      timer = setTimeout(() => { fail(new Error(`OS observer ${phase} exceeded ${String(milliseconds)} ms.`)); }, milliseconds);
    };
    arm('startup', startupMs);
    signal.addEventListener('abort', stop, { once: true });
    child.once('error', (error) => { failure ??= error; });
    child.stderr.on('data', (chunk: Buffer) => { fail(new Error(`OS observer diagnostic: ${chunk.toString()}`)); });
    lines.on('line', (line) => {
      if (failure !== undefined || signal.aborted) { return; }
      try {
        if (Buffer.byteLength(line) > 4 * 1024 * 1024) { throw new Error('OS observer snapshot exceeds 4 MiB.'); }
        arm('snapshot', snapshotMs);
        void Promise.resolve(onLine(line)).then(() => {
          if (acknowledge && failure === undefined && !signal.aborted) { child.stdin?.write('\n'); }
        }, (error: unknown) => { fail(error instanceof Error ? error : new Error('OS observer snapshot failed.')); });
      } catch (error: unknown) { fail(error instanceof Error ? error : new Error('OS observer snapshot failed.')); }
    });
    child.once('close', (code, exitSignal) => {
      clearTimeout(timer); lines.close(); signal.removeEventListener('abort', stop);
      if (failure !== undefined) { reject(failure); }
      else if (signal.aborted) { resolve(); }
      else { reject(new Error(`OS observer stopped unexpectedly (code ${String(code)}, signal ${String(exitSignal)}).`)); }
    });
  });
}
