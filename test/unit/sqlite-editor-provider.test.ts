import type * as vscode from 'vscode';
import type { Engine, EngineOpened, OpenOptions } from '../../src/engine/engine';
import { beforeEach, expect, test, vi } from 'vitest';
import { SqliteEditorProvider } from '../../src/editor/sqlite-editor';

type ProgressTask = (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<void>;
const mocks = vi.hoisted(() => ({
  open: vi.fn<Engine['open']>(), close: vi.fn<Engine['close']>(),
  withProgress: vi.fn<(options: vscode.ProgressOptions, task: ProgressTask) => Promise<void>>(),
  prompt: vi.fn<(message: string, options: vscode.MessageOptions, ...items: vscode.MessageItem[]) => Promise<vscode.MessageItem | undefined>>(),
}));
vi.mock('vscode', () => ({
  ProgressLocation: { Notification: 15 },
  window: { withProgress: mocks.withProgress, showWarningMessage: mocks.prompt },
}));
vi.mock('../../src/engine/engine-client', () => ({ EngineClient: vi.fn(function () { return { open: mocks.open, close: mocks.close }; }) }));

const opened: EngineOpened = { engine: 'sql.js', memoryLimited: true, bytes: '200000001', needsConsent: true,
  notice: 'Memory-limited mode', threadId: 1, processId: 123, sqlite: 'test' };
const openContext = { backupId: undefined, untitledDocumentData: undefined };

function cancellation() {
  let requested = false;
  const listeners = new Set<(event: unknown) => void>();
  return {
    token: {
      get isCancellationRequested() { return requested; },
      onCancellationRequested(listener: (event: unknown) => void) { listeners.add(listener); return { dispose: () => { listeners.delete(listener); } }; },
    } satisfies vscode.CancellationToken,
    cancel() { requested = true; for (const listener of listeners) { listener(undefined); } },
  };
}
function uri(scheme = 'file', path = '/fixture.sqlite'): vscode.Uri {
  // Only the Uri fields used by this provider are modeled; real URIs are covered by host integration tests.
  return { scheme, fsPath: path, toString: () => `${scheme}:${path}` } as vscode.Uri;
}
function panel() {
  const callbacks = new Set<() => void>();
  const view = { webview: { html: '', options: {} }, onDidDispose(callback: () => void) {
    callbacks.add(callback); return { dispose: () => { callbacks.delete(callback); } };
  }, dispose() { for (const callback of callbacks) { callback(); } } };
  // Model the provider's WebviewPanel surface; actual binary tabs and webviews are tested in VS Code.
  return view as unknown as vscode.WebviewPanel;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.open.mockResolvedValue(opened);
  mocks.close.mockResolvedValue(undefined);
  mocks.prompt.mockResolvedValue(undefined);
  mocks.withProgress.mockImplementation((_options, task) => task({ report: vi.fn() }, cancellation().token));
});

test.each(['Proceed', 'Cancel', 'Escape', 'dismissed'])('FR-001: Given consent action %s, When fallback requests consent, Then an explicit close action refuses loading unless Proceed is selected', async (choice) => {
  const provider = new SqliteEditorProvider('/extension');
  const view = panel();
  const document = provider.openCustomDocument(uri(), openContext, cancellation().token);
  mocks.prompt.mockImplementation((message, options, ...items) => {
    expect(view.webview.html).toContain('Memory-limited mode');
    expect(message).toContain('200 MB');
    expect(message).toContain('update VS Code');
    expect(options).toEqual({ modal: true });
    expect(items).toEqual([{ title: 'Proceed' }, { title: 'Cancel', isCloseAffordance: true }]);
    const selected = choice === 'Escape' ? items.find((item) => item.isCloseAffordance)
      : items.find((item) => item.title === choice);
    return Promise.resolve(selected);
  });
  mocks.open.mockImplementation(async (_path: string, options?: OpenOptions) => {
    options?.onMode?.(opened);
    if (!await options?.confirmLargeFile?.(opened)) { throw new Error('Memory-limited mode: the file was not loaded because consent was declined.'); }
    return opened;
  });
  await provider.resolveCustomEditor(document, view, cancellation().token);
  expect(document.session.state.phase).toBe(choice === 'Proceed' ? 'opened' : 'error');
  if (choice !== 'Proceed') {
    expect(view.webview.html).toContain('consent was declined');
    expect(view.webview.html).not.toContain('Opened SQLite.');
    await document.session.closed;
    expect(mocks.close).toHaveBeenCalledTimes(1);
  }
  expect(view.webview.options).toEqual({ enableScripts: false, localResourceRoots: [] });
  view.dispose();
  await document.session.closed;
  expect(mocks.close).toHaveBeenCalledTimes(1);
});

test('FR-001: Given a cancellable progress notification, When cancellation arrives during opening, Then the helper closes and the late response cannot revive the editor', async () => {
  const progress = cancellation();
  mocks.withProgress.mockImplementation((options, task) => {
    expect(options.cancellable).toBe(true);
    return task({ report: vi.fn() }, progress.token);
  });
  let complete!: (value: EngineOpened) => void;
  mocks.open.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  const provider = new SqliteEditorProvider('/extension');
  const view = panel();
  const document = provider.openCustomDocument(uri(), openContext, cancellation().token);
  const opening = provider.resolveCustomEditor(document, view, cancellation().token);
  progress.cancel();
  await document.session.closed;
  complete(opened);
  await opening;
  expect(view.webview.html).toContain('Opening was cancelled');
  expect(document.session.state.phase).toBe('cancelled');
  view.dispose();
});

test.each(['untitled', 'vscode-remote'])('FR-001: Given a %s resource, When resolved, Then the local-file limitation is visible and no helper starts', async (scheme) => {
  const provider = new SqliteEditorProvider('/extension');
  const view = panel();
  const document = provider.openCustomDocument(uri(scheme), openContext, cancellation().token);
  await provider.resolveCustomEditor(document, view, cancellation().token);
  expect(view.webview.html).toContain('saved local SQLite file');
  expect(mocks.open).not.toHaveBeenCalled();
  view.dispose();
});

test('FR-001: Given a closed document and its replacement, When VS Code disposes the old document again, Then the replacement remains registered', async () => {
  const provider = new SqliteEditorProvider('/extension');
  const file = uri();
  const old = provider.openCustomDocument(file, openContext, cancellation().token);
  old.dispose();
  await old.session.closed;
  const replacement = provider.openCustomDocument(file, openContext, cancellation().token);
  old.dispose();
  expect(provider.getDocument(file)).toBe(replacement);
  provider.dispose();
  await replacement.session.closed;
});

test('FR-001: Given a modal approval in flight, When its panel closes, Then the helper closes immediately and a late Proceed cannot load or render', async () => {
  let approve!: (choice: vscode.MessageItem | undefined) => void;
  let proceed: vscode.MessageItem | undefined;
  let prompted!: () => void;
  const promptShown = new Promise<void>((resolve) => { prompted = resolve; });
  mocks.prompt.mockImplementation((_message, _options, ...items) => {
    proceed = items.find((item) => item.title === 'Proceed');
    prompted(); return new Promise((resolve) => { approve = resolve; });
  });
  mocks.open.mockImplementation(async (_path: string, options?: OpenOptions) => {
    options?.onMode?.(opened);
    expect(await options?.confirmLargeFile?.(opened)).toBe(false);
    return opened;
  });
  const provider = new SqliteEditorProvider('/extension');
  const view = panel();
  const document = provider.openCustomDocument(uri(), openContext, cancellation().token);
  const opening = provider.resolveCustomEditor(document, view, cancellation().token);
  await promptShown;
  view.dispose();
  await document.session.closed;
  const lastHtml = view.webview.html;
  expect(proceed).toBeDefined();
  approve(proceed);
  await opening;
  expect(view.webview.html).toBe(lastHtml);
  expect(document.session.state.phase).toBe('closed');
  expect(provider.getDocument(uri())).toBeUndefined();
  expect(mocks.close).toHaveBeenCalledTimes(1);
});

test('FR-001: Given an already-cancelled VS Code open token, When the editor resolves, Then cancellation is visible and no helper starts', async () => {
  const cancelled = cancellation();
  cancelled.cancel();
  const provider = new SqliteEditorProvider('/extension');
  const view = panel();
  const document = provider.openCustomDocument(uri(), openContext, cancelled.token);
  await provider.resolveCustomEditor(document, view, cancellation().token);
  expect(mocks.open).not.toHaveBeenCalled();
  expect(view.webview.html).toContain('Opening was cancelled');
  view.dispose();
});

test('FR-001: Given extension shutdown with two open documents, When the provider is disposed, Then every helper closes and documents are removed', async () => {
  const provider = new SqliteEditorProvider('/extension');
  const first = provider.openCustomDocument(uri(), openContext, cancellation().token);
  const second = provider.openCustomDocument(uri('file', '/other.sqlite'), openContext, cancellation().token);
  await provider.resolveCustomEditor(first, panel(), cancellation().token);
  await provider.resolveCustomEditor(second, panel(), cancellation().token);
  provider.dispose();
  await Promise.all([first.session.closed, second.session.closed]);
  expect(mocks.close).toHaveBeenCalledTimes(2);
  expect(provider.getDocument(first.uri)).toBeUndefined();
  expect(provider.getDocument(second.uri)).toBeUndefined();
});
