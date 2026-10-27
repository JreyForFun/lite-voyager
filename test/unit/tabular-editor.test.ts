import type * as vscode from 'vscode';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { TabularEditorProvider, TabularDocument } from '../../src/editor/tabular-editor';
import type { SqliteEditorProvider } from '../../src/editor/sqlite-editor';
import type { CsvImportController } from '../../src/editor/csv-import';
vi.mock('vscode', () => ({}));
function fixture() {
  const sqlite = { openCustomDocument: vi.fn().mockReturnValue({ kind: 'sqlite' }), resolveCustomEditor: vi.fn(), dispose: vi.fn(),
    onDidChangeCustomDocument: vi.fn(), saveCustomDocument: vi.fn(), saveCustomDocumentAs: vi.fn(), revertCustomDocument: vi.fn(), backupCustomDocument: vi.fn() };
  const controllers = { csv: { ready: Promise.resolve(), attach: vi.fn().mockResolvedValue(undefined) }, json: { ready: Promise.resolve(), attach: vi.fn().mockResolvedValue(undefined) }, xlsx: { ready: Promise.resolve(), attach: vi.fn().mockResolvedValue(undefined) } };
  const provider = new TabularEditorProvider(sqlite as unknown as SqliteEditorProvider, controllers as unknown as Record<'csv' | 'json' | 'xlsx', CsvImportController>);
  const cancellation = new Set<() => void>(); const token = { isCancellationRequested: false, onCancellationRequested: (fn: () => void) => { cancellation.add(fn); return { dispose: () => { cancellation.delete(fn); } }; } };
  const closes = new Set<() => void>(); const panel = { dispose: vi.fn(() => { for (const close of closes) { close(); } }), onDidDispose: (fn: () => void) => { closes.add(fn); return { dispose: () => { closes.delete(fn); } }; } };
  return { provider, sqlite, controllers, token: token as vscode.CancellationToken, panel: panel as unknown as vscode.WebviewPanel, disposePanel: panel.dispose, cancellation };
}
function uri(path: string, scheme = 'file'): vscode.Uri { return { fsPath: path, scheme, toString: () => `${scheme}:${path}` } as vscode.Uri; }
const openContext = { backupId: undefined, untitledDocumentData: undefined };

test('FR-020: Given the registered multi-format provider, When SQLite changes or saves, Then custom document events and every persistence callback reach the SQLite provider', async () => {
  const run = fixture(); const doc = await run.provider.openCustomDocument(uri('/a.sqlite'), openContext, run.token);
  expect(run.provider.onDidChangeCustomDocument).toBe(run.sqlite.onDidChangeCustomDocument);
  await run.provider.saveCustomDocument(doc, run.token); expect(run.sqlite.saveCustomDocument).toHaveBeenCalledWith(doc, run.token);
  const destination = uri('/copy.sqlite');
  await run.provider.saveCustomDocumentAs(doc, destination, run.token); expect(run.sqlite.saveCustomDocumentAs).toHaveBeenCalledWith(doc, destination, run.token);
  await run.provider.revertCustomDocument(doc, run.token); expect(run.sqlite.revertCustomDocument).toHaveBeenCalledWith(doc, run.token);
  const context = { destination }; await run.provider.backupCustomDocument(doc, context, run.token); expect(run.sqlite.backupCustomDocument).toHaveBeenCalledWith(doc, context, run.token);
  const imported = await run.provider.openCustomDocument(uri('/a.csv'), openContext, run.token);
  await expect(run.provider.saveCustomDocument(imported, run.token)).rejects.toThrow(/Save as SQLite/iu);
});
test.each(['csv', 'tsv', 'json', 'jsonl', 'xlsx'])('D-5: Given a %s custom document, When resolving, Then the supplied editor panel reaches the existing controller', async (extension) => {
  const run = fixture(); const source = uri(`/data/a.${extension}`); const doc = await run.provider.openCustomDocument(source, openContext, run.token);
  expect(doc).toBeInstanceOf(TabularDocument); await run.provider.resolveCustomEditor(doc, run.panel, run.token);
  const format = extension === 'csv' || extension === 'tsv' ? 'csv' : extension === 'xlsx' ? 'xlsx' : 'json';
  expect(run.controllers[format].attach).toHaveBeenCalledWith(source, run.panel); expect(run.sqlite.openCustomDocument).not.toHaveBeenCalled();
  doc.dispose(); expect(run.disposePanel).toHaveBeenCalled(); run.provider.dispose();
});
test('D-5: Given SQLite or an unsupported resource, When opening, Then the existing SQLite validation path is retained', async () => {
  const run = fixture(); for (const source of [uri('/a.sqlite'), uri('/a.data'), uri('/a.csv', 'untitled')]) {
    expect(await run.provider.openCustomDocument(source, openContext, run.token)).toEqual({ kind: 'sqlite' });
  } expect(run.sqlite.openCustomDocument).toHaveBeenCalledTimes(3);
});
test('D-5: Given pending custom-editor resolution, When closed or cancelled, Then a late controller-ready result cannot start a loader', async () => {
  for (const cancel of [false, true]) {
    const run = fixture(); let ready!: () => void; run.controllers.csv.ready = new Promise<void>((accept) => { ready = accept; });
    const doc = await run.provider.openCustomDocument(uri('/a.csv'), openContext, run.token); const resolution = run.provider.resolveCustomEditor(doc, run.panel, run.token);
    if (cancel) { for (const fn of run.cancellation) { fn(); } } else { doc.dispose(); }
    ready(); await resolution; expect(run.controllers.csv.attach).not.toHaveBeenCalled(); expect(run.disposePanel).toHaveBeenCalled();
  }
});
test('D-5: Given an already-cancelled or backed-up tabular input, When resolving, Then no import starts', async () => {
  const run = fixture(); await expect(run.provider.openCustomDocument(uri('/a.csv'), { ...openContext, backupId: 'backup' }, run.token)).rejects.toThrow(/saved local/);
  const token = { ...run.token, isCancellationRequested: true }; const doc = await run.provider.openCustomDocument(uri('/a.csv'), openContext, token);
  await run.provider.resolveCustomEditor(doc, run.panel, token); expect(run.controllers.csv.attach).not.toHaveBeenCalled();
});
test('FR-001: Given a SQLite header under a tabular filename, When explicitly opening with Lite Voyager, Then header-based SQLite detection wins without interpreting binary data as text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lv-opening-header-')); const run = fixture();
  try {
    for (const extension of ['csv', 'tsv', 'json', 'jsonl', 'xlsx']) {
      const source = uri(join(root, `renamed.${extension}`)); await writeFile(source.fsPath, Buffer.from('SQLite format 3\0remaining fixture bytes'));
      expect(await run.provider.openCustomDocument(source, openContext, run.token)).toEqual({ kind: 'sqlite' });
    }
    expect(run.sqlite.openCustomDocument).toHaveBeenCalledTimes(5);
  } finally { run.provider.dispose(); await rm(root, { recursive: true, force: true }); }
});
