import { fork, type ChildProcess } from 'node:child_process';
import { link, mkdtemp, rm, stat, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { ImportedTable, ImportTarget, LoadOptions, Progress } from './file-loader';
import { isCsvImportProgress } from '../protocol';
import { registerStorageHelper } from '../storage/temp-storage';

function cancelled(): Error { return new Error('CSV import cancelled. Source is unchanged; reopen to retry.'); }
function validTables(value: unknown): value is ImportedTable[] {
  return Array.isArray(value) && value.length <= 1 && Array.from(value).every((item: unknown) => {
    if (typeof item !== 'object' || item === null) { return false; }
    const table = item as Record<string, unknown>;
    return table['name'] === 'records' && Array.isArray(table['columns']) && table['columns'].length > 0
      && Array.from(table['columns']).every((name: unknown) => typeof name === 'string' && name.length > 0 && !name.includes('\0'))
      && typeof table['rowCount'] === 'string' && /^(0|[1-9]\d{0,30})$/u.test(table['rowCount'])
      && (table['engine'] === 'node:sqlite' || table['engine'] === 'sql.js') && typeof table['notice'] === 'string' && table['notice'].length <= 4096;
  });
}

/** Fresh private storage; publish via exclusive hard link, never replace a destination. */
export async function runCsvImport(directory: string, source: string, target: ImportTarget, options: LoadOptions,
  progress: (value: Progress) => void, signal: AbortSignal, format?: 'json' | 'jsonl'): Promise<ImportedTable[]> {
  if (signal.aborted) { throw cancelled(); }
  if (typeof target.path !== 'string' || target.path.length === 0 || target.path.includes('\0') || !['node:sqlite', 'sql.js'].includes(target.engine)) { throw new Error('Invalid internal CSV import target.'); }
  const destination = resolve(target.path);
  const work = await mkdtemp(join(dirname(destination), '.lv-import-')); const output = join(work, 'import.sqlite');
  let child: ChildProcess | undefined; let exited = Promise.resolve(); let published = false;
  let abort: () => void = () => {};
  try {
    if (signal.aborted) { throw cancelled(); }
    child = fork(join(directory, 'csv-import-process.js'), [], {
      execPath: process.execPath, execArgv: [], windowsHide: true, serialization: 'advanced',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const helper = child;
    let spawnFailed = false;
    helper.on('error', () => { spawnFailed = true; });
    exited = new Promise<void>((accept) => { helper.once('close', () => { accept(); }); });
    // No storage work starts before its PID marker is durable in the owned session.
    if (target.ownerDirectory !== undefined && helper.pid !== undefined) { await registerStorageHelper(target.ownerDirectory, helper.pid); }
    if (spawnFailed || !helper.connected || helper.exitCode !== null || helper.signalCode !== null) { throw new Error('CSV import helper stopped before starting. Reopen the file.'); }
    const tables = await new Promise<ImportedTable[]>((accept, reject) => {
      let settled = false;
      const fail = (error: Error): void => { if (!settled) { settled = true; reject(error); } };
      abort = () => { fail(cancelled()); };
      signal.addEventListener('abort', abort, { once: true });
      helper.on('error', () => { fail(new Error('CSV import helper failed. Rebuild and reopen.')); });
      helper.once('close', () => { fail(new Error('CSV import helper stopped before completion. Reopen.')); });
      helper.on('message', (message: unknown) => {
        if (settled || signal.aborted) { return; }
        if (typeof message !== 'object' || message === null) { fail(new Error('Invalid CSV import response.')); return; }
        const reply = message as Record<string, unknown>;
        if (reply['type'] === 'failure' && typeof reply['message'] === 'string') { fail(new Error(reply['message'].slice(0, 4096))); }
        else if (reply['type'] === 'progress' && isCsvImportProgress(reply['value'])) {
          try { progress(reply['value']); } catch (error: unknown) { fail(error instanceof Error ? error : new Error('CSV progress observer failed.')); }
        } else if (reply['type'] === 'imported' && validTables(reply['tables'])) { settled = true; accept(reply['tables']); }
        else { fail(new Error('Invalid CSV import response. Rebuild and reopen.')); }
      });
      helper.send({ source, path: output, directory, engine: target.engine, options, ...(format === undefined ? {} : { format }) }, (error) => { if (error !== null) { fail(new Error('Import helper could not receive import request.')); } });
      if (signal.aborted) { abort(); }
    });
    if (helper.exitCode === null && helper.signalCode === null && helper.pid !== undefined) { helper.kill('SIGKILL'); }
    await exited;
    if (signal.aborted) { throw cancelled(); }
    await link(output, destination); published = true;
    if (signal.aborted) { throw cancelled(); }
    return tables;
  } catch (error: unknown) {
    if (published) {
      const [ours, current] = await Promise.all([stat(output, { bigint: true }), stat(destination, { bigint: true })]);
      if (ours.dev === current.dev && ours.ino === current.ino) { await unlink(destination); }
    }
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    if (child !== undefined && child.exitCode === null && child.signalCode === null && child.pid !== undefined) { child.kill('SIGKILL'); }
    await exited; await rm(work, { recursive: true, force: true });
  }
}
