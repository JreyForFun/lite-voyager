import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { beforeAll, expect, test, vi } from 'vitest';
import { inspectFile } from '../../src/engine/file-snapshot';
import { NodeSqliteEngine } from '../../src/engine/node-sqlite';
import { SqlJsEngine } from '../../src/engine/sqljs';
import { recoverInterruptedSave, sourceVersion, SqliteEdits } from '../../src/staging/sqlite-edits';

const aliases = vi.hoisted(() => new Map<string, string>());
// Model resolver/case-lookup distinctions on every OS. Aliases return actual
// filesystem metadata; SQLite, contents and every unmapped lookup remain real.
vi.mock('node:fs', async (original) => {
  const actual = await original<typeof import('node:fs')>();
  const mapped = (path: Parameters<typeof actual.statSync>[0]) => typeof path === 'string' ? aliases.get(path) ?? path : path;
  return { ...actual,
    statSync: (path: Parameters<typeof actual.statSync>[0], options?: Parameters<typeof actual.statSync>[1]) => actual.statSync(mapped(path), options),
    lstatSync: (path: Parameters<typeof actual.lstatSync>[0], options?: Parameters<typeof actual.lstatSync>[1]) => actual.lstatSync(mapped(path), options),
    realpathSync: Object.assign((path: string) => path, { native: (path: string) => actual.realpathSync.native(aliases.get(path) ?? path) }) };
});

beforeAll(async () => {
  const result = await promisify(execFile)(process.execPath, ['esbuild.js', '--production']);
  expect(result.stderr).toBe('');
}, 30000);

async function fixture(run: (path: string, alias: string, parent: string) => Promise<void>) {
  // Case-lookup maps must use the same native parent spelling as the worker,
  // including RUNNER~1 on Windows and /var -> /private/var on macOS.
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'lv-t030-path-spelling-')));
  const parent = join(directory, 'real'); const alias = join(directory, 'alias');
  await mkdir(parent); await symlink(parent, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const path = join(parent, 'source.sqlite'); const db = new DatabaseSync(path);
  db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY,v); INSERT INTO t VALUES(1,7)'); db.close();
  try { await run(path, join(alias, 'source.sqlite'), parent); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('FR-016: Given native and JavaScript realpath spellings differ, When opening and fingerprinting the same SQLite file, Then snapshot and version use the host native identity', async () => {
  await fixture(async (path, alias) => {
    expect(inspectFile(alias).path).toBe(await realpath(path));
    expect(sourceVersion(alias)).toBe(sourceVersion(path));
  });
});

test.each([false, true])('FR-020: Given an alias spelling and fallback=%s with a host-owned native-path workspace, When Save As applies an edit, Then the copy is atomic and the source stays unchanged', async (fallback) => {
  await fixture(async (path, alias, parent) => {
    const before = await readFile(path); const directory = resolve('dist');
    const native = await import('node:sqlite'); const snapshot = inspectFile(alias);
    const backend = fallback ? await SqlJsEngine.open(snapshot, directory) : new NodeSqliteEngine(native, snapshot.path);
    const target = join(parent, 'copy.sqlite');
    const workspace = await mkdtemp(join(await realpath(parent), '.lite-voyager-edit-'));
    const edits = new SqliteEdits(snapshot.path, directory, fallback ? undefined : native, sourceVersion(alias), alias);
    try {
      await edits.execute(backend, { action: 'save', version: sourceVersion(alias), destination: join(dirname(alias), 'copy.sqlite'), temporaryDirectory: workspace,
        operations: [{ kind: 'sql', sql: 'UPDATE t SET v=42' }] }, () => { throw new Error('Save As must retain the source reader.'); });
      expect(await readFile(path)).toEqual(before);
      const saved = new DatabaseSync(target, { readOnly: true });
      try { expect(saved.prepare('SELECT v FROM t').get()?.['v']).toBe(42); }
      finally { saved.close(); }
    } finally { backend.close(); await rm(workspace, { recursive: true, force: true }); }
  });
});

test('FR-020: Given an authorized journal recovery and an alias spelling of the same inode, When recovery checks the native source token, Then it opens the original database and preserves its data', async () => {
  await fixture(async (path, alias) => {
    const native = await import('node:sqlite'); const version = sourceVersion(path); const before = await readFile(path);
    // An empty rollback journal is safe for SQLite itself to inspect. The
    // existing spill tests separately require recovery of a real hot journal.
    await writeFile(path + '-journal', Buffer.alloc(512));
    expect(() => recoverInterruptedSave(alias, version, native)).not.toThrow();
    expect(await readFile(path)).toEqual(before);
  });
});

test.each(['-wal', '-shm', '-journal'].flatMap((suffix) => [false, true].map((exists) => ({ suffix, exists }))))('FR-020: Given a case-insensitive POSIX sidecar alias $suffix with existing=$exists, When Save As targets it, Then protection precedes opening any writer and preserves source bytes', async ({ suffix, exists }) => {
  await fixture(async (path, alias, parent) => {
    const directory = resolve('dist'); const snapshot = inspectFile(alias); const backend = await SqlJsEngine.open(snapshot, directory);
    expect(snapshot.path).not.toBe(alias);
    const workspace = await mkdtemp(join(parent, '.lite-voyager-edit-'));
    const target = join(parent, 'SOURCE.SQLITE' + suffix.toUpperCase());
    aliases.set(join(parent, 'SOURCE.SQLITE'), path);
    aliases.set(join(parent, basename(workspace).replace('.lite-', '.Lite-')), workspace);
    const protectedPath = path + suffix; const marker = Buffer.from('protected sidecar bytes');
    if (exists) { await writeFile(protectedPath, marker); aliases.set(target, protectedPath); }
    const before = await readFile(path); const writer = vi.spyOn(SqlJsEngine, 'open').mockRejectedValue(new Error('Writer opened before safety validation.'));
    // Windows itself is case insensitive, but its old lexical lowercase check
    // masks this POSIX bug. Exercise the POSIX branch on every test platform.
    vi.stubGlobal('process', { ...process, platform: 'darwin' });
    const edits = new SqliteEdits(snapshot.path, directory, undefined, sourceVersion(snapshot.path), alias);
    try {
      await expect(edits.execute(backend, { action: 'save', version: sourceVersion(alias), destination: target,
        temporaryDirectory: workspace, operations: [{ kind: 'sql', sql: 'UPDATE t SET v=42' }] }, () => {})).rejects.toThrow(/original source|protected.*sidecar/iu);
      expect(writer).not.toHaveBeenCalled(); expect(await readFile(path)).toEqual(before);
      if (exists) { expect(await readFile(protectedPath)).toEqual(marker); }
    } finally { vi.unstubAllGlobals(); writer.mockRestore(); aliases.clear(); backend.close(); await rm(workspace, { recursive: true, force: true }); }
  });
});

test('FR-020: Given a case-sensitive destination parent, When a distinct uppercase suffix is chosen for Save As, Then the protected-sidecar guard permits the writer without changing source bytes', async () => {
  await fixture(async (path, alias, parent) => {
    const directory = resolve('dist'); const snapshot = inspectFile(alias); const backend = await SqlJsEngine.open(snapshot, directory);
    expect(snapshot.path).not.toBe(alias);
    const workspace = await mkdtemp(join(parent, '.lite-voyager-edit-')); const target = path + '-WAL';
    // Model a case-sensitive parent even on Windows. No writer is allowed to
    // reach the actual filesystem with this model: the sentinel ends the save.
    aliases.set(join(parent, basename(workspace).replace('.lite-', '.Lite-')), join(parent, 'missing-workspace'));
    const before = await readFile(path); const writer = vi.spyOn(SqlJsEngine, 'open').mockRejectedValue(new Error('Writer permitted.'));
    vi.stubGlobal('process', { ...process, platform: 'darwin' });
    const edits = new SqliteEdits(snapshot.path, directory, undefined, sourceVersion(snapshot.path), alias);
    try {
      await expect(edits.execute(backend, { action: 'save', version: sourceVersion(alias), destination: target,
        temporaryDirectory: workspace, operations: [{ kind: 'sql', sql: 'UPDATE t SET v=42' }] }, () => {})).rejects.toThrow('Writer permitted.');
      expect(writer).toHaveBeenCalledOnce(); expect(await readFile(path)).toEqual(before);
    } finally { vi.unstubAllGlobals(); writer.mockRestore(); aliases.clear(); backend.close(); await rm(workspace, { recursive: true, force: true }); }
  });
});
