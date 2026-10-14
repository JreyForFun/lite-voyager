import { randomBytes } from 'node:crypto';
import { basename, join } from 'node:path';
import * as vscode from 'vscode';
import { CsvPreviewLoader } from '../loaders/csv-loader';
import type { PreviewLoader } from '../loaders/file-loader';
import { isCsvPreviewRequest, isCsvPreviewStatus, type CsvPreviewResult, type CsvPreviewState, type CsvPreviewStatus } from '../protocol';
import { csvPreviewHtml } from './csv-preview-ui';

export class CsvPreviewSession {
  readonly contextId = randomBytes(16).toString('hex');
  readonly finished: Promise<void>;
  readonly initialized: Promise<boolean>;
  readonly closed: Promise<void>;
  firstRowsMs: number | undefined;
  status: CsvPreviewStatus | undefined;
  private readonly cancellation = new AbortController();
  private readonly listeners = new Set<(status: CsvPreviewStatus) => void>();
  private readonly subscriptions: vscode.Disposable[] = [];
  private disposed = false;
  private closeComplete: () => void = () => {};
  private finishInitialization: (ready: boolean) => void = () => {};
  private current: CsvPreviewState;
  get state(): CsvPreviewState { return this.current; }
  constructor(readonly uri: vscode.Uri, readonly panel: vscode.WebviewPanel, directory: string, loader: PreviewLoader<CsvPreviewResult>, private readonly remove: () => void, private readonly started: number) {
    this.closed = new Promise<void>((accept) => { this.closeComplete = accept; });
    this.current = { type: 'csvPreviewState', contextId: this.contextId, phase: 'loading', message: 'Reading the first records…' };
    panel.webview.html = csvPreviewHtml(basename(uri.fsPath), this.contextId, {
      scriptUri: panel.webview.asWebviewUri(vscode.Uri.file(join(directory, 'csv-preview.js'))).toString(),
      styleUri: panel.webview.asWebviewUri(vscode.Uri.file(join(directory, 'csv-preview.css'))).toString(),
      nonce: randomBytes(16).toString('hex'), cspSource: panel.webview.cspSource,
    });
    this.subscriptions.push(panel.webview.onDidReceiveMessage((value: unknown) => { this.receive(value); }),
      panel.onDidDispose(() => { this.dispose(); }));
    this.initialized = this.initializeTransport();
    this.finished = this.load(loader);
  }
  private initializeTransport(): Promise<boolean> {
    return new Promise<boolean>((accept) => {
      let settled = false;
      const finish = (ready: boolean): void => {
        if (settled) { return; } settled = true; clearTimeout(timer); this.finishInitialization = () => {}; accept(ready);
      };
      const timer = setTimeout(() => { finish(false); }, 10000);
      this.finishInitialization = finish;
      // The platform queues this until its outer frame is ready. This is not
      // a DOM/paint claim; actual grid rendering has its separate status report.
      void this.panel.webview.postMessage(this.current).then(finish, () => { finish(false); });
    });
  }
  onStatus(listener: (status: CsvPreviewStatus) => void): () => void {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  private async load(loader: PreviewLoader<CsvPreviewResult>): Promise<void> {
    try {
      const ready = await this.initialized;
      if (this.disposed || this.cancellation.signal.aborted) { return; }
      if (!ready) { throw new Error('The CSV preview frame did not become ready. Reopen the file to try again.'); }
      const preview = await loader.preview(this.uri.fsPath, {}, this.cancellation.signal);
      if (!this.disposed && !this.cancellation.signal.aborted) {
        this.current = { type: 'csvPreviewState', contextId: this.contextId, phase: 'ready', preview,
          message: `${String(preview.rows.length)} preview rows · ${String(preview.columns.length)} columns. ${preview.notice} Full import and SQL are not available yet.` };
        this.send();
      }
    } catch (error: unknown) {
      if (!this.disposed && !this.cancellation.signal.aborted) {
        this.current = { type: 'csvPreviewState', contextId: this.contextId, phase: 'error',
          message: error instanceof Error ? error.message.slice(0, 4096) : 'Unable to preview this file. Reopen a regular UTF-8 CSV or TSV file.' };
        this.send();
      }
    }
  }
  private receive(value: unknown): void {
    if (this.disposed) { return; }
    if (isCsvPreviewRequest(value) && value.contextId === this.contextId) {
      if (value.type === 'csvPreviewReady') { this.send(); }
      else if (this.current.phase === 'loading') { void this.cancel(); }
    } else if (isCsvPreviewStatus(value) && value.contextId === this.contextId && this.current.phase === 'ready'
      && value.renderedRows <= this.current.preview.rows.length && value.renderedColumns <= this.current.preview.columns.length) {
      this.status = value;
      if (value.renderedRows > 0 && value.renderedColumns > 0 && this.firstRowsMs === undefined) { this.firstRowsMs = performance.now() - this.started; }
      for (const listener of this.listeners) { listener(value); }
    }
  }
  private send(): void {
    if (!this.disposed) { void this.panel.webview.postMessage(this.current).then(undefined, () => { /* A closing webview cannot accept delivery. */ }); }
  }
  async cancel(): Promise<void> {
    if (this.current.phase === 'loading') {
      this.cancellation.abort();
      this.current = { type: 'csvPreviewState', contextId: this.contextId, phase: 'cancelled', message: 'Preview cancelled. Reopen the preview to try again; the source file is unchanged.' };
      this.send();
    }
    await this.finished;
  }
  dispose(): void {
    if (this.disposed) { return; }
    void this.cancel(); this.disposed = true; this.cancellation.abort();
    this.finishInitialization(false);
    for (const subscription of this.subscriptions) { subscription.dispose(); }
    this.listeners.clear(); this.remove();
    void this.finished.then(() => { this.closeComplete(); });
  }
}

export class CsvPreviewController implements vscode.Disposable {
  private readonly active = new Set<CsvPreviewSession>();
  private disposed = false;
  constructor(private readonly extensionPath: string, private readonly createLoader: (directory: string) => PreviewLoader<CsvPreviewResult> = (directory) => new CsvPreviewLoader(directory)) {}
  sessions(uri: vscode.Uri): CsvPreviewSession[] { return [...this.active].filter((session) => session.uri.toString() === uri.toString()); }
  async open(input?: vscode.Uri): Promise<CsvPreviewSession | undefined> {
    const uri = input ?? (await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFolders: false, filters: { 'CSV / TSV': ['csv', 'tsv'] }, title: 'Preview CSV / TSV in Lite Voyager' }))?.[0];
    if (uri === undefined || this.disposed) { return undefined; }
    if (uri.scheme !== 'file') { await vscode.window.showErrorMessage('CSV preview supports saved local files only. Save a local CSV or TSV copy and reopen it.'); return undefined; }
    const started = performance.now();
    const directory = join(this.extensionPath, 'dist');
    // Setting options after creation would send the still-empty initial HTML
    // to VS Code's content renderer and trigger its missing-CSP diagnostic.
    const panel = vscode.window.createWebviewPanel('lite-voyager.csvPreview', `CSV preview: ${basename(uri.fsPath)}`, vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [vscode.Uri.file(directory)], retainContextWhenHidden: true });
    let session: CsvPreviewSession;
    try { session = new CsvPreviewSession(uri, panel, directory, this.createLoader(directory), () => { this.active.delete(session); }, started); }
    catch { panel.dispose(); await vscode.window.showErrorMessage('Unable to create the CSV preview. Rebuild the extension and reopen the file.'); return undefined; }
    this.active.add(session);
    if (!await session.initialized) {
      await session.finished;
      const failure = session.state.phase === 'error' ? session.state.message : undefined;
      session.dispose(); panel.dispose(); await session.closed;
      if (failure !== undefined) { await vscode.window.showErrorMessage(failure); }
      return undefined;
    }
    if (this.disposed || session.state.phase === 'cancelled') { return undefined; }
    return session;
  }
  dispose(): void {
    this.disposed = true;
    for (const session of this.active) { session.dispose(); session.panel.dispose(); }
    this.active.clear();
  }
}
