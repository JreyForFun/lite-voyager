import { lstat, mkdtemp, realpath, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { Engine, ExportFormat, ExportProgress, ExportReport } from '../engine/engine';

export type { ExportProgress } from '../engine/engine';
export interface ExportRunner {
  run(sql: string, format: ExportFormat, progress: (report: ExportProgress) => void): Promise<ExportReport | undefined>;
  abort(): void;
  settled(): Promise<void>;
}

async function optionalStat(path: string) {
  try { return await lstat(path); }
  catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') { return undefined; }
    throw error;
  }
}

async function checkDestination(source: string, destination: string): Promise<void> {
  const sourcePath = await realpath(source);
  const targetPath = join(await realpath(dirname(destination)), basename(destination));
  const normalize = (path: string): string => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  const sourceName = normalize(sourcePath); const targetName = normalize(targetPath);
  const protectedPaths = [sourceName, ...['-wal', '-shm', '-journal'].map((suffix) => sourceName + suffix)];
  if (protectedPaths.includes(targetName)) { throw new Error('Export cannot replace the source database or its SQLite sidecars. Choose a different destination.'); }
  const target = await optionalStat(destination);
  if (target === undefined) { return; }
  if (target.isSymbolicLink() || !target.isFile()) { throw new Error('Export destination must be a regular local file, not a symbolic link or directory. Choose a different destination.'); }
  for (const path of [sourcePath, ...['-wal', '-shm', '-journal'].map((suffix) => sourcePath + suffix)]) {
    const protectedFile = await optionalStat(path);
    if (protectedFile !== undefined && target.dev === protectedFile.dev && target.ino === protectedFile.ino) {
      throw new Error('Export cannot replace a source database or sidecar alias. Choose a different destination.');
    }
  }
  // Ensure the source itself is still a file; replacement/deletion is a failure.
  if (!(await stat(source)).isFile()) { throw new Error('The source database is no longer available. Reopen it before exporting.'); }
}

/** Host-only publication: killable worker never renames a user's destination. */
export class ExportService implements ExportRunner {
  private active: Promise<ExportReport | undefined> | undefined;
  private cancelled = false;
  private committing = false;
  private signalCancel: (() => void) | undefined;
  private cleanupError: Error | undefined;
  constructor(private readonly source: string, private readonly engine: Pick<Engine, 'exportResults'>,
    private readonly choose: (format: ExportFormat) => Promise<string | undefined>) {}

  run(sql: string, format: ExportFormat, progress: (report: ExportProgress) => void): Promise<ExportReport | undefined> {
    if (this.active !== undefined) { return Promise.reject(new Error('An export is already running. Wait or cancel it.')); }
    this.cancelled = false; this.committing = false; this.cleanupError = undefined;
    const task = this.save(sql, format, progress); this.active = task;
    const clear = (): void => { if (this.active === task) { this.active = undefined; this.signalCancel = undefined; } };
    void task.then(clear, clear); return task;
  }
  abort(): void { if (!this.committing) { this.cancelled = true; this.signalCancel?.(); } }
  async settled(): Promise<void> {
    try { await this.active; } catch { /* run reports the original failure to its caller. */ }
    if (this.cleanupError !== undefined) { throw this.cleanupError; }
  }
  private checkCancelled(): void { if (this.cancelled) { throw new Error('Export was cancelled. Existing output was not replaced.'); } }

  private async save(sql: string, format: ExportFormat, progress: (report: ExportProgress) => void): Promise<ExportReport | undefined> {
    let temporary: string | undefined;
    try {
      const cancelled = new Promise<undefined>((resolveCancel) => { this.signalCancel = () => { resolveCancel(undefined); }; });
      const choice = await Promise.race([this.choose(format), cancelled]); this.checkCancelled();
      if (choice === undefined) { return undefined; }
      const destination = resolve(choice);
      await checkDestination(this.source, destination); this.checkCancelled();
      temporary = await mkdtemp(join(dirname(destination), '.lite-voyager-export-')); this.checkCancelled();
      const result = await this.engine.exportResults(sql, format, join(temporary, 'result'), (report) => {
        if (!this.cancelled) { progress({ ...report, phase: 'writing' }); }
      });
      this.checkCancelled(); await checkDestination(this.source, destination); this.checkCancelled();
      // This is the final explicit-save commit point. Rename cannot be undone.
      this.committing = true; progress({ ...result, phase: 'saving' });
      try { await rename(join(temporary, 'result'), destination); }
      catch { throw new Error('The export could not be saved. Close programs using the destination, check its permissions and retry. Existing output was not replaced.'); }
      return result;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        throw new Error('Export could not access the source or destination. Check that the source is still available, the destination directory exists, and you have permissions and free disk space. Existing output was not replaced.');
      }
      throw error;
    } finally {
      if (temporary !== undefined) {
        try { await rm(temporary, { recursive: true, force: true }); }
        catch {
          this.cleanupError = new Error('Export temporary files could not be removed. Check permissions and remove the .lite-voyager-export- folder beside the destination. If Saving began, check whether the complete output was saved.');
          throw this.cleanupError;
        }
      }
    }
  }
}
