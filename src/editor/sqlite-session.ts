import type { Engine, EngineMode, EngineOpened } from '../engine/engine';

export interface SqliteEditorState {
  phase: 'opening' | 'opened' | 'error' | 'cancelled' | 'closed';
  message: string;
  mode?: EngineMode;
  opened?: EngineOpened;
}
type Confirm = (mode: EngineMode) => Promise<boolean>;

/** One document owns one worker-backed Engine. No file IO runs in this module. */
export class SqliteSession {
  state: SqliteEditorState = { phase: 'opening', message: 'Opening SQLite in a worker…' };
  readonly closed: Promise<void>;
  private resolveClosed!: () => void;
  private readonly listeners = new Set<() => void>();
  private opening: Promise<void> | undefined;
  private shutdown: Promise<void> | undefined;
  private stopped = false;

  constructor(private readonly path: string | undefined, private readonly engine: Engine) {
    this.closed = new Promise((resolve) => { this.resolveClosed = resolve; });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  start(confirm: Confirm): Promise<void> {
    if (this.stopped) { return this.shutdown ?? Promise.resolve(); }
    this.opening ??= this.open(confirm);
    return this.opening;
  }

  private async open(confirm: Confirm): Promise<void> {
    this.update({ ...this.state, phase: 'opening' });
    try {
      if (this.path === undefined) { throw new Error('Open a saved local SQLite file. Virtual, untitled and backup resources are not supported.'); }
      const opened = await this.engine.open(this.path, {
        onMode: (mode) => { if (!this.stopped) { this.update({ ...this.state, mode }); } },
        confirmLargeFile: async (mode) => !this.stopped && await confirm(mode) && !this.stopped,
      });
      if (!this.stopped) {
        this.update({ phase: 'opened', message: 'Opened SQLite. Source file is read-only.', mode: opened, opened });
      }
    } catch (error: unknown) {
      if (!this.stopped) {
        this.stopped = true;
        this.update({ ...this.state, phase: 'error', message: error instanceof Error ? error.message : 'Unable to open SQLite. Reopen the file to retry.' });
      }
    } finally {
      if (this.stopped) { await this.closeEngine(); }
    }
  }

  async cancel(): Promise<void> {
    if (!this.stopped) {
      this.stopped = true;
      this.update({ ...this.state, phase: 'cancelled', message: 'Opening was cancelled. Reopen the file to retry. The source file was not modified.' });
    }
    await this.closeEngine();
  }

  async close(): Promise<void> {
    this.stopped = true;
    this.update({ ...this.state, phase: 'closed', message: 'The SQLite editor is closed.' });
    this.listeners.clear();
    await this.closeEngine();
  }

  private closeEngine(): Promise<void> {
    this.shutdown ??= (async () => {
      try { await this.engine.close(); }
      catch {
        this.update({ ...this.state, phase: 'error', message: `${this.state.message} The database helper could not be closed. Close the editor and reload VS Code.` });
      } finally { this.resolveClosed(); }
    })();
    return this.shutdown;
  }

  private update(state: SqliteEditorState): void {
    this.state = state;
    for (const listener of this.listeners) { listener(); }
  }
}
