import { basename, dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { EngineClient } from '../engine/engine-client';
import { fallbackPrompt } from '../fallback-ui';
import { sqliteEditorHtml } from './sqlite-editor-ui';
import { SqliteSession } from './sqlite-session';
import { isBrowserRequest, isBrowserStatus, isCellRequest, type BrowserStatus } from '../protocol';
import { CellService } from './cell-service';
import { writeClipboard } from './clipboard';
import { logLifecycle } from '../diagnostics';

export const SQLITE_EDITOR_VIEW_TYPE = 'lite-voyager.sqlite';

export class SqliteDocument implements vscode.CustomDocument {
  panel: vscode.WebviewPanel | undefined;
  browserStatus: BrowserStatus | undefined;
  private browserRevision = 0;
  private readonly browserListeners = new Set<(status: BrowserStatus) => void>();
  private disposed = false;
  private readonly cleanup = new Set<() => void>();
  private readonly records = new Map<vscode.WebviewPanel, { session: SqliteSession; status?: BrowserStatus }>();
  private claimed = false;
  constructor(readonly uri: vscode.Uri, private readonly initialSession: SqliteSession, private readonly remove: () => void, readonly path?: string) {}
  get session(): SqliteSession { return (this.panel === undefined ? undefined : this.records.get(this.panel)?.session) ?? this.initialSession; }
  get views(): ReadonlyMap<vscode.WebviewPanel, Readonly<{ session: SqliteSession; status?: BrowserStatus }>> { return this.records; }
  attach(panel: vscode.WebviewPanel, create: () => SqliteSession): SqliteSession {
    if (this.disposed) { throw new Error('The SQLite document is closed. Reopen the file.'); }
    const session = this.claimed ? create() : this.initialSession; this.claimed = true;
    this.records.set(panel, { session }); this.activate(panel); return session;
  }
  activate(panel: vscode.WebviewPanel): void {
    if (!this.records.has(panel) || this.disposed) { return; }
    this.panel = panel; this.browserStatus = undefined;
    const status = this.records.get(panel)?.status;
    if (status !== undefined) { this.reportBrowserStatus(status, panel); }
  }
  detach(panel: vscode.WebviewPanel): void {
    const session = this.records.get(panel)?.session; this.records.delete(panel); void session?.close();
    if (this.panel === panel) {
      this.panel = undefined; this.browserStatus = undefined;
      const remaining = this.records.keys().next().value;
      if (remaining !== undefined) { this.activate(remaining); }
    }
    if (this.records.size === 0) { this.dispose(); }
  }

  onBrowserStatus(listener: (status: BrowserStatus) => void): () => void {
    this.browserListeners.add(listener); return () => { this.browserListeners.delete(listener); };
  }
  onDispose(listener: () => void): () => void {
    if (this.disposed) { listener(); return () => {}; }
    this.cleanup.add(listener); return () => { this.cleanup.delete(listener); };
  }
  reportBrowserStatus(status: BrowserStatus, panel = this.panel): void {
    if (this.disposed) { return; }
    if (panel !== undefined) {
      const view = this.records.get(panel); if (view === undefined) { return; }
      view.status = status; if (panel !== this.panel) { return; }
    }
    // A destroyed/recreated webview restarts its local frame counter. Document
    // observers need one continuing sequence across all those contexts.
    const report = { ...status, revision: ++this.browserRevision };
    this.browserStatus = report;
    for (const listener of this.browserListeners) { listener(report); }
  }

  dispose(): void {
    if (this.disposed) { return; }
    this.disposed = true;
    for (const listener of this.cleanup) { listener(); } this.cleanup.clear();
    this.browserListeners.clear(); this.browserStatus = undefined;
    this.remove();
    for (const record of this.records.values()) { void record.session.close(); }
    this.records.clear(); void this.initialSession.close();
  }
}

/** Binary documents never become TextDocuments or enter the save pipeline. */
export class SqliteEditorProvider implements vscode.CustomReadonlyEditorProvider<SqliteDocument>, vscode.Disposable {
  private readonly documents = new Map<string, SqliteDocument>();
  constructor(private readonly extensionPath: string, private readonly output?: vscode.OutputChannel) {}

  private createSession(path: string | undefined): SqliteSession {
    const session = new SqliteSession(path, new EngineClient({ directory: join(this.extensionPath, 'dist') }));
    logLifecycle(this.output, 'sqlite', { get state() { return session.state; }, closed: session.closed, subscribe: (listener) => session.subscribe(listener) });
    return session;
  }

  getDocument(uri: vscode.Uri): SqliteDocument | undefined { return this.documents.get(uri.toString()); }

  openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): SqliteDocument {
    const key = uri.toString();
    const path = uri.scheme === 'file' && openContext.backupId === undefined && openContext.untitledDocumentData === undefined ? uri.fsPath : undefined;
    const session = this.createSession(path);
    const document = new SqliteDocument(uri, session, () => { this.documents.delete(key); }, path);
    this.documents.set(key, document);
    if (token.isCancellationRequested) { void session.cancel(); }
    return document;
  }

  async resolveCustomEditor(document: SqliteDocument, panel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
    const session = document.attach(panel, () => this.createSession(document.path));
    const directory = vscode.Uri.file(join(this.extensionPath, 'dist'));
    panel.webview.options = { enableScripts: true, localResourceRoots: [directory] };
    const assets = {
      scriptUri: panel.webview.asWebviewUri(vscode.Uri.file(join(this.extensionPath, 'dist', 'sqlite-browser.js'))).toString(),
      styleUri: panel.webview.asWebviewUri(vscode.Uri.file(join(this.extensionPath, 'dist', 'sqlite-browser.css'))).toString(),
      nonce: randomBytes(16).toString('hex'), cspSource: panel.webview.cspSource,
    };
    let disposed = false;
    const notify = (): void => {
      void session.closed.then(() => {
        const state = session.state;
        if (state.phase === 'error' && /^(Export |The export )/u.test(state.message)) { void vscode.window.showErrorMessage(state.message); }
      });
    };
    const removeNotification = document.onDispose(notify);
    session.configureExport(async (format) => {
      const destination = await vscode.window.showSaveDialog({
        title: `Export complete query results as ${format.toUpperCase()}`,
        defaultUri: vscode.Uri.file(join(dirname(document.uri.fsPath), `results.${format}`)),
        filters: format === 'csv' ? { CSV: ['csv'] } : { JSON: ['json'] }, saveLabel: 'Export',
      });
      if (destination === undefined || disposed) { return undefined; }
      if (destination.scheme !== 'file') { throw new Error('Choose a local file destination for streamed export.'); }
      return destination.fsPath;
    });
    const cells = new CellService(join(this.extensionPath, 'dist'), (text) => writeClipboard(vscode.env.clipboard, text),
      (reply) => { if (!disposed) { void panel.webview.postMessage(reply); } });
    const removeCellCleanup = document.onDispose(() => { cells.dispose(); });
    let browserRendered = false;
    let openingRendered = false;
    const render = (): void => {
      // Engine recovery can update its mode; do not reset an initialized browser
      // and its monotonic request IDs by replacing the document on each update.
      if (disposed || browserRendered) { return; }
      const state = session.state;
      // Avoid resetting the opening frame for native mode/status updates.
      // Fallback needs its banner before consent; errors/cancellation still render.
      if (openingRendered && state.phase === 'opening' && state.mode?.memoryLimited !== true) { return; }
      panel.webview.html = sqliteEditorHtml(basename(document.uri.fsPath) || document.uri.toString(), state, assets);
      openingRendered = state.phase === 'opening';
      browserRendered = state.phase === 'opened';
    };
    const messages = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (disposed || session.state.phase !== 'opened') { return; }
      if (isBrowserStatus(message)) {
        if (message.contextId !== undefined) { cells.activate(message.contextId); }
        document.reportBrowserStatus(message, panel);
      }
      else if (isCellRequest(message)) { cells.handle(message); }
      else if (isBrowserRequest(message)) {
        void session.browser.handle(message, (reply) => { if (!disposed) { void panel.webview.postMessage(reply); } });
      }
    });
    const unsubscribe = session.subscribe(render);
    const cancellation = token.onCancellationRequested(() => { void session.cancel(); });
    const focus = panel.onDidChangeViewState((event) => { if (event.webviewPanel.active) { document.activate(panel); } });
    const disposal = panel.onDidDispose(() => {
      disposed = true;
      cells.dispose();
      removeCellCleanup();
      removeNotification(); notify();
      unsubscribe();
      messages.dispose();
      cancellation.dispose();
      disposal.dispose();
      focus.dispose(); document.detach(panel);
    });
    render();
    if (token.isCancellationRequested) { await session.cancel(); }
    try {
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Opening SQLite', cancellable: true }, async (_progress, progressToken) => {
        const listener = progressToken.onCancellationRequested(() => { void session.cancel(); });
        try {
          if (progressToken.isCancellationRequested) { await session.cancel(); }
          await session.start(async (mode) => {
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
