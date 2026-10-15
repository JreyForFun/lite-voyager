import { randomBytes } from 'node:crypto';
import { lstat, mkdir, opendir, realpath, rm, statfs, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const sessionName = /^session-v1-([1-9]\d{0,9})-[a-f0-9]{32}$/u;
const helperName = /^\.helper-([1-9]\d{0,9})$/u;
export interface SpaceEstimate { available: bigint; required: bigint; }
export type SpaceApproval = (space: SpaceEstimate) => Promise<boolean>;
export function importSpaceEstimate(sourceBytes: bigint): bigint { return sourceBytes * 3n + 64n * 1024n * 1024n; }
export async function diskAvailable(directory: string): Promise<bigint> {
  const disk = await statfs(directory, { bigint: true }); return disk.bavail * disk.bsize;
}
export async function checkImportSpace(directory: string, sourceBytes: bigint, approve: SpaceApproval,
  available: (path: string) => Promise<bigint> = diskAvailable, signal?: AbortSignal): Promise<void> {
  const cancelled = (): Error => new Error('Low disk space: import cancelled. Free space or explicitly choose Import anyway to retry.');
  const isCancelled = (): boolean => signal?.aborted === true;
  if (isCancelled()) { throw cancelled(); }
  let free: bigint;
  try { free = await available(directory); }
  catch { throw new Error('Cannot check free disk space. Check extension storage permissions and retry the import.'); }
  const required = importSpaceEstimate(sourceBytes);
  if (free >= required) { return; }
  let abort: () => void = () => {};
  try {
    const approved = await Promise.race([approve({ available: free, required }), new Promise<never>((_accept, reject) => {
      abort = () => { reject(cancelled()); }; signal?.addEventListener('abort', abort, { once: true });
      if (isCancelled()) { abort(); }
    })]);
    if (!approved || isCancelled()) { throw cancelled(); }
  } finally { signal?.removeEventListener('abort', abort); }
}
function processExists(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error: unknown) { return !(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ESRCH'); }
}
export async function registerStorageHelper(directory: string, pid: number): Promise<void> {
  if (!Number.isSafeInteger(pid) || pid <= 0) { throw new Error('Cannot identify storage helper. Reopen the import.'); }
  try { await writeFile(join(directory, `.helper-${String(pid)}`), '', { flag: 'wx', mode: 0o600 }); }
  catch (error: unknown) { if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST')) { throw error; } }
}

/** Only versioned, direct-child directories have enough ownership evidence to delete. */
export class TempStorage {
  constructor(private readonly root: string, private readonly alive: (pid: number) => boolean = processExists) {}
  async initialize(): Promise<string> { await mkdir(this.root, { recursive: true }); return realpath(this.root); }
  async create(): Promise<string> {
    const root = await this.initialize(); const path = join(root, `session-v1-${String(process.pid)}-${randomBytes(16).toString('hex')}`);
    await mkdir(path, { mode: 0o700 }); return path;
  }
  async remove(path: string): Promise<void> {
    const root = await realpath(this.root); const candidate = resolve(path);
    if (dirname(candidate) !== root || !sessionName.test(basename(candidate))) { throw new Error('Refusing to remove storage that is not an owned session directory.'); }
    let metadata;
    try { metadata = await lstat(candidate); }
    catch (error: unknown) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') { return; } throw error; }
    if (metadata.isSymbolicLink() || !metadata.isDirectory() || await realpath(candidate) !== candidate) { throw new Error('Refusing to remove linked or unowned session storage.'); }
    await rm(candidate, { recursive: true, force: true });
  }
  async cleanupOrphans(): Promise<void> {
    const root = await this.initialize(); const entries = await opendir(root);
    for await (const entry of entries) {
      const match = sessionName.exec(entry.name);
      if (match === null || !entry.isDirectory() || entry.isSymbolicLink() || this.alive(Number(match[1]))) { continue; }
      const path = join(root, entry.name);
      try {
        let busy = false; const children = await opendir(path);
        for await (const child of children) {
          if (!child.name.startsWith('.helper-')) { continue; }
          const helper = helperName.exec(child.name);
          if (helper === null || !child.isFile() || child.isSymbolicLink() || this.alive(Number(helper[1]))) { busy = true; break; }
        }
        if (!busy && !this.alive(Number(match[1]))) { await this.remove(path); }
      } catch (error: unknown) {
        // Another window can finish removing the same already-dead session.
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) {
          throw new Error('Abandoned import storage could not be removed. Close programs locking extension storage and reload VS Code. Unknown and live sessions were preserved.');
        }
      }
    }
  }
}
