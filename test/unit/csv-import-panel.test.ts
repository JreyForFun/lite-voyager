import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type * as vscode from 'vscode';
import { expect, test, vi } from 'vitest';
import type { Engine } from '../../src/engine/engine';
import type { FileLoader, ImportedTable } from '../../src/loaders/file-loader';
import { CsvImportSession } from '../../src/editor/csv-import';
import { SqliteSession } from '../../src/editor/sqlite-session';

const notifyError = vi.hoisted(() => vi.fn());
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
function engine() {
  const page = { columns: ['a'], rows: [['1']], hasMore: false };
  return { open: vi.fn().mockResolvedValue({ engine: 'node:sqlite', memoryLimited: false, bytes: '4096', needsConsent: false, notice: '', threadId: 1, processId: 1, sqlite: 'test' }),
    schema: vi.fn().mockResolvedValue(page), columns: vi.fn().mockResolvedValue(page), indexes: vi.fn().mockResolvedValue(page), indexColumns: vi.fn().mockResolvedValue(page),
    page: vi.fn().mockResolvedValue(page), grid: vi.fn().mockResolvedValue(page), query: vi.fn().mockResolvedValue(page), exportResults: vi.fn(), cancel: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) } satisfies Engine;
}
async function fixture(loader: FileLoader, started?: number) {
  const directory = await mkdtemp(join(tmpdir(), 'lv-import-panel-')); const view = panel(); const db = engine();
  const session = new CsvImportSession({ fsPath: join(directory, 'source.csv') } as vscode.Uri, view as unknown as vscode.WebviewPanel, '/extension/dist', directory, loader, () => {}, () => db, started);
  await session.finished; return { directory, view, db, session };
}

test('FR-004: Given import controls and preview, When applying header-off and starting import, Then options reach the worker and SQL becomes available only after success', async () => {
  const load = vi.fn<FileLoader['import']>().mockImplementation(async (_path, target, _options, progress) => {
    progress({ bytes: '4', totalBytes: '4', rows: '1', engine: 'node:sqlite', phase: 'reading', notice: 'disk backed' });
    await writeFile(target.path, 'owned'); return [{ name: 'records', columns: ['a'], rowCount: '1' }];
  });
  const read = vi.fn<FileLoader['preview']>().mockResolvedValue(preview);
  const run = await fixture({ extensions: ['csv'], preview: read, import: load });
  try {
    expect(run.session.state.phase).toBe('ready'); expect(run.db.open).not.toHaveBeenCalled();
    await run.session.refresh({ delimiter: ';', header: false, allText: true });
    expect(read).toHaveBeenLastCalledWith(expect.any(String), { delimiter: ';', header: false, allText: true }, expect.any(AbortSignal));
    await run.session.startImport();
    expect(load).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ engine: 'node:sqlite' }), expect.objectContaining({ header: false, allText: true }), expect.any(Function), expect.any(AbortSignal));
    expect(run.session.state.phase).toBe('opened'); expect(run.db.open).toHaveBeenCalledOnce();
    expect(run.view.webview.html).toContain('sql-editor'); expect(run.view.webview.html).toContain('records');
  } finally { run.view.dispose(); await run.session.closed; expect(await readdir(run.directory)).toEqual([]); await rm(run.directory, { recursive: true, force: true }); }
});

test('NFR-004: Given time spent creating an import panel, When preview DOM reports arrive, Then first-row timing includes the command start', async () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(650);
  const run = await fixture({ extensions: ['csv'], preview: () => Promise.resolve(preview), import: () => Promise.resolve([]) }, 100);
  try {
    run.view.receive({ type: 'csvPreviewStatus', contextId: run.session.contextId, renderedRows: 1, renderedColumns: 1 });
    expect(run.session.firstRowsMs).toBe(550);
  } finally { run.view.dispose(); await run.session.closed; await rm(run.directory, { recursive: true, force: true }); clock.mockRestore(); }
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
