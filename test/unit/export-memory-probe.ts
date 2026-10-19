import { execFile, type ChildProcess } from 'node:child_process';

/** Isolated test probe; completion includes the child's actual close event. */
export function startExportProbe(path: string, signal: AbortSignal) {
  signal.throwIfAborted();
  let child: ChildProcess | undefined;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
  const result = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    try {
      child = execFile(process.execPath, [path], { windowsHide: true, signal, killSignal: 'SIGKILL' }, (error, stdout, stderr) => {
        void closed.then(() => {
          if (error !== null) {
            const failure = error instanceof Error ? error : new Error('The isolated export probe could not run.');
            reject(Object.assign(failure, { stdout, stderr }));
          }
          else { resolve({ stdout, stderr }); }
        });
      });
      child.once('close', resolveClosed);
    } catch (error: unknown) {
      resolveClosed(); reject(error instanceof Error ? error : new Error('The isolated export probe could not start.'));
    }
  });
  void result.catch(() => {});
  let stopping: Promise<void> | undefined;
  return { result, closed, stop(): Promise<void> {
    stopping ??= (async () => {
      if (child !== undefined && child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); }
      await closed; await result.catch(() => {});
    })();
    return stopping;
  } };
}
