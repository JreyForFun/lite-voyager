import type * as vscode from 'vscode';
import { beforeEach, expect, test, vi } from 'vitest';
import { OpeningDefaults, openInLiteVoyager } from '../../src/editor/file-opening';

const host = vi.hoisted(() => {
  const global: Record<string, string> = {}; const workspace: Record<string, string> = {}; const folder: Record<string, string> = {};
  return { enabled: false, global, workspace, folder,
  listeners: new Set<(event: { affectsConfiguration: (name: string) => boolean }) => void>(), update: vi.fn(), error: vi.fn(), execute: vi.fn(), picker: vi.fn(),
  active: undefined as { document: { uri: vscode.Uri } } | undefined };
});
vi.mock('vscode', () => ({ ConfigurationTarget: { Global: 1 }, workspace: {
  workspaceFolders: [{ uri: 'folder' }],
  onDidChangeConfiguration: (fn: (event: { affectsConfiguration: (name: string) => boolean }) => void) => { host.listeners.add(fn); return { dispose: () => { host.listeners.delete(fn); } }; },
  getConfiguration: (name: string, folder?: unknown) => name === 'liteVoyager' ? { get: () => host.enabled } : {
    inspect: () => ({ globalValue: host.global, workspaceValue: host.workspace, ...(folder === undefined ? {} : { workspaceFolderValue: host.folder }) }), update: host.update,
  },
}, window: { showErrorMessage: host.error, showOpenDialog: host.picker, get activeTextEditor() { return host.active; } }, commands: { executeCommand: host.execute } }));
function changed(): void { for (const fn of host.listeners) { fn({ affectsConfiguration: () => true }); } }
function memory() {
  const values = new Map<string, unknown>(); const writes: unknown[] = [];
  return { get: (key: string) => values.get(key), update: vi.fn((key: string, value: unknown) => { writes.push(value); values.set(key, value); return Promise.resolve(); }), writes };
}
beforeEach(() => {
  host.enabled = false; host.global = {}; host.workspace = {}; host.folder = {}; host.listeners.clear(); host.active = undefined;
  host.error.mockReset(); host.execute.mockReset().mockResolvedValue(undefined); host.picker.mockReset().mockResolvedValue(undefined);
  host.update.mockReset().mockImplementation((_name: string, value: Record<string, string> | undefined) => { host.global = value ?? {}; changed(); return Promise.resolve(); });
});
test('D-5: Given an off setting, When enabling then disabling through configuration events, Then owned settings are journaled, serialized and removed without touching explicit choices', async () => {
  const storage = memory(); const defaults = new OpeningDefaults(storage as unknown as vscode.Memento); await defaults.settled; expect(host.update).not.toHaveBeenCalled();
  host.global = { '*.json': 'default', '*.db': 'mine' }; host.folder = { '**/chosen.csv': 'another' }; host.enabled = true; changed(); await defaults.settled;
  expect(host.global).toEqual({ '*.json': 'default', '*.db': 'mine', '*.tsv': 'lite-voyager.sqlite', '*.jsonl': 'lite-voyager.sqlite', '*.xlsx': 'lite-voyager.sqlite' });
  expect(storage.writes[0]).toEqual({ enabled: false, owned: ['*.tsv', '*.jsonl', '*.xlsx'] });
  host.global['*.tsv'] = 'new-choice'; delete host.global['*.xlsx']; changed(); await defaults.settled;
  defaults.dispose(); const reloaded = new OpeningDefaults(storage as unknown as vscode.Memento); await reloaded.settled;
  expect(host.global['*.xlsx']).toBeUndefined(); host.enabled = false; changed(); await reloaded.settled;
  expect(host.global).toEqual({ '*.json': 'default', '*.db': 'mine', '*.tsv': 'new-choice' }); expect(host.error).not.toHaveBeenCalled(); reloaded.dispose();
});
test('D-5: Given a settings-write failure or interrupted journal, When retrying after reload, Then failure is visible and ownership permits complete cleanup', async () => {
  const storage = memory(); host.enabled = true; host.update.mockRejectedValueOnce(new Error('read-only settings'));
  const failed = new OpeningDefaults(storage as unknown as vscode.Memento); await failed.settled; expect(host.error).toHaveBeenCalledWith(expect.stringContaining('read-only settings')); failed.dispose();
  const recovered = new OpeningDefaults(storage as unknown as vscode.Memento); await recovered.settled; expect(host.global['*.csv']).toBe('lite-voyager.sqlite');
  host.enabled = false; changed(); await recovered.settled; expect(host.global).toEqual({}); recovered.dispose();
});
test('D-5: Given feature-created settings published before a crash, When restarted disabled from the ownership journal, Then only those published entries are removed', async () => {
  const storage = memory(); await storage.update('openingAssociations.v1', { enabled: false, owned: ['*.csv'] }); host.global = { '*.csv': 'lite-voyager.sqlite', '*.db': 'default' };
  const defaults = new OpeningDefaults(storage as unknown as vscode.Memento); await defaults.settled; expect(host.global).toEqual({ '*.db': 'default' }); defaults.dispose();
});
test('D-5: Given a disposed queued synchronizer, When pending work settles, Then no settings are written', async () => {
  host.enabled = true; const defaults = new OpeningDefaults(memory() as unknown as vscode.Memento); defaults.dispose(); await defaults.settled; expect(host.update).not.toHaveBeenCalled();
});
test('D-5: Given an editor-association edit during journal persistence, When enabling defaults resumes, Then the fresh explicit choice and unrelated entry survive', async () => {
  host.enabled = true; const storage = memory(); const persist = storage.update; let edited = false;
  storage.update = vi.fn(async (key: string, value: unknown) => {
    await persist(key, value);
    if (!edited) { edited = true; host.global = { '*.csv': 'default', '*.md': 'markdown' }; changed(); }
  });
  const defaults = new OpeningDefaults(storage as unknown as vscode.Memento); await defaults.settled;
  expect(host.global['*.csv']).toBe('default'); expect(host.global['*.md']).toBe('markdown');
  host.enabled = false; changed(); await defaults.settled; expect(host.global).toEqual({ '*.csv': 'default', '*.md': 'markdown' }); defaults.dispose();
});
test('D-5: Given shutdown during journal persistence, When that write completes, Then the disposed feature does not publish settings', async () => {
  host.enabled = true; const storage = memory(); let release!: () => void; let entered!: () => void;
  const started = new Promise<void>((accept) => { entered = accept; }); const hold = new Promise<void>((accept) => { release = accept; });
  const persist = storage.update; storage.update = vi.fn(async (key: string, value: unknown) => { await persist(key, value); entered(); await hold; });
  const defaults = new OpeningDefaults(storage as unknown as vscode.Memento); await started; defaults.dispose(); release(); await defaults.settled; expect(host.update).not.toHaveBeenCalled();
});
test.each(['changed', 'rejected', 'disposed'])('D-5: Given an unpublished journal with outcome %s, When a user selects Lite Voyager explicitly, Then disable never removes that user-owned association', async (outcome) => {
  host.enabled = true; const storage = memory(); const persist = storage.update; let first = true;
  storage.update = vi.fn(async (key: string, value: unknown) => {
    await persist(key, value);
    if (first) {
      first = false;
      if (outcome !== 'rejected') { host.global = { '*.csv': 'lite-voyager.sqlite' }; }
      if (outcome === 'disposed') { defaults.dispose(); } else if (outcome === 'changed') { changed(); }
    }
  });
  if (outcome === 'rejected') { host.update.mockRejectedValueOnce(new Error('settings rejected')); }
  const defaults = new OpeningDefaults(storage as unknown as vscode.Memento); await defaults.settled; await defaults.settled; defaults.dispose();
  host.global['*.csv'] = 'lite-voyager.sqlite'; host.enabled = false;
  const disabled = new OpeningDefaults(storage as unknown as vscode.Memento); await disabled.settled;
  expect(host.global['*.csv']).toBe('lite-voyager.sqlite'); disabled.dispose();
});
function uri(scheme: string): vscode.Uri { return { scheme, fsPath: '/a.csv' } as vscode.Uri; }
test('D-5: Given Explorer URI, active text editor or no selection, When invoking Open in Lite Voyager, Then the shared editor command or cancellable picker is used', async () => {
  const selected = uri('file'); await openInLiteVoyager(selected); expect(host.execute).toHaveBeenLastCalledWith('vscode.openWith', selected, 'lite-voyager.sqlite');
  host.active = { document: { uri: selected } }; await openInLiteVoyager(); expect(host.picker).not.toHaveBeenCalled();
  host.active = undefined; host.execute.mockClear(); await openInLiteVoyager(); expect(host.picker).toHaveBeenCalledOnce(); expect(host.execute).not.toHaveBeenCalled();
});
test('D-5: Given unsaved/virtual input or a failed editor command, When opening, Then there is an actionable error and no unsupported read', async () => {
  await openInLiteVoyager(uri('untitled')); expect(host.error).toHaveBeenCalledWith(expect.stringContaining('saved local')); expect(host.execute).not.toHaveBeenCalled();
  host.execute.mockRejectedValueOnce(new Error('unavailable')); await openInLiteVoyager(uri('file')); expect(host.error).toHaveBeenLastCalledWith(expect.stringContaining('unavailable'));
});
