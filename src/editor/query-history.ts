import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readdir, readFile, rename, rm, stat, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { MAX_SQL_LENGTH, type HistoryEntry } from '../protocol';

export interface QueryHistoryAccess {
  list(): Promise<HistoryEntry[]>;
  read(id: string): Promise<string>;
  record(sql: string): Promise<void>;
  clear(): Promise<void>;
}
const idPattern = /^[a-f\d]{32}$/u;
const invalid = () => new Error('Query history is unreadable or invalid. Its stored files were preserved.');
const code = (error: unknown): unknown => typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
const missing = (error: unknown): boolean => code(error) === 'ENOENT';
const ownedFile = /^[a-f\d]{32}\.(?:sql|tmp)$/u;
/** Cross-window coordination: every VS Code window shares one history directory per source. */
const LOCK_NAME = 'history.lock';
const LOCK_STALE_MS = 30000; // a write takes milliseconds; an older lock belongs to a crashed window
const LOCK_WAIT_MS = 10000;
const LOCK_RETRY_MS = 20;
function validSql(sql: string): boolean { return sql.length > 0 && sql.length <= MAX_SQL_LENGTH && !sql.includes('\0') && sql.trim().length > 0; }
/** Whitespace-collapsed preview that ends with '…' only when SQL text was actually cut. */
function preview(sql: string): string {
  let body = sql.slice(0, 160).replace(/\s+/gu, ' '); let shortened = sql.length > 160;
  const render = (): string => shortened ? `${body}…` : body;
  // JSON escaping can use six bytes per code unit. Bound serialized previews
  // as well as their length so 50 entries always fit the 32-KiB index.
  while (render().length > 160 || Buffer.byteLength(JSON.stringify(render()), 'utf8') > 480) { body = body.slice(0, -1); shortened = true; }
  return render();
}

/** Per-source serial disk storage. Only bounded metadata and one SQL are loaded. */
export class QueryHistory implements QueryHistoryAccess {
  private static readonly pending = new Map<string, Promise<unknown>>();
  private readonly directory: string;
  constructor(root: string, identity: string) { this.directory = join(root, createHash('sha256').update(identity).digest('hex')); }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const before = QueryHistory.pending.get(this.directory) ?? Promise.resolve();
    const task = before.catch(() => {}).then(work); QueryHistory.pending.set(this.directory, task);
    void task.finally(() => { if (QueryHistory.pending.get(this.directory) === task) { QueryHistory.pending.delete(this.directory); } }).catch(() => {});
    return task;
  }
  /** Runs `work` while holding this source's lock file, so other windows never interleave read-modify-write. */
  private async locked<T>(work: () => Promise<T>, create: boolean): Promise<T> {
    if (create) { await mkdir(this.directory, { recursive: true, mode: 0o700 }); }
    const lock = join(this.directory, LOCK_NAME); const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
      let handle: FileHandle;
      try { handle = await open(lock, 'wx', 0o600); }
      catch (error: unknown) {
        if (missing(error) && !create) { return await work(); } // no history yet: nothing to coordinate
        if (!['EEXIST', 'EPERM', 'EBUSY'].includes(String(code(error)))) { throw error; }
        if (await QueryHistory.stale(lock)) { await rm(lock, { force: true }); continue; }
        if (Date.now() > deadline) {
          if (code(error) === 'EEXIST') { throw new Error('Query history is busy in another VS Code window. Retry in a moment.'); }
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_MS)); continue;
      }
      try { return await work(); } finally { await handle.close(); await rm(lock, { force: true }); }
    }
  }
  private static async stale(lock: string): Promise<boolean> {
    try { return Date.now() - (await stat(lock)).mtimeMs > LOCK_STALE_MS; } catch (error: unknown) { if (missing(error)) { return false; } throw error; }
  }
  private async index(): Promise<HistoryEntry[]> {
    try {
      const path = join(this.directory, 'index.json'); if ((await stat(path)).size > 32768) { throw invalid(); }
      const value: unknown = JSON.parse(await readFile(path, 'utf8'));
      if (!Array.isArray(value) || value.length > 50 || !value.every((entry: unknown) => {
        if (typeof entry !== 'object' || entry === null) { return false; }
        return 'id' in entry && typeof entry.id === 'string' && idPattern.test(entry.id)
          && 'preview' in entry && typeof entry.preview === 'string' && entry.preview.length <= 160
          && 'length' in entry && typeof entry.length === 'number' && Number.isSafeInteger(entry.length) && entry.length > 0 && entry.length <= MAX_SQL_LENGTH;
      })) { throw invalid(); }
      const entries = value as HistoryEntry[];
      if (new Set(entries.map(entry => entry.id)).size !== entries.length) { throw invalid(); }
      return entries.map(({ id, preview, length }) => ({ id, preview, length }));
    } catch (error: unknown) { if (missing(error)) { return []; } throw invalid(); }
  }
  private async publish(entries: HistoryEntry[]): Promise<void> {
    const temporary = join(this.directory, `${randomBytes(16).toString('hex')}.tmp`);
    try {
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(entries), 'utf8'); await file.sync(); } finally { await file.close(); }
      await rename(temporary, join(this.directory, 'index.json'));
    } finally { await rm(temporary, { force: true }); }
  }
  list(): Promise<HistoryEntry[]> { return this.serial(() => this.locked(() => this.index(), false)); }
  read(id: string): Promise<string> {
    return this.serial(() => this.locked(async () => {
      if (!idPattern.test(id)) { throw invalid(); }
      const entry = (await this.index()).find(entry => entry.id === id); if (entry === undefined) { throw new Error('This query history entry is no longer available. Reload history.'); }
      try {
        const path = join(this.directory, `${id}.sql`); if ((await stat(path)).size > MAX_SQL_LENGTH * 4) { throw invalid(); }
        const sql = await readFile(path, 'utf8'); if (!validSql(sql) || sql.length !== entry.length) { throw invalid(); } return sql;
      } catch { throw invalid(); }
    }, false));
  }
  record(sql: string): Promise<void> {
    if (!validSql(sql)) { return Promise.reject(new Error('Query history accepts complete SQL up to 4 Mi characters, without NUL. Nothing was truncated.')); }
    return this.serial(() => this.locked(async () => {
      const old = await this.index();
      const id = randomBytes(16).toString('hex'); const path = join(this.directory, `${id}.sql`); let committed = false;
      try {
        const file = await open(path, 'wx', 0o600);
        try { await file.writeFile(sql, 'utf8'); await file.sync(); } finally { await file.close(); }
        await this.publish([{ id, preview: preview(sql), length: sql.length }, ...old].slice(0, 50)); committed = true;
        for (const entry of old.slice(49)) { await rm(join(this.directory, `${entry.id}.sql`), { force: true }); }
      } finally { if (!committed) { await rm(path, { force: true }); } }
    }, true));
  }
  /** Explicit Clear also recovers a corrupted index: it never needs to parse the old one. */
  clear(): Promise<void> {
    return this.serial(() => this.locked(async () => {
      let names: string[];
      try { names = await readdir(this.directory); } catch (error: unknown) { if (missing(error)) { return; } throw error; }
      await this.publish([]);
      for (const name of names) { if (ownedFile.test(name)) { await rm(join(this.directory, name), { force: true }); } }
    }, false));
  }
}
