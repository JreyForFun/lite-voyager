import { watch, type FSWatcher } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { SourceState } from '../protocol';

const missing = (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
/** Matches the worker's source-version format for existing SQLite sources. */
export async function sourceFingerprint(path: string, sqlite: boolean): Promise<string> {
  try {
    const canonical = await realpath(path);
    const records = await Promise.all(['', ...(sqlite ? ['-wal'] : [])].map(async suffix => {
      try { const info = await stat(canonical + suffix, { bigint: true }); return [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs].map(String); }
      catch (error: unknown) { if (suffix !== '' && missing(error)) { return null; } throw error; }
    }));
    return JSON.stringify([canonical, records]);
  } catch (error: unknown) { if (missing(error)) { return JSON.stringify([path, null]); } throw error; }
}
interface Actions {
  refresh(): Promise<void>; dirty(): boolean; available(): boolean; confirm(): Promise<boolean>;
  changed(state: SourceState): void; revision?(): unknown;
}
export class SourceChanges {
  readonly ready: Promise<void>;
  state: SourceState = { type: 'sourceState', changed: false, offered: false, busy: false, message: '' };
  private baseline = '';
  private observed = '';
  private disposed = false;
  private checking: Promise<void> | undefined;
  private watcher: FSWatcher | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private holds = 0;
  /** False for read-only views (imports, previews): messages must not promise pending edits that cannot exist. */
  private readonly editable: boolean;
  constructor(private readonly path: string, private readonly sqlite: boolean, private readonly actions: Actions,
    options: { watch?: boolean; intervalMs?: number; editable?: boolean } = {}) {
    this.editable = options.editable ?? true;
    this.ready = (async () => {
      try { this.baseline = this.observed = await sourceFingerprint(path, sqlite); }
      catch { this.report({ message: 'Source monitoring could not read file metadata. Check permissions; periodic checks will retry.' }); }
      if (this.disposed) { return; }
      if (options.watch !== false) {
        try {
          this.watcher = watch(dirname(path), { persistent: false }, (_event, filename) => {
            const name = filename?.toString(); const match = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;
            if (name === undefined || [basename(path), ...(sqlite ? [basename(path) + '-wal'] : [])].some(value => match(value) === match(name))) { void this.check(); }
          });
          this.watcher.on('error', () => { this.report({ message: 'File notifications stopped. Periodic metadata checks remain active; check source directory permissions.' }); });
        } catch { this.report({ message: 'File notifications are unavailable. Periodic metadata checks remain active.' }); }
      }
      this.timer = setInterval(() => { void this.check(); }, options.intervalMs ?? 2000); this.timer.unref();
    })();
  }
  private retained(): string { return this.editable ? 'Current view and pending edits are retained.' : 'The current view is retained.'; }
  private report(change: Partial<SourceState>): void {
    if (this.disposed) { return; }
    this.state = { ...this.state, ...change, message: (change.message ?? this.state.message).slice(0, 2048) }; this.actions.changed(this.state);
  }
  check(): Promise<void> {
    if (this.disposed || this.holds > 0 || this.state.busy) { return Promise.resolve(); }
    if (this.checking !== undefined) { return this.checking; }
    const task = (async () => {
      await this.ready;
      try {
        const current = await sourceFingerprint(this.path, this.sqlite);
        if (this.disposed || this.holds > 0 || this.state.busy || current === this.observed) { return; }
        this.observed = current;
        if (current !== this.baseline) {
          this.report({ changed: true, offered: true, message: current.endsWith(',null]')
            ? `The source file was deleted or is missing. ${this.retained()} Restore it, then refresh.`
            : this.editable
              ? 'The source changed on disk. Refresh to read newer data, or keep the current view. Pending edits are retained until you explicitly discard them.'
              : 'The source changed on disk. Refresh to read newer data, or keep the current view.' });
        } else { this.report({ changed: false, offered: false, message: '' }); }
      } catch { this.report({ changed: true, offered: true, message: `Unable to inspect the source file. ${this.retained()} Check permissions before refreshing.` }); }
    })(); this.checking = task;
    void task.finally(() => { if (this.checking === task) { this.checking = undefined; } }).catch(() => {}); return task;
  }
  async handle(action: 'ready' | 'refresh' | 'keep'): Promise<void> {
    if (this.disposed) { return; }
    if (action === 'ready') { this.report({}); return; }
    if (action === 'keep') { if (!this.state.busy) { this.report({ offered: false, message: !this.state.changed ? '' : this.editable ? 'Current view retained. The source differs on disk; existing save-conflict checks still apply.' : 'Current view retained. The source differs on disk.' }); } return; }
    if (this.state.busy || !this.state.changed) { return; }
    this.report({ busy: true });
    try {
      if (!this.actions.available()) { throw new Error('Wait for the current query, edit, import or save to finish before refreshing.'); }
      const revision = this.actions.revision?.();
      if (this.actions.dirty() && !await this.actions.confirm()) { return; }
      if (this.disposed) { return; }
      if (!this.actions.available() || this.actions.revision?.() !== revision) { throw new Error('Pending work changed or is busy. Wait, review it, then request refresh again.'); }
      const target = await sourceFingerprint(this.path, this.sqlite);
      if (target.endsWith(',null]')) { throw new Error('The source file is missing. Restore it before refreshing.'); }
      await this.actions.refresh();
      this.baseline = this.observed = target; this.report({ changed: false, offered: false, message: '' });
    } catch (error: unknown) { this.report({ changed: true, offered: true, message: `${error instanceof Error ? error.message : 'Unable to refresh.'} ${this.editable ? 'Pending edits were preserved' : 'The current view was preserved'}; no source file was written.` }); }
    finally { this.report({ busy: false }); await this.check(); }
  }
  suspend(): () => Promise<void> {
    this.holds++; let resumed = false;
    return async () => { if (!resumed) { resumed = true; this.holds--; await this.check(); } };
  }
  acceptVersion(version: string): void { if (!this.disposed) { this.baseline = this.observed = version; this.report({ changed: false, offered: false, message: '' }); } }
  dispose(): void { this.disposed = true; this.watcher?.close(); if (this.timer !== undefined) { clearInterval(this.timer); } }
}
