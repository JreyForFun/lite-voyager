import { link, lstat, mkdtemp, realpath, rename, rm, stat } from 'node:fs/promises';
import type { BigIntStats } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { databaseCopier, type CopyDatabase } from '../storage/copy-database';
import { diskAvailable } from '../storage/temp-storage';

export interface SqliteSaveProgress { phase: 'copying' | 'saving'; bytes: string; total: string; }
export interface OriginalSourceSnapshot { path: string; metadata: BigIntStats; }
export async function captureOriginalSource(path: string): Promise<OriginalSourceSnapshot> {
  const canonical = await realpath(path); const metadata = await stat(canonical, { bigint: true });
  if (!metadata.isFile()) { throw new Error('Import source must be a saved local file.'); } return { path: canonical, metadata };
}
export interface SqliteSaveOptions {
  source: string; original: string; storageRoot: string; workerDirectory: string;
  originalSnapshot?: OriginalSourceSnapshot;
  choose: () => Promise<string | undefined>; confirmReplace: (path: string) => Promise<boolean>;
  copy?: CopyDatabase; available?: (directory: string) => Promise<bigint>;
}
function sameFile(a: BigIntStats, b: BigIntStats): boolean { return a.dev === b.dev && a.ino === b.ino; }
function sameVersion(a: BigIntStats | undefined, b: BigIntStats | undefined): boolean {
  return a === undefined ? b === undefined : b !== undefined && sameFile(a, b) && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}
function normalize(path: string): string { return process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path); }
function within(root: string, path: string): boolean { const part = relative(normalize(root), normalize(path)); return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith('../') && !part.startsWith('..\\')); }
async function optionalStat(path: string): Promise<BigIntStats | undefined> {
  try { return await lstat(path, { bigint: true }); }
  catch (error: unknown) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') { return undefined; } throw error; }
}

/** Only this host service publishes a complete worker output to an explicit save destination. */
export class SqliteSaveService {
  private active: Promise<{ bytes: string } | undefined> | undefined;
  private cancellation = new AbortController();
  private committing = false;
  private closeFailure: Error | undefined;
  constructor(private readonly options: SqliteSaveOptions) {}
  get isCancelled(): boolean { return this.cancellation.signal.aborted; }
  run(progress: (value: SqliteSaveProgress) => void): Promise<{ bytes: string } | undefined> {
    if (this.active !== undefined) { return Promise.reject(new Error('A SQLite save is already running. Wait or cancel it.')); }
    this.cancellation = new AbortController(); this.committing = false; this.closeFailure = undefined;
    const task = this.save(progress); this.active = task;
    void task.then(() => { this.active = undefined; }, (error: unknown) => {
      if (this.committing && error instanceof Error) { this.closeFailure = error; }
      this.active = undefined;
    }); return task;
  }
  abort(): void { if (!this.committing) { this.cancellation.abort(); } }
  async settled(): Promise<void> {
    try { await this.active; } catch { /* run reports cancellation and copy failures to the live tab. */ }
    if (this.closeFailure !== undefined) { throw this.closeFailure; }
  }
  private checkCancelled(): void { if (this.cancellation.signal.aborted) { throw new Error('SQLite save cancelled. Existing output was not replaced.'); } }
  private async dialog<T>(choice: () => Promise<T>): Promise<T> {
    this.checkCancelled(); let abort: () => void = () => {};
    try {
      return await Promise.race([choice(), new Promise<never>((_accept, reject) => {
        abort = () => { reject(new Error('SQLite save cancelled. Existing output was not replaced.')); };
        this.cancellation.signal.addEventListener('abort', abort, { once: true }); if (this.cancellation.signal.aborted) { abort(); }
      })]);
    } finally { this.cancellation.signal.removeEventListener('abort', abort); }
  }
  private async destination(path: string): Promise<{ path: string; metadata: BigIntStats | undefined }> {
    const target = join(await realpath(dirname(path)), basename(path));
    const storage = await realpath(this.options.storageRoot);
    if (within(storage, target)) { throw new Error('SQLite save cannot write into private import storage. Choose another destination.'); }
    const metadata = await optionalStat(target);
    if (metadata !== undefined && (metadata.isSymbolicLink() || !metadata.isFile())) { throw new Error('SQLite save destination must be a regular local file, not a link or directory.'); }
    const original = this.options.originalSnapshot;
    if (original !== undefined && (['', '-wal', '-shm', '-journal'].some((suffix) => normalize(target) === normalize(original.path + suffix))
      || metadata !== undefined && sameFile(metadata, original.metadata))) {
      throw new Error('SQLite save cannot replace the original source or a renamed source alias. Choose another destination.');
    }
    const sources = [this.options.source];
    try { sources.push(await realpath(this.options.original)); }
    catch (error: unknown) { if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT' && original !== undefined)) { throw error; } }
    for (const source of sources) {
      const canonical = await realpath(source);
      for (const suffix of ['', '-wal', '-shm', '-journal']) {
        const protectedPath = canonical + suffix;
        if (normalize(target) === normalize(protectedPath)) { throw new Error('SQLite save cannot replace an original source, imported database or SQLite sidecar. Choose another destination.'); }
        if (metadata !== undefined) {
          const protectedFile = await optionalStat(protectedPath);
          if (protectedFile !== undefined && sameFile(metadata, protectedFile)) { throw new Error('SQLite save cannot replace a source or sidecar alias. Choose another destination.'); }
        }
      }
    }
    for (const suffix of ['-wal', '-shm', '-journal']) {
      if (await optionalStat(target + suffix) !== undefined) { throw new Error('SQLite save destination has SQLite sidecars. Close its database and choose a new file to avoid losing committed data.'); }
    }
    return { path: target, metadata };
  }
  private async save(progress: (value: SqliteSaveProgress) => void): Promise<{ bytes: string } | undefined> {
    let temporary: string | undefined;
    try {
      const choice = await this.dialog(this.options.choose); this.checkCancelled(); if (choice === undefined) { return undefined; }
      const initial = await this.destination(resolve(choice)); this.checkCancelled();
      if (initial.metadata !== undefined && !await this.dialog(() => this.options.confirmReplace(initial.path))) { return undefined; }
      this.checkCancelled();
      const source = await stat(this.options.source, { bigint: true });
      if (!source.isFile()) { throw new Error('Imported source database is no longer available. Reopen the import.'); }
      const free = await (this.options.available ?? diskAvailable)(dirname(initial.path));
      if (free < source.size + 1024n * 1024n) { throw new Error('Not enough free disk space to save SQLite. Free space for the complete database plus 1 MiB, then retry. Existing output was not replaced.'); }
      this.checkCancelled(); temporary = await mkdtemp(join(dirname(initial.path), '.lite-voyager-save-')); this.checkCancelled();
      const output = join(temporary, 'database.sqlite');
      const bytes = await (this.options.copy ?? databaseCopier(this.options.workerDirectory))(this.options.source, output, this.cancellation.signal,
        (copied, total) => { if (!this.cancellation.signal.aborted) { progress({ phase: 'copying', bytes: copied, total }); } });
      this.checkCancelled();
      const final = await this.destination(resolve(choice));
      if (normalize(initial.path) !== normalize(final.path) || !sameVersion(initial.metadata, final.metadata)
        || !sameVersion(source, await stat(this.options.source, { bigint: true })) || bytes !== String(source.size)
        || (await stat(output, { bigint: true })).size !== source.size) {
        throw new Error('SQLite save source or destination changed while copying. Check the files and retry. Existing output was not replaced.');
      }
      this.checkCancelled(); this.committing = true; progress({ phase: 'saving', bytes, total: bytes });
      try {
        if (initial.metadata === undefined) { await link(output, initial.path); }
        else { await rename(output, initial.path); }
      } catch { throw new Error('SQLite save could not publish the complete database. Close programs using the destination, check permissions and retry. Existing output was not replaced.'); }
      return { bytes };
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        throw new Error('SQLite save could not access the source or destination. Check permissions, available disk space and that both files are still available. Existing output was not replaced.');
      }
      throw error;
    } finally {
      if (temporary !== undefined) {
        try { await rm(temporary, { recursive: true, force: true }); }
        catch {
          this.closeFailure = new Error('SQLite save temporary files could not be removed. Check permissions and the .lite-voyager-save- folder beside the destination. If Saving began, check whether the complete database was saved.');
          throw this.closeFailure;
        }
      }
    }
  }
}
