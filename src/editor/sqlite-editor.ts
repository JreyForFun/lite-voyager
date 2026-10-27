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
import { open, readFile, rename, rm, stat } from 'node:fs/promises';
import { StagedEdits } from '../staging/staged-edits';
import { MAX_STAGED_BYTES, type EditOperation } from '../staging/edit-types';
import { isEditingRequest, type EditingRequest, type EditingState } from '../protocol';
import type { Engine } from '../engine/engine';

export const SQLITE_EDITOR_VIEW_TYPE = 'lite-voyager.sqlite';

export class SqliteDocument implements vscode.CustomDocument {
  readonly edits: StagedEdits;
  editingEngine: Engine | undefined;
  savingEngine: Engine | undefined;
  cancelSave: (() => Promise<void>) | undefined;
  restore: Promise<void> | undefined;
  saveGeneration = 0;
  editingState: EditingState = { type: 'editingState', revision: 0, writeMode: false, dirty: false, count: 0, busy: false, message: 'Read-only. Enable write mode to stage changes.' };
  reportEdits(message: string, advance = true, busy = this.edits.isBusy || this.savingEngine !== undefined): void {
    this.editingState = { type: 'editingState', revision: this.editingState.revision + (advance ? 1 : 0),
      writeMode: this.edits.writeMode, dirty: this.edits.dirty, count: this.edits.operations.length, busy, message: message.slice(0, 4096) };
    for (const panel of this.records.keys()) { void panel.webview.postMessage(this.editingState); }
  }
  panel: vscode.WebviewPanel | undefined;
  browserStatus: BrowserStatus | undefined;
  private browserRevision = 0;
  private readonly browserListeners = new Set<(status: BrowserStatus) => void>();
  private disposed = false;
  private readonly cleanup = new Set<() => void>();
  private readonly records = new Map<vscode.WebviewPanel, { session: SqliteSession; status?: BrowserStatus }>();
  private claimed = false;
  constructor(readonly uri: vscode.Uri, private readonly initialSession: SqliteSession, private readonly remove: () => void, readonly path?: string) {
    this.edits = new StagedEdits({ edit: (command) => {
      const engine = this.savingEngine ?? this.session.engine;
      if (engine.edit === undefined) { return Promise.reject(new Error('This document does not support editing.')); }
      this.editingEngine = engine;
      return engine.edit(command).finally(() => { if (this.editingEngine === engine) { this.editingEngine = undefined; } });
    } });
  }
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

/** Binary custom documents enter the save pipeline only through staged edits. */
export class SqliteEditorProvider implements vscode.CustomEditorProvider<SqliteDocument>, vscode.Disposable {
  private readonly documents = new Map<string, SqliteDocument>();
  private readonly editListeners = new Set<(event: vscode.CustomDocumentEditEvent<SqliteDocument>) => void>();
  private readonly explicitSaves = new Set<SqliteDocument>();
  readonly onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentEditEvent<SqliteDocument>> = (listener, thisArgs, disposables) => {
    const callback = (event: vscode.CustomDocumentEditEvent<SqliteDocument>): void => { listener.call(thisArgs, event); };
    this.editListeners.add(callback); const disposable = { dispose: () => { this.editListeners.delete(callback); } };
    disposables?.push(disposable); return disposable;
  };
  constructor(private readonly extensionPath: string, private readonly output?: vscode.OutputChannel) {}

  private createSession(path: string | undefined): SqliteSession {
    const session = new SqliteSession(path, new EngineClient({ directory: join(this.extensionPath, 'dist') }));
    logLifecycle(this.output, 'sqlite', { get state() { return session.state; }, closed: session.closed, subscribe: (listener) => session.subscribe(listener) });
    return session;
  }

  getDocument(uri: vscode.Uri): SqliteDocument | undefined { return this.documents.get(uri.toString()); }

  openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): SqliteDocument {
    const key = uri.toString();
    const path = uri.scheme === 'file' && openContext.untitledDocumentData === undefined ? uri.fsPath : undefined;
    const session = this.createSession(path);
    const document = new SqliteDocument(uri, session, () => { this.documents.delete(key); }, path);
    this.documents.set(key, document);
    if (openContext.backupId !== undefined) {
      const backup = openContext.backupId;
      document.restore = (async () => {
        if ((await stat(backup)).size > MAX_STAGED_BYTES + 65536) { throw new Error('The edit backup exceeds the staging limit. Preserve it for recovery.'); }
        document.edits.restore(await readFile(backup, 'utf8'));
      })();
      // Resolution awaits this same failure and leaves the backup intact.
      void document.restore.catch(() => {});
    }
    if (token.isCancellationRequested) { void session.cancel(); }
    return document;
  }

  async resolveCustomEditor(document: SqliteDocument, panel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
    if (document.restore !== undefined) { await document.restore; }
    const session = document.attach(panel, () => this.createSession(document.path));
    session.browser.setEdits(document.edits);
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
    let editContext: string | undefined; let editId = 0;
    const messages = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (disposed || session.state.phase !== 'opened') { return; }
      if (isEditingRequest(message)) {
        if (message.action === 'ready' && message.contextId !== editContext) { editContext = message.contextId; editId = 0; }
        if (message.contextId !== editContext || message.requestId <= editId) { return; }
        editId = message.requestId;
        void this.handleEditing(document, message).catch((error: unknown) => {
          document.reportEdits(error instanceof Error ? error.message : 'Editing failed. Pending changes were preserved.');
        });
      } else if (isBrowserStatus(message)) {
        if (message.contextId !== undefined) { cells.activate(message.contextId); }
        document.reportBrowserStatus(message, panel);
      }
      else if (isCellRequest(message)) { cells.handle(message); }
      else if (isBrowserRequest(message)) {
        if (document.edits.isBusy) { void panel.webview.postMessage({ type: 'browserError', requestId: message.requestId, message: 'Wait for the editing operation to finish. Pending changes are preserved.' }); return; }
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
    if (document.restore !== undefined) {
      document.restore = undefined;
      this.editEvent(document, [], document.edits.operations);
      document.reportEdits('Recovered staged edits. Source is unchanged; review them before explicitly saving.');
    }
  }

  private editEvent(document: SqliteDocument, before: readonly EditOperation[], after: readonly EditOperation[]): void {
    const generation = document.saveGeneration;
    const restore = (operations: readonly EditOperation[]): void => {
      if (document.savingEngine !== undefined) { throw new Error('Wait for the current SQLite save to finish.'); }
      if (generation !== document.saveGeneration) { throw new Error('Saved operations cannot be undone. Undo applies to pending edits only.'); }
      document.edits.replace(operations); document.reportEdits(`${String(operations.length)} pending operations. Source unchanged until Save.`);
    };
    for (const listener of this.editListeners) { listener({ document, label: 'Stage SQLite changes', undo: () => { restore(before); }, redo: () => { restore(after); } }); }
  }

  async handleEditing(document: SqliteDocument, request: EditingRequest): Promise<void> {
    if (!isEditingRequest(request)) { return; }
    if (request.action === 'ready') { document.reportEdits(document.editingState.message, false); return; }
    if (document.savingEngine !== undefined && request.action !== 'cancel') { throw new Error('Wait for the current SQLite save to finish.'); }
    if (request.action === 'mode') {
      if (request.on && vscode.workspace.getConfiguration('files', document.uri).get<string>('autoSave', 'off') !== 'off') {
        throw new Error('Turn off files.autoSave before enabling SQLite write mode. VS Code does not create normal custom-document backups while auto-save is enabled.');
      }
      document.edits.setWriteMode(request.on); document.reportEdits(`${request.on ? 'Write mode' : 'Read-only'} · ${String(document.edits.operations.length)} pending operations. Source unchanged until Save.`); return;
    }
    if (request.action === 'cancel') {
      if (document.cancelSave !== undefined) { await document.cancelSave(); }
      else { await document.editingEngine?.cancel(); }
      document.reportEdits('Editing operation interrupted. SQLite Save is atomic but may already have committed; inspect saved data before retrying. Pending work is preserved.'); return;
    }
    if (request.action === 'save' || request.action === 'revert') {
      if (document.edits.isBusy) { throw new Error('Wait for the current editing operation to finish.'); }
      if (request.action === 'save') {
        this.explicitSaves.add(document);
        try { await vscode.commands.executeCommand('workbench.action.files.save', document.uri); }
        finally { this.explicitSaves.delete(document); }
      } else { await vscode.commands.executeCommand('workbench.action.files.revert', document.uri); }
      return;
    }
    const before = document.edits.operations;
    const operation = request.action === 'stage' ? document.edits.stage(request.target) : document.edits.stageSql(request.sql);
    document.reportEdits('Preparing staged change in the worker. Source is unchanged.', false, true);
    try {
      await operation; this.editEvent(document, before, document.edits.operations);
      document.reportEdits(`${String(document.edits.operations.length)} pending operations · not saved. Browse highlights staged cells; SQL reads saved data until Save.`);
    } catch (error: unknown) {
      document.reportEdits(error instanceof Error ? error.message : 'The edit was refused. Source is unchanged.'); throw error;
    }
  }

  async saveCustomDocument(document: SqliteDocument, cancellation: vscode.CancellationToken): Promise<void> {
    if (cancellation.isCancellationRequested) { throw new Error('Save cancelled. Pending changes were preserved.'); }
    if (!document.edits.dirty) { return; }
    if (!this.explicitSaves.has(document) && vscode.workspace.getConfiguration('files', document.uri).get<string>('autoSave', 'off') !== 'off') {
      throw new Error('Automatic saves cannot modify SQLite sources. Use the explicit Save changes button, or turn off auto-save before using File Save.');
    }
    const savingSession = document.session;
    try { await this.runSave(document, cancellation); document.saveGeneration++; }
    catch (error: unknown) { document.reportEdits(error instanceof Error ? error.message : 'Save failed. Pending changes were preserved.'); throw error; }
    if (savingSession.state.opened?.engine !== 'node:sqlite') {
      for (const record of document.views.values()) {
        if (record.session !== savingSession) {
          try { await record.session.engine.cancel(); }
          catch { document.reportEdits('Changes saved. A secondary view could not refresh; close and reopen that view.'); }
        }
      }
    }
    document.reportEdits('Saved all pending changes atomically.');
  }
  async saveCustomDocumentAs(document: SqliteDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
    if (cancellation.isCancellationRequested) { throw new Error('Save As cancelled.'); }
    if (destination.scheme !== 'file') { throw new Error('Save As requires a local SQLite file.'); }
    try {
      await this.runSave(document, cancellation, destination.fsPath);
      document.reportEdits('Saved an atomic SQLite copy. The original source and its pending edits were retained.');
    } catch (error: unknown) { document.reportEdits(error instanceof Error ? error.message : 'Save As failed. Pending changes were preserved.'); throw error; }
  }
  private async runSave(document: SqliteDocument, token: vscode.CancellationToken, destination?: string): Promise<void> {
    if (document.savingEngine !== undefined) { throw new Error('Wait for the current SQLite save to finish.'); }
    const session = document.session; document.savingEngine = session.engine;
    const resumes: (() => Promise<void>)[] = [];
    let cancelled = false;
    let recovery: Promise<void> | undefined;
    const cancel = (): Promise<void> => {
      cancelled = true;
      const engine = document.editingEngine;
      if (engine !== undefined && recovery === undefined) {
        recovery = engine.cancel();
        // Observe immediately; final settlement still awaits confirmed recovery.
        void recovery.catch(() => {});
      }
      return recovery ?? Promise.resolve();
    };
    document.cancelSave = cancel;
    const listener = token.onCancellationRequested(() => { void cancel(); });
    try {
      if (cancelled || token.isCancellationRequested) { throw new Error('Save cancelled before writing. Pending edits were preserved.'); }
      if (destination === undefined && session.state.opened?.engine === 'node:sqlite') {
        document.reportEdits('Pausing this document’s secondary readers for atomic Save.', false, true);
        for (const record of document.views.values()) {
          if (record.session !== session && record.session.engine.suspendReads !== undefined) { resumes.push(await record.session.engine.suspendReads()); }
        }
      }
      if (cancelled || token.isCancellationRequested) { throw new Error('Save cancelled before writing. Pending edits were preserved.'); }
      const operation = document.edits.save(destination);
      document.reportEdits(destination === undefined
        ? 'Saving all pending changes atomically. Cancelling after commit cannot undo a completed save.'
        : 'Saving an atomic SQLite copy. Cancelling after publication cannot remove a completed copy.', false, true);
      await operation;
    } finally {
      listener.dispose();
      try { await recovery; }
      catch { document.reportEdits('Cancellation could not reopen the reader. Inspect the save outcome, then close and reopen the editor.'); }
      for (const resume of resumes) {
        try { await resume(); }
        catch { document.reportEdits('A secondary reader could not reopen. Close and reopen that view.'); }
      }
      document.savingEngine = undefined; document.cancelSave = undefined;
    }
  }
  async revertCustomDocument(document: SqliteDocument, cancellation: vscode.CancellationToken): Promise<void> {
    if (document.savingEngine !== undefined) { throw new Error('Wait for the current SQLite save to finish.'); }
    if (cancellation.isCancellationRequested) { throw new Error('Revert cancelled.'); }
    document.edits.discard(); document.saveGeneration++;
    await Promise.all([...document.views.values()].map(async (record) => { await record.session.engine.cancel(); }));
    document.reportEdits('Reverted all pending edits. The source was not modified; write mode is off.');
  }
  async backupCustomDocument(document: SqliteDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    if (cancellation.isCancellationRequested) { throw new Error('Backup cancelled.'); }
    const text = document.edits.backup(); const temporary = `${context.destination.fsPath}.${randomBytes(16).toString('hex')}.tmp`;
    try {
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(text, 'utf8'); await file.sync(); } finally { await file.close(); }
      if (cancellation.isCancellationRequested) { throw new Error('Backup cancelled before publication. The previous backup was preserved.'); }
      await rename(temporary, context.destination.fsPath);
    } finally { await rm(temporary, { force: true }); }
    return { id: context.destination.fsPath, delete: () => { void rm(context.destination.fsPath, { force: true }).catch(() => { void vscode.window.showErrorMessage('The staged-edit backup could not be removed. Check storage permissions.'); }); } };
  }

  dispose(): void {
    for (const document of this.documents.values()) { document.dispose(); }
    this.documents.clear();
    this.editListeners.clear();
  }
}
