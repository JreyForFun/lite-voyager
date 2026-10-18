import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type * as vscode from 'vscode';
import { afterEach, expect, test, vi } from 'vitest';
import type { Engine } from '../../src/engine/engine';
import type { FileLoader, ImportedTable } from '../../src/loaders/file-loader';
import { CsvImportSession } from '../../src/editor/csv-import';
import { SqliteSession } from '../../src/editor/sqlite-session';
import { SqliteSaveService } from '../../src/editor/sqlite-save';
import { TempStorage } from '../../src/storage/temp-storage';
import type { JsonPreviewResult } from '../../src/protocol';

const notifyError = vi.hoisted(() => vi.fn());
const disk = vi.hoisted(() => ({ low: false }));
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>();
  return { ...fs, statfs: async (...args: Parameters<typeof fs.statfs>) => {
    const result = await fs.statfs(...args); return disk.low ? { ...result, bavail: 0n, bsize: 1n } : result;
  } };
});
vi.mock('vscode', () => ({ Uri: { file: (path: string) => ({ fsPath: path, toString: () => path }) },
  env: { clipboard: { writeText: vi.fn() } }, window: { showSaveDialog: vi.fn(), showErrorMessage: notifyError } }));
function panel() {
  const receive = new Set<(message: unknown) => void>(); const closes = new Set<() => void>();
  return { webview: { html: '', cspSource: 'local:', asWebviewUri: (uri: vscode.Uri) => uri, postMessage: vi.fn().mockResolvedValue(true),
    onDidReceiveMessage: (fn: (message: unknown) => void) => { receive.add(fn); return { dispose: () => { receive.delete(fn); } }; } },
    onDidDispose: (fn: () => void) => { closes.add(fn); return { dispose: () => { closes.delete(fn); } }; },
    dispose: () => { for (const fn of closes) { fn(); } }, receive: (message: unknown) => { for (const fn of receive) { fn(message); } } };
}
const preview = { columns: ['a'], rows: [['1']], delimiter: ',' as const, header: true, bytesRead: '4', totalBytes: '4', reachedEnd: true, notice: '', threadId: 1 };
const fixtureRoots: string[] = [];
afterEach(async () => { disk.low = false; for (const root of fixtureRoots.splice(0)) { await rm(root, { recursive: true, force: true }); } });
function engine() {
  const page = { columns: ['a'], rows: [['1']], hasMore: false };
  return { open: vi.fn().mockResolvedValue({ engine: 'node:sqlite', memoryLimited: false, bytes: '4096', needsConsent: false, notice: '', threadId: 1, processId: 1, sqlite: 'test' }),
    schema: vi.fn().mockResolvedValue(page), columns: vi.fn().mockResolvedValue(page), indexes: vi.fn().mockResolvedValue(page), indexColumns: vi.fn().mockResolvedValue(page),
    page: vi.fn().mockResolvedValue(page), grid: vi.fn().mockResolvedValue(page), query: vi.fn().mockResolvedValue(page), exportResults: vi.fn(), cancel: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) } satisfies Engine;
}
async function fixture(loader: FileLoader, started?: number, format: 'csv' | 'json' | 'xlsx' = 'csv') {
  const root = await mkdtemp(join(tmpdir(), 'lv-import-panel-')); fixtureRoots.push(root);
  const directory = join(root, 'storage'); await mkdir(directory); const source = join(root, 'source.csv'); await writeFile(source, 'a\n1\n');
  const view = panel(); const db = engine();
  const session = new CsvImportSession({ fsPath: source } as vscode.Uri, view as unknown as vscode.WebviewPanel, '/extension/dist', directory, loader, () => {}, () => db, started, format);
  await session.finished; return { directory, view, db, session };
}

test('D-5: Given a resolving custom editor whose frame is not mounted, When the first post is undelivered then the webview announces ready, Then preview starts once without disposing the editor', async () => {
  const view = panel(); view.webview.postMessage.mockResolvedValue(false); const read = vi.fn<FileLoader['preview']>().mockResolvedValue(preview);
  const session = new CsvImportSession({ fsPath: '/source.csv' } as vscode.Uri, view as unknown as vscode.WebviewPanel, '/extension/dist', '/storage',
    { extensions: ['csv'], preview: read, import: vi.fn() }, () => {}, undefined, undefined, 'csv', true);
  try {
    await Promise.resolve(); await Promise.resolve(); expect(read).not.toHaveBeenCalled();
    view.receive({ type: 'csvPreviewReady', contextId: session.contextId }); await session.finished;
    expect(session.state.phase).toBe('ready'); expect(read).toHaveBeenCalledOnce(); expect(await session.initialized).toBe(true);
  } finally { view.dispose(); await session.closed; }
});

test('FR-006: Given an XLSX preview/session, When importing sheets, Then the shared browser opens and reports the full workbook instead of only its first sheet', async () => {
  const preview = { columns: ['a'], rows: [['1']], format: 'xlsx' as const, sheetName: 'Data', sheetCount: 2, bytesRead: '9', totalBytes: '9', reachedEnd: true, notice: '', threadId: 1 };
  const read = vi.fn<FileLoader['preview']>().mockResolvedValue(preview);
  const load = vi.fn<FileLoader['import']>().mockImplementation(async (_source, target) => { await writeFile(target.path, 'owned'); return [
    { name: 'Data', columns: ['a'], rowCount: '1', notice: 'Cached values only.' }, { name: 'Empty', columns: ['__xlsx_empty'], rowCount: '0' },
  ]; });
  const run = await fixture({ extensions: ['xlsx'], preview: read, import: load }, undefined, 'xlsx');
  try {
    expect(run.session.state.phase).toBe('ready'); await run.session.startImport(); expect(run.session.state.phase).toBe('opened');
    expect(run.session.state.message).toMatch(/2.*(sheet|table)/iu); expect(run.session.state.message).toMatch(/1.*rows/iu);
    expect(run.view.webview.html).toContain('Cached values only.');
  } finally { run.view.dispose(); await run.session.closed; }
});

test('FR-005: Given a JSON preview/session, When retrying then importing, Then CSV options never reach the loader and shared storage/save/browser lifecycle works', async () => {
  const preview: JsonPreviewResult = { columns: ['a'], rows: [['1']], format: 'json', bytesRead: '9', totalBytes: '9', reachedEnd: true, notice: '', threadId: 1 };
  const read = vi.fn<FileLoader['preview']>().mockResolvedValue(preview);
  const load = vi.fn<FileLoader['import']>().mockImplementation(async (_source, target) => { await writeFile(target.path, 'owned'); return [{ name: 'records', columns: ['a'], rowCount: '1' }]; });
  const run = await fixture({ extensions: ['json', 'jsonl'], preview: read, import: load }, undefined, 'json');
  try {
    expect(run.session.state.phase).toBe('ready'); expect(run.session.state.options).toEqual({}); expect(run.view.webview.html).toContain('JSON / JSONL import');
    await run.session.refresh({}); expect(read).toHaveBeenLastCalledWith(expect.any(String), {}, expect.any(AbortSignal));
    await run.session.startImport(); expect(run.session.state.phase).toBe('opened');
    expect(load).toHaveBeenCalledWith(expect.any(String), expect.any(Object), {}, expect.any(Function), expect.any(AbortSignal));
    expect(run.view.webview.html).toContain('id="sqlite-save"');
  } finally { run.view.dispose(); await run.session.closed; expect(await readdir(run.directory)).toEqual([]); }
});

test('FR-004: Given import controls and preview, When applying header-off and starting import, Then options reach the worker and SQL becomes available only after success', async () => {
  const load = vi.fn<FileLoader['import']>().mockImplementation(async (_path, target, _options, progress) => {
    progress({ bytes: '4', totalBytes: '4', rows: '1', engine: 'node:sqlite', phase: 'reading', notice: 'disk backed' });
    await writeFile(target.path, 'owned'); return [{ name: 'records', columns: ['a'], rowCount: '1' }];
  });
  const read = vi.fn<FileLoader['preview']>().mockResolvedValue(preview);
  const run = await fixture({ extensions: ['csv'], preview: read, import: load });
  try {
    expect(run.session.state.phase).toBe('ready'); expect(run.db.open).not.toHaveBeenCalled();
    expect(run.session.browserProcessId).toBeUndefined();
    await run.session.refresh({ delimiter: ';', header: false, allText: true });
    expect(read).toHaveBeenLastCalledWith(expect.any(String), { delimiter: ';', header: false, allText: true }, expect.any(AbortSignal));
    await run.session.startImport();
    expect(load).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ engine: 'node:sqlite' }), expect.objectContaining({ header: false, allText: true }), expect.any(Function), expect.any(AbortSignal));
    expect(run.session.state.phase).toBe('opened'); expect(run.db.open).toHaveBeenCalledOnce();
    expect(run.session.browserProcessId).toBe(1);
    expect(run.view.webview.html).toContain('sql-editor'); expect(run.view.webview.html).toContain('records');
  } finally { run.view.dispose(); await run.session.closed; expect(await readdir(run.directory)).toEqual([]); await rm(run.directory, { recursive: true, force: true }); }
});

test('FR-007: Given an opened import, When rendering SQL, Then Save as SQLite belongs to this import context only', async () => {
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: async (_source, target) => { await writeFile(target.path, 'owned'); return []; } });
  try {
    await run.session.startImport(); expect(run.view.webview.html).toContain('id="sqlite-save"');
    expect(run.view.webview.html).toContain(`data-save-context="${run.session.contextId}"`);
  } finally { run.view.dispose(); await run.session.closed; }
});

test('FR-007: Given a SQLite save still settling after closure, When publication or cleanup fails, Then shutdown waits and notifies the exact actionable error once', async () => {
  notifyError.mockClear(); let fail!: () => void; const failure = 'SQLite save could not publish the complete database. Check permissions and retry.';
  const saving = vi.spyOn(SqliteSaveService.prototype, 'run').mockImplementation(() => new Promise((_accept, reject) => { fail = () => { reject(new Error(failure)); }; }));
  const settled = vi.spyOn(SqliteSaveService.prototype, 'settled').mockRejectedValue(new Error(failure));
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: async (_source, target) => { await writeFile(target.path, 'owned'); return []; } });
  try {
    await run.session.startImport(); const task = run.session.saveAsSqlite(); run.view.dispose(); let closed = false;
    void run.session.closed.then(() => { closed = true; }); await Promise.resolve(); expect(closed).toBe(false);
    fail(); await task; await run.session.closed;
    expect(notifyError).toHaveBeenCalledExactlyOnceWith(failure); expect(await readdir(run.directory)).toEqual([]);
  } finally { saving.mockRestore(); settled.mockRestore(); run.view.dispose(); await run.session.closed; }
});

test('FR-007: Given a live import failure and locked storage, When cleanup fails, Then the operation settles visibly and retry cleans the retained directory before creating another', async () => {
  notifyError.mockClear(); const remove = vi.spyOn(TempStorage.prototype, 'remove');
  remove.mockRejectedValueOnce(new Error('locked')).mockRejectedValueOnce(new Error('still locked'));
  const load = vi.fn<FileLoader['import']>().mockRejectedValueOnce(new Error('Disk full. Free space and retry.')).mockImplementation(async (_source, target) => { await writeFile(target.path, 'valid'); return []; });
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: load });
  try {
    await expect(run.session.startImport()).resolves.toBeUndefined(); expect(run.session.state.phase).toBe('error');
    expect(notifyError).toHaveBeenCalledWith(expect.stringMatching(/storage.*removed.*permissions/iu));
    expect(await readdir(run.directory)).toHaveLength(1);
    await run.session.refresh({}); await run.session.startImport();
    expect(load).toHaveBeenCalledTimes(1); expect(await readdir(run.directory)).toHaveLength(1);
    await run.session.refresh({}); await run.session.startImport(); expect(load).toHaveBeenCalledTimes(2);
    expect(run.session.state.phase).toBe('opened'); expect(await readdir(run.directory)).toHaveLength(1);
  } finally { remove.mockRestore(); run.view.dispose(); await run.session.closed; }
});

test('FR-007: Given low estimated storage and explicit headless approval, When importing, Then the exact preflight decision is exercised without disabling the disk check', async () => {
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: async (_source, target) => { await writeFile(target.path, 'owned'); return []; } });
  try {
    const approve = vi.fn().mockResolvedValue(true); run.session.configureImportSpace(approve); disk.low = true;
    await run.session.startImport(); expect(run.session.state.phase).toBe('opened');
    expect(approve).toHaveBeenCalledExactlyOnceWith({ available: 0n, required: 64n * 1024n * 1024n + 12n });
  } finally { run.view.dispose(); await run.session.closed; }
});

test('NFR-004: Given time spent creating an import panel, When preview DOM reports arrive, Then first-row timing includes the command start', async () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(650);
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: () => Promise.resolve([]) }, 100);
  try {
    run.view.receive({ type: 'csvPreviewStatus', contextId: run.session.contextId, renderedRows: 1, renderedColumns: 1 });
    expect(run.session.firstRowsMs).toBe(550);
  } finally { run.view.dispose(); await run.session.closed; await rm(run.directory, { recursive: true, force: true }); clock.mockRestore(); }
});

test('NFR-004: Given delayed transport, worker result and first DOM report, When diagnosing preview time, Then stages use the original command clock and never replace the total', async () => {
  let now = 150; const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  let transport!: (ready: boolean) => void; const ready = new Promise<boolean>((accept) => { transport = accept; });
  let parsed!: (result: typeof preview) => void; const read = vi.fn<FileLoader['preview']>(() => new Promise((accept) => { parsed = accept; }));
  const view = panel(); view.webview.postMessage.mockImplementationOnce(() => ready);
  const session = new CsvImportSession({ fsPath: '/source.csv' } as vscode.Uri, view as unknown as vscode.WebviewPanel,
    '/extension/dist', '/unused-storage', { extensions: ['csv'], preview: read, import: () => Promise.resolve([]) }, () => {}, undefined, 100);
  try {
    expect(read).not.toHaveBeenCalled(); now = 300; transport(true); await session.initialized;
    expect(read).toHaveBeenCalledOnce(); now = 450; parsed(preview); await session.finished;
    now = 500; view.receive({ type: 'csvPreviewReady', contextId: session.contextId });
    now = 650; view.receive({ type: 'csvPreviewStatus', contextId: session.contextId, renderedRows: 1, renderedColumns: 1 });
    expect(session).toMatchObject({ firstRowsMs: 550, previewTimings: { transportMs: 200, readStartedMs: 200, readFinishedMs: 350, webviewReadyMs: 400 } });
    now = 900; view.receive({ type: 'csvPreviewReady', contextId: session.contextId });
    expect(session).toMatchObject({ firstRowsMs: 550, previewTimings: { webviewReadyMs: 400 } });
  } finally { view.dispose(); await session.closed; clock.mockRestore(); }
});

test.each([
  'Export temporary files could not be removed. Check the .lite-voyager-export- folder beside the destination.',
  'The export could not be saved. Close programs using the destination and retry. Existing output was not replaced.',
])('FR-014: Given an export failure after an imported tab closes, When shutdown settles, Then the user receives the exact actionable error: %s', async (failure) => {
  notifyError.mockClear();
  const configure = vi.spyOn(SqliteSession.prototype, 'configureExport').mockImplementation(function (this: SqliteSession) {
    this.browser.setExporter({ run: () => Promise.resolve(undefined), abort: () => {}, settled: () => Promise.reject(new Error(failure)) });
  });
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: () => Promise.resolve([]) });
  try {
    await run.session.startImport(); expect(run.session.state.phase).toBe('opened');
    run.view.dispose(); await run.session.closed;
    expect(notifyError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(await readdir(run.directory)).toEqual([]);
  } finally { configure.mockRestore(); run.view.dispose(); await run.session.closed; await rm(run.directory, { recursive: true, force: true }); }
});

test('FR-004: Given cancellation followed by late import success, When closing the tab, Then no browser is opened and all session storage is removed', async () => {
  let finish: (tables: ImportedTable[]) => void = () => {};
  const load = vi.fn<FileLoader['import']>().mockImplementation((_path, target) => new Promise((accept) => {
    finish = (tables) => { void writeFile(target.path, 'late').then(() => { accept(tables); }); };
  }));
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: load });
  try {
    const task = run.session.startImport();
    await vi.waitFor(() => { expect(load).toHaveBeenCalledOnce(); });
    run.view.receive({ type: 'csvImportCancel', contextId: '2'.repeat(32) }); expect(run.session.state.phase).toBe('importing');
    run.view.dispose(); finish([{ name: 'records', columns: ['a'], rowCount: '1' }]); await task; await run.session.closed;
    expect(run.db.open).not.toHaveBeenCalled(); expect(await readdir(run.directory)).toEqual([]);
  } finally { run.view.dispose(); await run.session.closed; await rm(run.directory, { recursive: true, force: true }); }
});

test('FR-004: Given failed import, When retrying with a new preview, Then error is actionable and another import can succeed', async () => {
  const load = vi.fn<FileLoader['import']>().mockRejectedValueOnce(new Error('Disk full. Free space.')).mockImplementation(async (_path, target) => {
    await writeFile(target.path, 'recovery'); return [];
  });
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: load });
  try {
    await run.session.startImport(); expect(run.session.state.phase).toBe('error'); expect(run.session.state.message).toContain('Disk full');
    expect(run.db.open).not.toHaveBeenCalled(); expect(await readdir(run.directory)).toEqual([]);
    await run.session.refresh({}); await run.session.startImport(); expect(run.session.state.phase).toBe('opened');
    expect(run.session.state.message).toContain('no table was created'); expect(run.session.state.message).not.toContain('into records');
  } finally { run.view.dispose(); await run.session.closed; await rm(run.directory, { recursive: true, force: true }); }
});

test('FR-004: Given an active import and status listeners, When cancelling, Then cancellation is reported immediately and cleanup finishes', async () => {
  const load = vi.fn<FileLoader['import']>().mockImplementation((_path, _target, _options, _progress, signal) => new Promise((_accept, reject) => {
    signal.addEventListener('abort', () => { reject(new Error('cancelled')); }, { once: true });
  }));
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: load }); const phases: string[] = [];
  const unsubscribe = run.session.onStatus(() => { phases.push(run.session.state.phase); });
  try {
    const task = run.session.startImport(); await vi.waitFor(() => { expect(load).toHaveBeenCalledOnce(); });
    await run.session.cancel(); await task; expect(phases.at(-1)).toBe('cancelled'); expect(await readdir(run.directory)).toEqual([]);
  } finally { unsubscribe(); run.view.dispose(); await run.session.closed; await rm(run.directory, { recursive: true, force: true }); }
});
