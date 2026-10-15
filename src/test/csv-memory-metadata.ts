import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ProcessIdentity } from './csv-memory-cache';

/** Test-only persistent metadata reader. One outstanding query; never caches RSS. */
export class ProcessMetadataReader {
  readonly ready: Promise<void>;
  private readonly child;
  private readonly exited: Promise<void>;
  private failure: Error | undefined;
  private stopping = false;
  private pending: { accept: (value: unknown) => void; reject: (error: Error) => void } | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopTask: Promise<void> | undefined;
  constructor(command: string, args: string[], startupMs = 20000, private readonly requestMs = 2000) {
    this.child = spawn(command, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const child = this.child; const lines = createInterface({ input: child.stdout });
    let initialized = false;
    this.ready = new Promise<void>((accept, reject) => {
      this.pending = { accept: () => { accept(); }, reject };
      this.timer = setTimeout(() => { this.fail(new Error('OS metadata startup deadline exceeded.')); }, startupMs);
      lines.on('line', (line) => {
        if (this.stopping || this.failure !== undefined) { return; }
        try {
          if (Buffer.byteLength(line) > 4 * 1024 * 1024) { throw new Error('OS metadata response exceeds 4 MiB.'); }
          const value: unknown = JSON.parse(line);
          if (typeof value !== 'object' || value === null || !('type' in value)) { throw new Error('Invalid OS metadata response.'); }
          if (!initialized && value.type === 'ready') { initialized = true; this.complete(undefined); }
          else if (initialized && value.type === 'metadata' && 'rows' in value && this.pending !== undefined) { this.complete(value.rows); }
          else { throw new Error('Unexpected OS metadata response.'); }
        } catch { this.fail(new Error('Invalid OS metadata response.')); }
      });
    });
    void this.ready.catch(() => {});
    child.stderr.on('data', (chunk: Buffer) => { this.fail(new Error(`OS metadata diagnostic: ${chunk.toString()}`)); });
    child.on('error', (error) => { this.fail(error); });
    child.stdin.on('error', (error) => { if (!this.stopping) { this.fail(error); } });
    this.exited = new Promise<void>((accept) => {
      child.once('close', () => { lines.close(); clearTimeout(this.timer); if (!this.stopping) { this.fail(new Error('OS metadata reader stopped unexpectedly.')); } accept(); });
    });
  }
  async request(items: ProcessIdentity[]): Promise<unknown> {
    await this.ready;
    if (this.failure !== undefined) { throw this.failure; }
    if (this.stopping) { throw new DOMException('OS metadata reader stopped.', 'AbortError'); }
    if (this.pending !== undefined) { throw new Error('OS metadata request already pending.'); }
    return new Promise((accept, reject) => {
      this.pending = { accept, reject };
      this.timer = setTimeout(() => { this.fail(new Error('OS metadata request deadline exceeded.')); }, this.requestMs);
      this.child.stdin.write(`${JSON.stringify({ type: 'metadata', items })}\n`, (error) => { if (error !== null && error !== undefined) { this.fail(error); } });
    });
  }
  private complete(value: unknown): void {
    clearTimeout(this.timer); const pending = this.pending; this.pending = undefined; pending?.accept(value);
  }
  private fail(error: Error): void {
    if (this.stopping) { return; }
    this.failure ??= error; clearTimeout(this.timer); const pending = this.pending; this.pending = undefined; pending?.reject(this.failure);
    if (this.child.exitCode === null && this.child.signalCode === null) { this.child.kill('SIGKILL'); }
  }
  stop(): Promise<void> {
    this.stopTask ??= (async () => {
      this.stopping = true; clearTimeout(this.timer); const pending = this.pending; this.pending = undefined;
      pending?.reject(this.failure ?? new DOMException('OS metadata reader stopped.', 'AbortError'));
      this.child.stdin.end(); const timer = setTimeout(() => { this.child.kill('SIGKILL'); }, 5000);
      try { await this.exited; } finally { clearTimeout(timer); }
    })(); return this.stopTask;
  }
}
