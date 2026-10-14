import type * as vscode from 'vscode';
import { beforeEach, expect, test, vi } from 'vitest';
import type { PreviewLoader } from '../../src/loaders/file-loader';
import type { CsvPreviewResult as PreviewResult } from '../../src/protocol';
import { CsvPreviewController } from '../../src/editor/csv-preview';

const mocks = vi.hoisted(() => ({ panel: vi.fn(), error: vi.fn(), dialog: vi.fn() }));
vi.mock('vscode', () => ({ Uri: { file: (path: string) => ({ fsPath: path, toString: () => path }) }, ViewColumn: { Active: -1 },
  window: { createWebviewPanel: mocks.panel, showErrorMessage: mocks.error, showOpenDialog: mocks.dialog } }));
const uri = (scheme = 'file'): vscode.Uri => ({ scheme, fsPath: '/source.csv', toString: () => `${scheme}:/source.csv` }) as vscode.Uri;
function panel() {
  let closed = false; const closes = new Set<() => void>(); const messages = new Set<(value: unknown) => void>();
  const view = { webview: { html: '', cspSource: 'local:', options: {}, asWebviewUri: (value: vscode.Uri) => value,
    postMessage: vi.fn().mockResolvedValue(true), onDidReceiveMessage(listener: (message: unknown) => void) {
      messages.add(listener); return { dispose: () => { messages.delete(listener); } };
    } }, onDidDispose(listener: () => void) { closes.add(listener); return { dispose: () => { closes.delete(listener); } }; },
    dispose() { if (closed) { return; } closed = true; for (const close of closes) { close(); } },
    receive(value: unknown) { for (const message of messages) { message(value); } } };
  return view;
}
function deferred() {
  let resolve: (result: PreviewResult) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<PreviewResult>((accept, fail) => { resolve = accept; reject = fail; });
  const preview = vi.fn<PreviewLoader<PreviewResult>['preview']>().mockImplementation((_path, _options, signal) => {
    signal?.addEventListener('abort', () => { reject(new Error('cancelled')); }, { once: true }); return promise;
  });
  return { loader: { extensions: ['csv'], preview } satisfies PreviewLoader<PreviewResult>, resolve, reject };
}
const result: PreviewResult = { columns: ['value'], rows: [['9007199254740993']], delimiter: ',', header: true,
  bytesRead: '10', totalBytes: '10', reachedEnd: true, notice: '', threadId: 1 };
beforeEach(() => { vi.clearAllMocks(); mocks.dialog.mockResolvedValue(undefined); mocks.error.mockResolvedValue(undefined); });

test('FR-004: Given a new preview, When messages arrive before/after completion, Then the current context receives state and old contexts have no effect', async () => {
  const view = panel(); const task = deferred(); mocks.panel.mockReturnValue(view);
  const controller = new CsvPreviewController('/extension', () => task.loader);
  const session = await controller.open(uri()); expect(session).toBeDefined(); if (session === undefined) { return; }
  expect(task.loader.preview).toHaveBeenCalledWith('/source.csv', {}, expect.any(AbortSignal));
  view.receive({ type: 'csvPreviewReady', contextId: session.contextId });
  expect(view.webview.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'loading' }));
  view.receive({ type: 'csvPreviewCancel', contextId: '2'.repeat(32) });
  task.resolve(result); await session.finished;
  expect(session.state.phase).toBe('ready');
  view.receive({ type: 'csvPreviewReady', contextId: session.contextId });
  expect(view.webview.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready', preview: result }));
  view.receive({ type: 'csvPreviewStatus', contextId: session.contextId, renderedRows: 1, renderedColumns: 1 });
  expect(session.firstRowsMs).toBeGreaterThanOrEqual(0);
  view.dispose(); await session.closed; expect(controller.sessions(uri())).toEqual([]); controller.dispose();
});

test('FR-004: Given cancellation followed by late success, When the worker completes, Then the cancelled state cannot be revived', async () => {
  const view = panel(); const task = deferred();
  // Model a late worker response that ignores its signal; session guarding
  // must still reject revival independently of loader-level termination.
  task.loader.preview.mockImplementation(() => new Promise<PreviewResult>((accept) => { task.resolve = accept; }));
  mocks.panel.mockReturnValue(view); const controller = new CsvPreviewController('/extension', () => task.loader);
  const session = await controller.open(uri()); if (session === undefined) { throw new Error('No preview session'); }
  view.receive({ type: 'csvPreviewCancel', contextId: session.contextId });
  task.resolve(result); await session.finished;
  expect(session.state.phase).toBe('cancelled');
  expect(view.webview.postMessage.mock.calls.some(([value]) => (value as { phase: string }).phase === 'ready')).toBe(false);
  view.dispose(); await session.closed; controller.dispose();
});

test('FR-004: Given two views of one file, When one closes during reading, Then only its worker is cancelled and final closure waits for cleanup', async () => {
  const views = [panel(), panel()]; const tasks = [deferred(), deferred()]; let next = 0;
  mocks.panel.mockReturnValueOnce(views[0]).mockReturnValueOnce(views[1]);
  const controller = new CsvPreviewController('/extension', () => { const task = tasks[next++]; if (task === undefined) { throw new Error('No task'); } return task.loader; });
  const first = await controller.open(uri()); const second = await controller.open(uri());
  if (first === undefined || second === undefined) { throw new Error('No session'); }
  views[0]?.dispose(); await first.closed;
  expect(first.state.phase).toBe('cancelled'); expect(second.state.phase).toBe('loading');
  expect(controller.sessions(uri())).toEqual([second]);
  tasks[1]?.resolve(result); await second.finished; expect(second.state.phase).toBe('ready');
  controller.dispose(); await second.closed;
});

test('FR-004: Given failed loading or unsupported remote input, When opened, Then actionable errors are shown and no remote worker starts', async () => {
  const view = panel(); const task = deferred(); mocks.panel.mockReturnValue(view);
  const controller = new CsvPreviewController('/extension', () => task.loader);
  expect(await controller.open(uri('vscode-remote'))).toBeUndefined(); expect(task.loader.preview).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/local/i));
  const session = await controller.open(uri()); if (session === undefined) { throw new Error('No session'); }
  task.reject(new Error('File missing. Reopen.')); await session.finished;
  expect(session.state).toMatchObject({ phase: 'error', message: 'File missing. Reopen.' });
  controller.dispose(); await session.closed;
});

test('NFR-004: Given panel creation cost, When first rows render, Then command timing includes that cost', async () => {
  let milliseconds = 100;
  const time = vi.spyOn(performance, 'now').mockImplementation(() => milliseconds);
  const view = panel(); const task = deferred();
  mocks.panel.mockImplementation(() => { milliseconds = 400; return view; });
  const controller = new CsvPreviewController('/extension', () => task.loader);
  try {
    const session = await controller.open(uri()); if (session === undefined) { throw new Error('No preview'); }
    task.resolve(result); await session.finished; milliseconds = 1000;
    view.receive({ type: 'csvPreviewStatus', contextId: session.contextId, renderedRows: 1, renderedColumns: 1 });
    expect(session.firstRowsMs).toBe(900);
    controller.dispose(); await session.closed;
  } finally { controller.dispose(); time.mockRestore(); }
});

test('NFR-009: Given a new panel with empty initial HTML, When scripts are configured, Then no content-options update renders the empty document without CSP', async () => {
  const view = panel(); const task = deferred(); const optionUpdates: string[] = [];
  Object.defineProperty(view.webview, 'options', { get: () => ({}), set: () => { optionUpdates.push(view.webview.html); } });
  mocks.panel.mockReturnValue(view); const controller = new CsvPreviewController('/extension', () => task.loader);
  const session = await controller.open(uri()); if (session === undefined) { throw new Error('No preview session'); }
  try {
    task.resolve(result); await session.finished;
    // VS Code's contentOptions setter sends current HTML, including an empty
    // initial document. Configure scripts/roots in createWebviewPanel instead.
    expect(optionUpdates).toEqual([]);
    expect(mocks.panel.mock.calls[0]?.slice(0, 3)).toEqual(['lite-voyager.csvPreview', 'CSV preview: source.csv', -1]);
    // Inspect the same typed public API options exercised by the real host.
    const options = mocks.panel.mock.calls[0]?.[3] as vscode.WebviewPanelOptions & vscode.WebviewOptions;
    expect(options.enableScripts).toBe(true); expect(options.retainContextWhenHidden).toBe(true);
    expect(options.localResourceRoots).toHaveLength(1);
    expect(options.localResourceRoots?.[0]?.fsPath).toMatch(/[\\/]extension[\\/]dist$/u);
    expect(view.webview.html).toContain('Content-Security-Policy');
  } finally { controller.dispose(); await session.closed; }
});

test('FR-004: Given an initializing webview transport, When opening a preview, Then the command waits for readiness before starting its worker or returning a closable session', async () => {
  const view = panel(); const task = deferred();
  let ready: (value: boolean) => void = () => {};
  const transport = new Promise<boolean>((accept) => { ready = accept; });
  view.webview.postMessage.mockImplementation(() => transport);
  mocks.panel.mockReturnValue(view); const controller = new CsvPreviewController('/extension', () => task.loader);
  let returned = false; const opening = controller.open(uri()).then((session) => { returned = true; return session; });
  await new Promise<void>((accept) => { setImmediate(accept); });
  expect(task.loader.preview).not.toHaveBeenCalled(); expect(returned).toBe(false);
  ready(true);
  const session = await opening; if (session === undefined) { throw new Error('No preview'); }
  expect(task.loader.preview).toHaveBeenCalledOnce();
  await session.cancel(); expect(session.state.phase).toBe('cancelled');
  view.dispose(); await session.closed; controller.dispose();
});

test('FR-004: Given failed webview transport, When opening, Then an actionable error is shown and no reader or panel remains', async () => {
  const view = panel(); const task = deferred(); view.webview.postMessage.mockResolvedValue(false); mocks.panel.mockReturnValue(view);
  const controller = new CsvPreviewController('/extension', () => task.loader);
  expect(await controller.open(uri())).toBeUndefined();
  expect(task.loader.preview).not.toHaveBeenCalled(); expect(controller.sessions(uri())).toEqual([]);
  expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/frame.*ready.*Reopen/iu)); controller.dispose();
});

test.each(['remote', 'construction', 'transport'] as const)('FR-004: Given %s failure and an undismissed error notification, When opening, Then the command settles after cleanup without waiting for dismissal', async (failure) => {
  const view = panel(); const task = deferred(); mocks.panel.mockReturnValue(view);
  if (failure === 'transport') { view.webview.postMessage.mockResolvedValue(false); }
  const controller = new CsvPreviewController('/extension', () => {
    if (failure === 'construction') { throw new Error('Loader unavailable'); } return task.loader;
  });
  let dismiss: () => void = () => {};
  mocks.error.mockImplementation(() => new Promise<undefined>((accept) => { dismiss = () => { accept(undefined); }; }));
  let settled = false;
  const opening = controller.open(uri(failure === 'remote' ? 'vscode-remote' : 'file')).then((session) => { settled = true; return session; });
  try {
    await new Promise<void>((accept) => { setImmediate(accept); });
    expect(mocks.error).toHaveBeenCalledOnce(); expect(settled).toBe(true);
    expect(await opening).toBeUndefined(); expect(controller.sessions(uri())).toEqual([]);
    expect(task.loader.preview).not.toHaveBeenCalled();
  } finally { dismiss(); await opening; controller.dispose(); }
});

test('FR-004: Given closure before transport initializes, When disposing the panel, Then opening settles without a worker, timeout or late revival', async () => {
  const view = panel(); const task = deferred(); view.webview.postMessage.mockImplementation(() => new Promise<boolean>(() => {}));
  mocks.panel.mockReturnValue(view); const controller = new CsvPreviewController('/extension', () => task.loader);
  const opening = controller.open(uri()); const session = controller.sessions(uri())[0];
  if (session === undefined) { throw new Error('No initializing session'); }
  view.dispose(); expect(await opening).toBeUndefined(); await session.closed;
  expect(task.loader.preview).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled();
  expect(session.state.phase).toBe('cancelled'); expect(controller.sessions(uri())).toEqual([]); controller.dispose();
});
