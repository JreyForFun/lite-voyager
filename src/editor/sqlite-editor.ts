import { basename, join } from 'node:path';
import * as vscode from 'vscode';
import { EngineClient } from '../engine/engine-client';
import { fallbackPrompt } from '../fallback-ui';
import { sqliteEditorHtml } from './sqlite-editor-ui';
import { SqliteSession } from './sqlite-session';

export const SQLITE_EDITOR_VIEW_TYPE = 'lite-voyager.sqlite';

export class SqliteDocument implements vscode.CustomDocument {
  panel: vscode.WebviewPanel | undefined;
  private disposed = false;
  constructor(readonly uri: vscode.Uri, readonly session: SqliteSession, private readonly remove: () => void) {}

  dispose(): void {
    if (this.disposed) { return; }
    this.disposed = true;
    this.remove();
    void this.session.close();
  }
}

/** Binary documents never become TextDocuments or enter the save pipeline. */
export class SqliteEditorProvider implements vscode.CustomReadonlyEditorProvider<SqliteDocument>, vscode.Disposable {
  private readonly documents = new Map<string, SqliteDocument>();
  constructor(private readonly extensionPath: string) {}

  getDocument(uri: vscode.Uri): SqliteDocument | undefined { return this.documents.get(uri.toString()); }

  openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): SqliteDocument {
    const key = uri.toString();
    const path = uri.scheme === 'file' && openContext.backupId === undefined && openContext.untitledDocumentData === undefined ? uri.fsPath : undefined;
    const session = new SqliteSession(path, new EngineClient({ directory: join(this.extensionPath, 'dist') }));
    const document = new SqliteDocument(uri, session, () => { this.documents.delete(key); });
    this.documents.set(key, document);
    if (token.isCancellationRequested) { void session.cancel(); }
    return document;
  }

  async resolveCustomEditor(document: SqliteDocument, panel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
    document.panel = panel;
    panel.webview.options = { enableScripts: false, localResourceRoots: [] };
    let disposed = false;
    const render = (): void => {
      if (!disposed) { panel.webview.html = sqliteEditorHtml(basename(document.uri.fsPath) || document.uri.toString(), document.session.state); }
    };
    const unsubscribe = document.session.subscribe(render);
    const cancellation = token.onCancellationRequested(() => { void document.session.cancel(); });
    const disposal = panel.onDidDispose(() => {
      disposed = true;
      document.panel = undefined;
      unsubscribe();
      cancellation.dispose();
      disposal.dispose();
      document.dispose();
    });
    render();
    if (token.isCancellationRequested) { await document.session.cancel(); }
    try {
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Opening SQLite', cancellable: true }, async (_progress, progressToken) => {
        const listener = progressToken.onCancellationRequested(() => { void document.session.cancel(); });
        try {
          if (progressToken.isCancellationRequested) { await document.session.cancel(); }
          await document.session.start(async (mode) => {
            if (disposed || token.isCancellationRequested || progressToken.isCancellationRequested) { return false; }
            const proceed: vscode.MessageItem = { title: 'Proceed' };
            const cancel: vscode.MessageItem = { title: 'Cancel', isCloseAffordance: true };
            const choice = await vscode.window.showWarningMessage(fallbackPrompt(mode), { modal: true }, proceed, cancel);
            return choice === proceed && !disposed && !token.isCancellationRequested && !progressToken.isCancellationRequested;
          });
        } finally { listener.dispose(); }
      });
    } finally { cancellation.dispose(); }
  }

  dispose(): void {
    for (const document of this.documents.values()) { document.dispose(); }
    this.documents.clear();
  }
}
