import { afterEach, expect, test, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
const cleanups: (() => Promise<void>)[] = [];
/**
 * External rewrite with a different length from the fixture's 'original'. Equal-size rewrites in the same
 * file-time tick (about 15.6 ms on many Windows hosts) can keep size/mtime/ctime identical, so a race-free
 * test must not depend on timestamp granularity.
 */
const external = 'external change';
/** Windows 8.3 alias of an existing directory (GitHub runners already use one: C:\Users\RUNNER~1\...). */
async function shortDirectory(directory: string): Promise<string> {
  if (process.platform !== 'win32') { return directory; }
  const result = await promisify(execFile)('cmd.exe', ['/d', '/s', '/c', `"for %I in ("${directory}") do @echo %~sI"`], { windowsVerbatimArguments: true });
  return result.stdout.trim();
}
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) { await cleanup(); } });
async function fixture(sqlite = false, editable?: boolean) {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t033-')); cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'source.data'); await writeFile(path, 'original');
  const { SourceChanges, sourceFingerprint } = await import('../../src/editor/source-changes');
  const callbacks = { refresh: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), dirty: () => false, available: () => true,
    confirm: vi.fn<() => Promise<boolean>>().mockResolvedValue(true), changed: vi.fn() };
  const monitor = new SourceChanges(path, sqlite, callbacks, { watch: false, intervalMs: 60000, ...(editable === undefined ? {} : { editable }) }); cleanups.push(() => { monitor.dispose(); return Promise.resolve(); }); await monitor.ready;
  return { monitor, path, callbacks, sourceFingerprint };
}
test('FR-040: Given a source reached through a Windows 8.3 short directory name, When the file changes, Then the watcher reports it without aborting the host process', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t033-long-directory-name-')); cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const reached = await shortDirectory(directory); const path = join(reached, 'source.data'); await writeFile(path, 'original');
  const { SourceChanges } = await import('../../src/editor/source-changes');
  const callbacks = { refresh: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), dirty: () => false, available: () => true,
    confirm: vi.fn<() => Promise<boolean>>().mockResolvedValue(true), changed: vi.fn() };
  // Only the file watcher can notice this change: periodic checks are ten minutes apart.
  const monitor = new SourceChanges(path, false, callbacks, { intervalMs: 600000 }); cleanups.push(() => { monitor.dispose(); return Promise.resolve(); }); await monitor.ready;
  expect(monitor.state.message).toBe('');
  await writeFile(path, 'newer content from another program');
  await vi.waitFor(() => { expect(monitor.state).toMatchObject({ changed: true, offered: true }); }, { timeout: 10000, interval: 50 });
  expect(callbacks.refresh).not.toHaveBeenCalled(); expect(await readFile(path, 'utf8')).toBe('newer content from another program');
});
test('FR-040: Given an open source, When replacing, dismissing, deleting and recreating it, Then each newer change offers refresh without writing or refreshing automatically', async () => {
  const { monitor, path, callbacks } = await fixture(); await writeFile(path + '.replacement', 'newer'); await rename(path + '.replacement', path);
  await monitor.check(); expect(monitor.state).toMatchObject({ changed: true, offered: true });
  await monitor.handle('keep'); expect(monitor.state).toMatchObject({ changed: true, offered: false });
  await monitor.check(); expect(monitor.state.offered).toBe(false);
  await rm(path); await monitor.check(); expect(monitor.state.offered).toBe(true); expect(monitor.state.message).toMatch(/missing|deleted/iu);
  await writeFile(path, 'recreated'); await monitor.check(); expect(monitor.state.offered).toBe(true);
  expect(callbacks.refresh).not.toHaveBeenCalled(); expect(await readFile(path, 'utf8')).toBe('recreated');
});
test('FR-040: Given a read-only imported or previewed source, When it changes or goes missing, Then the offer never promises pending edits that cannot exist', async () => {
  const { monitor, path, callbacks } = await fixture(false, false);
  await writeFile(path, 'newer'); await monitor.check();
  expect(monitor.state).toMatchObject({ changed: true, offered: true }); expect(monitor.state.message).toMatch(/changed on disk/iu); expect(monitor.state.message).not.toMatch(/edit/iu);
  await monitor.handle('keep'); expect(monitor.state.message).toMatch(/Current view retained/u); expect(monitor.state.message).not.toMatch(/edit|save-conflict/iu);
  await writeFile(path, 'newest'); await monitor.check(); expect(monitor.state.offered).toBe(true);
  // Refused before refresh starts: the view really is untouched.
  callbacks.available = () => false; await monitor.handle('refresh'); callbacks.available = () => true;
  expect(monitor.state.message).toMatch(/^Wait for .*The current view was preserved; no source file was written\.$/u); expect(callbacks.refresh).not.toHaveBeenCalled();
  // Failed after refresh started (an import is torn down before the new preview is read): never claim it was preserved.
  callbacks.refresh.mockRejectedValueOnce(new Error('Preview failed.')); await monitor.handle('refresh');
  expect(monitor.state.message).toMatch(/^Preview failed\. Refresh did not finish, so the previous view may be unavailable; no source file was written\./u);
  expect(monitor.state.message).not.toMatch(/edit|preserved/iu);
  await rm(path); await monitor.check(); expect(monitor.state.message).toMatch(/missing|deleted/iu); expect(monitor.state.message).not.toMatch(/edit/iu);
  const editable = await fixture(); await writeFile(editable.path, 'newer'); await editable.monitor.check();
  expect(editable.monitor.state.message).toMatch(/Pending edits are retained/u);
});
test('FR-040: Given refresh is unavailable for an explained reason, When refresh is requested, Then that reason is shown instead of a generic wait', async () => {
  const { monitor, path, callbacks } = await fixture();
  const actions = callbacks as typeof callbacks & { unavailableReason?: () => string | undefined };
  const reason = 'One view of this file could not open its database reader. Close that view, then refresh again, or reopen the file.';
  callbacks.available = () => false; actions.unavailableReason = () => reason;
  await writeFile(path, external); await monitor.check(); expect(monitor.state.changed).toBe(true);
  await monitor.handle('refresh');
  expect(monitor.state.message.startsWith(reason)).toBe(true); expect(monitor.state.message).not.toMatch(/Wait for the current/u);
  expect(callbacks.refresh).not.toHaveBeenCalled(); expect(monitor.state).toMatchObject({ changed: true, busy: false });
});
test('FR-040: Given SQLite main bytes are unchanged, When only its WAL changes, Then refresh is offered and the main source remains untouched', async () => {
  const { monitor, path } = await fixture(true); await writeFile(path + '-wal', 'committed changes'); await monitor.check();
  expect(monitor.state.changed).toBe(true); expect(await readFile(path, 'utf8')).toBe('original');
});
test('FR-040: Given dirty edits, When discard confirmation is dismissed then approved, Then refresh occurs only after explicit approval and the new baseline is accepted', async () => {
  const { monitor, path, callbacks } = await fixture(); callbacks.dirty = () => true;
  await writeFile(path, external); await monitor.check(); expect(monitor.state.changed).toBe(true); callbacks.confirm.mockResolvedValueOnce(false);
  await monitor.handle('refresh'); expect(callbacks.refresh).not.toHaveBeenCalled(); expect(monitor.state.changed).toBe(true);
  await monitor.handle('refresh'); expect(callbacks.refresh).toHaveBeenCalledTimes(1); expect(monitor.state.changed).toBe(false);
});
test('FR-040: Given an operation becomes busy while a discard dialog is open, When its late approval arrives, Then refresh refuses without discarding pending work', async () => {
  const { monitor, path, callbacks } = await fixture(); callbacks.dirty = () => true;
  let finish!: (value: boolean) => void; callbacks.confirm.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await writeFile(path, external); await monitor.check(); expect(monitor.state.changed).toBe(true); const refresh = monitor.handle('refresh');
  callbacks.available = () => false; finish(true); await refresh;
  expect(callbacks.refresh).not.toHaveBeenCalled(); expect(monitor.state.message).toMatch(/wait|busy/iu);
});
test('FR-040: Given a refresh failure, When refreshing, Then the changed-source warning and pending work remain with an actionable error', async () => {
  const { monitor, path, callbacks } = await fixture(); await writeFile(path, external); await monitor.check(); expect(monitor.state.changed).toBe(true);
  callbacks.refresh.mockRejectedValueOnce(new Error('Cannot reopen database')); await monitor.handle('refresh');
  expect(monitor.state).toMatchObject({ changed: true, busy: false }); expect(monitor.state.message).toContain('Cannot reopen database');
});
test('FR-040: Given an explicit save version, When a later external write races baseline acceptance, Then that newer write is still detected and disposal prevents later reports', async () => {
  const { monitor, path, callbacks, sourceFingerprint } = await fixture(true);
  const resume = monitor.suspend(); await writeFile(path, 'saved'); const committed = await sourceFingerprint(path, true);
  await writeFile(path, 'external after save'); monitor.acceptVersion(committed); await resume();
  expect(monitor.state.changed).toBe(true); monitor.dispose(); callbacks.changed.mockClear(); await monitor.check(); expect(callbacks.changed).not.toHaveBeenCalled();
});

test('FR-040: Given a pending-edit revision changes while confirmation is open, When approval arrives after the edit finishes, Then the newer queue is preserved', async () => {
  const { monitor, path, callbacks } = await fixture(); let revision = 1;
  const actions = callbacks as typeof callbacks & { revision?: () => unknown }; actions.revision = () => revision; callbacks.dirty = () => true;
  let finish!: (value: boolean) => void; callbacks.confirm.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await writeFile(path, external); await monitor.check(); expect(monitor.state.changed).toBe(true);
  const refresh = monitor.handle('refresh'); revision++; finish(true); await refresh;
  expect(callbacks.refresh).not.toHaveBeenCalled(); expect(monitor.state.changed).toBe(true);
});

test('FR-040: Given an existing SQLite file, When taking an async monitor fingerprint, Then it exactly matches the worker source-conflict token', async () => {
  const { path, sourceFingerprint } = await fixture(true); const { sourceVersion } = await import('../../src/staging/sqlite-edits');
  expect(await sourceFingerprint(path, true)).toBe(sourceVersion(path));
});
