import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseMemorySample, type MemorySample } from './sqlite-memory-support';

/** Test-only: reuse the independently checked OS observer, never bundle it. */
export function observeCsvImport(directory: string, signal: AbortSignal) {
  const child = spawn(process.execPath, [join(directory, 'scripts/csv-memory.mts'), String(process.pid)], {
    windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const samples: MemorySample[] = []; let diagnostic = ''; let failure: Error | undefined;
  child.stderr.on('data', (chunk: Buffer) => { diagnostic += chunk.toString(); });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => { try { samples.push(parseMemorySample(line)); } catch (error: unknown) { failure = error instanceof Error ? error : new Error('Invalid import memory sample.'); } });
  const closed = new Promise<void>((accept, reject) => {
    child.once('error', reject);
    child.once('close', (code) => { lines.close(); if (code === 0 && diagnostic === '' && failure === undefined) { accept(); } else { reject(failure ?? new Error(`CSV memory observer failed: ${diagnostic}`)); } });
  });
  void closed.catch(() => {});
  let stopped: Promise<void> | undefined;
  return {
    samples,
    async next(helperPid?: number): Promise<void> {
      const previous = samples.length; const started = performance.now();
      while (samples.length === previous || (helperPid !== undefined && !samples.at(-1)?.helperIds.includes(helperPid))) {
        signal.throwIfAborted(); if (failure !== undefined) { throw failure; }
        if (child.exitCode !== null) { await closed; throw new Error('CSV memory observer stopped early.'); }
        if (performance.now() - started > (previous === 0 ? 25000 : 5000)) { throw new Error(`CSV memory observer deadline: ${diagnostic}`); }
        await new Promise<void>((accept) => { setTimeout(accept, 20); });
      }
    },
    stop(): Promise<void> {
      stopped ??= (async () => { child.stdin.end(); const timer = setTimeout(() => { child.kill('SIGKILL'); }, 5000); try { await closed; } finally { clearTimeout(timer); } })(); return stopped;
    },
  };
}
