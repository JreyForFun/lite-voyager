import { join } from 'node:path';
import * as vscode from 'vscode';
import { EngineClient } from './engine/engine-client';
import type { EngineMode, EngineOpened } from './engine/engine';
import { engineHtml, fallbackPrompt } from './fallback-ui';

/** Host UI to exercise production fallback UX before the custom editor exists. */
export interface EngineCheckResult { panel: vscode.WebviewPanel; opened: EngineOpened | undefined; closed: Promise<void>; }

export async function openEngineCheck(context: vscode.ExtensionContext, selectedFile?: vscode.Uri): Promise<EngineCheckResult | undefined> {
  const selection = selectedFile === undefined ? await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFolders: false,
    filters: { SQLite: ['db', 'sqlite', 'sqlite3', 'db3'] }, title: 'Choose a SQLite file for the Engine check' }) : [selectedFile];
  const file = selection?.[0];
  if (file === undefined) { return; }
  if (file.scheme !== 'file') { await vscode.window.showErrorMessage('The Engine check needs a local SQLite file.'); return; }
  const panel = vscode.window.createWebviewPanel('lite-voyager.engineCheck', 'Lite Voyager Engine check', vscode.ViewColumn.Active,
    { enableScripts: false, localResourceRoots: [] });
  const engine = new EngineClient({ directory: join(context.extensionPath, 'dist') });
  let mode: EngineMode | undefined;
  let disposed = false;
  let cancelled = false;
  let opened: EngineOpened | undefined;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
  const render = (message: string): void => { if (!disposed) { panel.webview.html = engineHtml(mode, message); } };
  const close = async (): Promise<void> => {
    try { await engine.close(); }
    catch { if (!disposed) { render('The database helper could not be closed. Close this panel and reload VS Code.'); } }
    finally { resolveClosed(); }
  };
  const shutdown = new vscode.Disposable(() => { void close(); });
  context.subscriptions.push(panel, shutdown);
  const disposal = panel.onDidDispose(() => {
    disposed = true;
    void close();
    disposal.dispose();
    shutdown.dispose();
    for (const item of [panel, shutdown]) {
      const index = context.subscriptions.indexOf(item);
      if (index !== -1) { context.subscriptions.splice(index, 1); }
    }
  });
  render('Opening the database in a worker…');
  try {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Opening SQLite', cancellable: true }, async (_progress, token) => {
      let cancellation: Promise<void> | undefined;
      const listener = token.onCancellationRequested(() => { cancelled = true; cancellation = close(); });
      try {
        opened = await engine.open(file.fsPath, {
          onMode: (value) => { mode = value; render('Opening the database in a worker…'); },
          confirmLargeFile: async (value) => {
            if (disposed || token.isCancellationRequested) { return false; }
            const choice = await vscode.window.showWarningMessage(fallbackPrompt(value), { modal: true }, 'Proceed');
            return choice === 'Proceed' && !disposed && !token.isCancellationRequested;
          },
        });
        if (disposed || token.isCancellationRequested) { return; }
        render(`Opened ${file.fsPath}. Engine: ${opened.engine}; SQLite ${opened.sqlite}. Source file is read-only.`);
      } finally { listener.dispose(); await cancellation; }
    });
  } catch (error: unknown) {
    render(cancelled ? 'Opening was cancelled. The file was not modified.'
      : error instanceof Error ? error.message : 'Unable to open the database. Check the file and retry.');
  }
  return { panel, opened, closed };
}
