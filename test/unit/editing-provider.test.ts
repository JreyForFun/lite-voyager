import type * as vscode from 'vscode';
import { beforeEach, expect, test, vi } from 'vitest';
import { SqliteEditorProvider } from '../../src/editor/sqlite-editor';
import type { Engine } from '../../src/engine/engine';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteSession } from '../../src/editor/sqlite-session';

const mocks = vi.hoisted(() => ({ edit: vi.fn<NonNullable<Engine['edit']>>(), cancel: vi.fn<Engine['cancel']>(), autoSave: 'off', command: vi.fn() }));
vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: () => mocks.autoSave }) },
  commands: { executeCommand: mocks.command },
}));
vi.mock('../../src/engine/engine-client', () => ({ EngineClient: vi.fn(function () { return { edit: mocks.edit, cancel: mocks.cancel, close: async () => {} }; }) }));
const token: vscode.CancellationToken = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) };
const uri = { scheme: 'file', fsPath: '/test.sqlite', toString: () => 'file:///test.sqlite' } as vscode.Uri;
const openContext: vscode.CustomDocumentOpenContext = { backupId: undefined, untitledDocumentData: undefined };
beforeEach(() => { mocks.autoSave = 'off'; mocks.edit.mockReset(); mocks.cancel.mockReset(); mocks.cancel.mockResolvedValue(undefined); mocks.command.mockReset(); });
const response = (value: unknown) => ({ columns: ['editing'], rows: [[JSON.stringify(value)]], hasMore: false });

test('FR-020: Given native Save waiting for secondary readers, When toolbar Cancel is clicked, Then no write is sent and suspended readers resume', async () => {
  const provider = new SqliteEditorProvider('/extension'); const document = provider.openCustomDocument(uri, openContext, token); const owner = document.session;
  owner.state = { phase: 'opened', message: 'Opened', opened: { engine: 'node:sqlite', bytes: '1', memoryLimited: false, needsConsent: false, notice: '', threadId: 1, processId: 1, sqlite: 'test' } };
  const panel = (): vscode.WebviewPanel => ({ webview: { postMessage: () => Promise.resolve(true) } }) as unknown as vscode.WebviewPanel;
  const first = panel(); document.attach(first, () => owner); let resumePause!: (resume: () => Promise<void>) => void; let resumed = false;
  const secondary = { close: () => Promise.resolve(), suspendReads: () => new Promise<() => Promise<void>>((resolve) => { resumePause = resolve; }) } as unknown as Engine;
  document.attach(panel(), () => new SqliteSession('/test.sqlite', secondary)); document.activate(first);
  mocks.edit.mockResolvedValue(response('version')); document.edits.setWriteMode(true); await document.edits.stageSql('UPDATE data SET value=1');
  mocks.edit.mockClear(); mocks.edit.mockResolvedValue(response(true));
  const saving = provider.saveCustomDocument(document, token); const result = saving.then(() => 'saved', (error: unknown) => error instanceof Error ? error.message : 'unknown');
  try {
    await provider.handleEditing(document, { type: 'editingRequest', contextId: '12345678-1234-1234-1234-123456789012', requestId: 1, action: 'cancel' });
    resumePause(() => { resumed = true; return Promise.resolve(); });
    expect(await result).toMatch(/cancel/iu); expect(mocks.edit).not.toHaveBeenCalled(); expect(resumed).toBe(true); expect(document.edits.dirty).toBe(true);
  } finally { resumePause(() => Promise.resolve()); await result; provider.dispose(); }
});

test.each([false, true])('FR-020: Given native split views and failure=%s, When saving across an active-view change, Then secondary readers pause, the owner stays pinned and readers resume', async (failure) => {
  const provider = new SqliteEditorProvider('/extension'); const document = provider.openCustomDocument(uri, openContext, token);
  const owner = document.session; const order: string[] = [];
  owner.state = { phase: 'opened', message: 'Opened', opened: { engine: 'node:sqlite', bytes: '1', memoryLimited: false, needsConsent: false, notice: '', threadId: 1, processId: 1, sqlite: 'test' } };
  const panel = (): vscode.WebviewPanel => ({ webview: { postMessage: () => Promise.resolve(true) } }) as unknown as vscode.WebviewPanel;
  const first = panel(); const second = panel(); document.attach(first, () => owner);
  const secondaryEngine = { close: () => Promise.resolve(), edit: () => Promise.reject(new Error('Save routed to secondary view')), suspendReads: () => {
    order.push('pause'); document.activate(second); return Promise.resolve(() => { order.push('resume'); return Promise.resolve(); });
  } } as unknown as Engine;
  document.attach(second, () => new SqliteSession('/test.sqlite', secondaryEngine)); document.activate(first);
  mocks.edit.mockResolvedValue(response('version')); document.edits.setWriteMode(true); await document.edits.stageSql('UPDATE data SET value=1');
  mocks.edit.mockImplementation(() => { order.push('save'); return Promise.resolve(response(failure ? { rollbackVersion: 'protected-rollback', error: 'constraint failed' } : true)); });
  try {
    const saving = provider.saveCustomDocument(document, token);
    if (failure) { await expect(saving).rejects.toThrow('constraint failed'); expect(document.edits.backup()).toContain('protected-rollback'); }
    else { await saving; expect(document.edits.dirty).toBe(false); }
    expect(order).toEqual(['pause', 'save', 'resume']); expect(document.savingEngine).toBeUndefined();
  } finally { provider.dispose(); }
});

test('FR-020: Given an active Save As, When VS Code cancels it, Then busy state is visible, the owning helper is cancelled and the queue survives', async () => {
  const provider = new SqliteEditorProvider('/extension'); const listeners = new Set<() => void>(); let cancelled = false;
  const cancellation: vscode.CancellationToken = { get isCancellationRequested() { return cancelled; }, onCancellationRequested(listener) {
    const callback = (): void => { listener(undefined); }; listeners.add(callback); return { dispose() { listeners.delete(callback); } };
  } };
  const document = provider.openCustomDocument(uri, openContext, cancellation);
  mocks.edit.mockResolvedValue(response('version')); document.edits.setWriteMode(true); await document.edits.stageSql('UPDATE data SET value=1');
  let rejectSave!: (error: Error) => void;
  mocks.edit.mockImplementation(() => new Promise((_accept, reject) => { rejectSave = reject; }));
  mocks.cancel.mockImplementation(() => { rejectSave(new Error('Save cancelled')); return Promise.resolve(); });
  const saving = provider.saveCustomDocumentAs(document, { scheme: 'file', fsPath: '/copy.sqlite' } as vscode.Uri, cancellation);
  const outcome = saving.then(() => 'saved', (error: unknown) => error instanceof Error ? error.message : 'unknown');
  try {
    expect(document.editingState.busy).toBe(true); expect(listeners.size).toBe(1);
    cancelled = true; for (const listener of listeners) { listener(); }
    expect(await outcome).toMatch(/cancel/iu); expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect(document.edits.dirty).toBe(true); expect(document.editingState.busy).toBe(false); expect(listeners.size).toBe(0);
  } finally { rejectSave(new Error('Test cleanup')); await outcome; provider.dispose(); }
});

test('FR-020: Given a document-owned edit, When staging then undoing/redoing, Then VS Code receives a reversible edit event and the source stays untouched', async () => {
  const provider = new SqliteEditorProvider('/extension');
  const document = provider.openCustomDocument(uri, openContext, token);
  const events: vscode.CustomDocumentEditEvent[] = [];
  const subscription = provider.onDidChangeCustomDocument((event) => { events.push(event); });
  mocks.edit.mockResolvedValue(response('source-version'));
  await provider.handleEditing(document, { type: 'editingRequest', contextId: '12345678-1234-1234-1234-123456789012', requestId: 1, action: 'mode', on: true });
  await provider.handleEditing(document, { type: 'editingRequest', contextId: '12345678-1234-1234-1234-123456789012', requestId: 2, action: 'sql', sql: 'UPDATE data SET value=42' });
  expect(events).toHaveLength(1); expect(document.edits.dirty).toBe(true);
  await events[0]?.undo(); expect(document.edits.dirty).toBe(false);
  await events[0]?.redo(); expect(document.edits.dirty).toBe(true);
  expect(mocks.edit.mock.calls.every(([command]) => command.action !== 'save')).toBe(true);
  mocks.edit.mockResolvedValue(response(true));
  await provider.saveCustomDocument(document, token); expect(document.edits.dirty).toBe(false);
  subscription.dispose(); provider.dispose();
});

test('FR-016: Given auto-save or a cancelled explicit save, When the provider is invoked, Then pending changes are preserved without a save request', async () => {
  const provider = new SqliteEditorProvider('/extension'); const document = provider.openCustomDocument(uri, openContext, token);
  document.edits.setWriteMode(true); mocks.edit.mockResolvedValue(response('version')); await document.edits.stageSql('UPDATE data SET value=1');
  mocks.edit.mockClear(); mocks.autoSave = 'afterDelay';
  await expect(provider.saveCustomDocument(document, token)).rejects.toThrow(/explicit|Save changes/iu);
  mocks.autoSave = 'off';
  await expect(provider.saveCustomDocument(document, { ...token, isCancellationRequested: true })).rejects.toThrow(/cancel/iu);
  expect(document.edits.dirty).toBe(true); expect(mocks.edit).not.toHaveBeenCalled(); provider.dispose();
});

test('FR-016: Given enabled auto-save, When enabling write mode, Then the document refuses staging before unsaved edits could miss VS Code backups', async () => {
  const provider = new SqliteEditorProvider('/extension'); const document = provider.openCustomDocument(uri, openContext, token); mocks.autoSave = 'afterDelay';
  await expect(provider.handleEditing(document, { type: 'editingRequest', contextId: '12345678-1234-1234-1234-123456789012', requestId: 1, action: 'mode', on: true })).rejects.toThrow(/auto-save/iu);
  expect(document.edits.writeMode).toBe(false); expect(mocks.edit).not.toHaveBeenCalled(); provider.dispose();
});

test('FR-020: Given a valid existing backup, When backup is cancelled before publication, Then the previous backup survives and successful recovery restores a read-only dirty queue', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-backup-')); const path = join(directory, 'backup.json');
  const provider = new SqliteEditorProvider('/extension'); const document = provider.openCustomDocument(uri, openContext, token);
  document.edits.setWriteMode(true); mocks.edit.mockResolvedValue(response('version')); await document.edits.stageSql('UPDATE data SET value=1');
  const destination = { scheme: 'file', fsPath: path } as vscode.Uri;
  try {
    await writeFile(path, 'previous valid backup'); let checks = 0;
    const cancelled = { ...token, get isCancellationRequested() { return ++checks > 1; } };
    await expect(provider.backupCustomDocument(document, { destination }, cancelled)).rejects.toThrow(/cancel/iu);
    expect(await readFile(path, 'utf8')).toBe('previous valid backup');
    const backup = await provider.backupCustomDocument(document, { destination }, token);
    const recovered = provider.openCustomDocument(uri, { ...openContext, backupId: backup.id }, token); await recovered.restore;
    expect(recovered.edits.operations).toEqual(document.edits.operations); expect(recovered.edits.dirty).toBe(true); expect(recovered.edits.writeMode).toBe(false);
  } finally { provider.dispose(); await rm(directory, { recursive: true, force: true }); }
});
