import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import * as vscode from 'vscode';
import type { Engine } from '../engine/engine';
import { EngineClient } from '../engine/engine-client';
import { CsvLoader } from '../loaders/csv-loader';
import { importOptions, type FileLoader, type LoadOptions } from '../loaders/file-loader';
import { isBrowserRequest, isBrowserStatus, isCellRequest, isCsvImportRequest, isCsvPreviewRequest, isCsvPreviewResult, isCsvPreviewStatus,
  type BrowserStatus, type CsvImportState, type CsvPreviewStatus, type HostToWebviewMessage } from '../protocol';
import { CellService } from './cell-service';
import { csvImportHtml } from './csv-import-ui';
import { SqliteSession } from './sqlite-session';
import { sqliteEditorHtml, type SqliteEditorAssets } from './sqlite-editor-ui';

export class CsvImportSession {
  readonly contextId = randomBytes(16).toString('hex');
  readonly initialized: Promise<boolean>;
  readonly closed: Promise<void>;
  state: CsvImportState = { type: 'csvImportState', contextId: this.contextId, phase: 'loading', message: 'Reading preview…', options: {} };
  firstRowsMs: number | undefined;
  browserStatus: BrowserStatus | undefined;
  private readonly started = performance.now();
  private readonly listeners = new Set<() => void>();
  private readonly subscriptions: vscode.Disposable[] = [];
  private work: Promise<void> = Promise.resolve();
  private cancellation = new AbortController();
  private storage: string | undefined;
  private database: SqliteSession | undefined;
  private cells: CellService | undefined;
  private disposed = false;
  private closeComplete: () => void = () => {};
  private finishTransport: (ready: boolean) => void = () => {};
  private shutdown: Promise<void> | undefined;
  private sendingState = false;
  private latestState: CsvImportState | undefined;
  get finished(): Promise<void> { return this.work; }
  constructor(readonly uri: vscode.Uri, readonly panel: vscode.WebviewPanel, private readonly directory: string, private readonly storageRoot: string,
    private readonly loader: FileLoader, private readonly remove: () => void,
    private readonly createEngine: (fallback: boolean) => Engine = (fallback) => new EngineClient({ directory, forceFallback: fallback }), started?: number) {
    this.started = started ?? this.started;
    this.closed = new Promise((accept) => { this.closeComplete = accept; });
    panel.webview.html = csvImportHtml(basename(uri.fsPath), this.contextId, this.assets('csv-import'));
    this.subscriptions.push(panel.webview.onDidReceiveMessage((value: unknown) => { this.receive(value); }), panel.onDidDispose(() => { this.dispose(); }));
    this.initialized = new Promise<boolean>((accept) => {
      let settled = false;
      const finish = (ready: boolean): void => { if (settled) { return; } settled = true; clearTimeout(timer); accept(ready); };
      const timer = setTimeout(() => { finish(false); }, 10000); this.finishTransport = finish;
      void panel.webview.postMessage(this.state).then(finish, () => { finish(false); });
    });
    const initialized = this.initialized;
    this.work = (async () => {
      if (await initialized && !this.disposed && !this.cancellation.signal.aborted) { await this.readPreview({}); }
      else if (!this.disposed && !this.cancellation.signal.aborted) { this.update({ phase: 'error', message: 'Import frame did not become ready. Reopen.' }); }
    })();
  }
  onStatus(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private assets(name: string): SqliteEditorAssets {
    return { scriptUri: this.panel.webview.asWebviewUri(vscode.Uri.file(join(this.directory, `${name}.js`))).toString(),
      styleUri: this.panel.webview.asWebviewUri(vscode.Uri.file(join(this.directory, `${name}.css`))).toString(),
      nonce: randomBytes(16).toString('hex'), cspSource: this.panel.webview.cspSource };
  }
  private send(message: HostToWebviewMessage): void {
    if (!this.disposed) { void this.panel.webview.postMessage(message).then(undefined, () => {}); }
  }
  private update(value: Partial<CsvImportState>): void {
    if (this.disposed || this.cancellation.signal.aborted) { return; }
    this.state = { ...this.state, ...value }; this.sendState(); for (const listener of this.listeners) { listener(); }
  }
  private sendState(): void {
    if (this.disposed) { return; }
    // The preview page travels only when replaced, never on every progress tick.
    const value: CsvImportState = { ...this.state };
    if (value.phase !== 'ready') { delete value.preview; }
    if (this.sendingState) { this.latestState = value; return; }
    this.sendingState = true;
    const complete = (): void => { this.sendingState = false; const next = this.latestState; this.latestState = undefined; if (next !== undefined && !this.disposed) { this.deliverState(next); } };
    void this.panel.webview.postMessage(value).then(complete, complete);
  }
  private deliverState(value: CsvImportState): void {
    if (this.disposed) { return; }
    this.sendingState = true;
    const complete = (): void => { this.sendingState = false; const next = this.latestState; this.latestState = undefined; if (next !== undefined) { this.deliverState(next); } };
    void this.panel.webview.postMessage(value).then(complete, complete);
  }
  private async readPreview(options: LoadOptions): Promise<void> {
    this.update({ phase: 'loading', options, message: 'Reading preview with selected options…' });
    try {
      const preview = await this.loader.preview(this.uri.fsPath, options, this.cancellation.signal);
      if (!isCsvPreviewResult(preview)) { throw new Error('CSV loader returned an invalid bounded preview. Rebuild and reopen.'); }
      this.update({ phase: 'ready', preview, options: { ...options, delimiter: preview.delimiter },
        message: 'Review delimiter, header and type options, then Import table. Source file remains unchanged.' });
    } catch (error: unknown) { this.failure(error); }
  }
  refresh(options: LoadOptions): Promise<void> {
    if (this.disposed || !['ready', 'error'].includes(this.state.phase)) { return this.work; }
    const clean = importOptions(options); this.work = this.readPreview(clean); return this.work;
  }
  startImport(): Promise<void> {
    if (this.disposed || this.state.phase !== 'ready') { return this.work; }
    this.update({ phase: 'importing', message: 'Starting background import…' });
    this.work = this.importTable(); return this.work;
  }
  private async importTable(): Promise<void> {
    try {
      await mkdir(this.storageRoot, { recursive: true });
      this.storage = await mkdtemp(join(this.storageRoot, 'csv-session-'));
      if (this.disposed || this.cancellation.signal.aborted) { return; }
      const path = join(this.storage, 'table.sqlite'); let fallback = process.env['LITE_VOYAGER_FORCE_FALLBACK'] === '1';
      const tables = await this.loader.import(this.uri.fsPath, { path, engine: fallback ? 'sql.js' : 'node:sqlite' }, this.state.options, (progress) => {
        fallback = progress.engine === 'sql.js';
        this.update({ phase: 'importing', progress,
          message: `${progress.notice ?? ''} ${progress.phase === 'publishing' ? 'Finalizing types' : 'Reading'}: ${progress.bytes} / ${progress.totalBytes} bytes; ${progress.rows} rows. Preview remains browsable.` });
      }, this.cancellation.signal);
      if (this.disposed || this.cancellation.signal.aborted) { return; }
      this.update({ phase: 'opening', message: 'Import complete. Opening read-only SQL browser…' });
      const database = new SqliteSession(path, this.createEngine(fallback)); this.database = database;
      void database.closed.then(() => {
        const state = database.state;
        if (state.phase === 'error' && /^(Export |The export )/u.test(state.message)) { void vscode.window.showErrorMessage(state.message); }
      });
      database.configureExport(async (format) => {
        const destination = await vscode.window.showSaveDialog({ title: `Export imported query as ${format.toUpperCase()}`,
          defaultUri: vscode.Uri.file(join(dirname(this.uri.fsPath), `results.${format}`)), filters: format === 'csv' ? { CSV: ['csv'] } : { JSON: ['json'] }, saveLabel: 'Export' });
        if (destination === undefined || this.disposed) { return undefined; }
        if (destination.scheme !== 'file') { throw new Error('Choose a local export destination.'); } return destination.fsPath;
      });
      await database.start(() => Promise.resolve(false));
      if (this.disposed || this.cancellation.signal.aborted) { return; }
      if (database.state.phase !== 'opened') { throw new Error(database.state.message); }
      this.cells = new CellService(this.directory, (text) => vscode.env.clipboard.writeText(text), (reply) => { this.send(reply); });
      const table = tables[0];
      this.update({ phase: 'opened', message: table === undefined ? 'The file is empty; no table was created. Source file was not modified.'
        : `Imported ${table.rowCount} rows into ${table.name}. ${table.notice ?? 'Source file was not modified.'}` });
      this.panel.webview.html = sqliteEditorHtml(basename(this.uri.fsPath), { ...database.state, message: this.state.message }, this.assets('sqlite-browser'));
    } catch (error: unknown) {
      await this.cleanup(); this.failure(error);
    } finally { if (this.disposed || this.cancellation.signal.aborted) { await this.cleanup(); } }
  }
  private failure(error: unknown): void { this.update({ phase: 'error', message: `${error instanceof Error ? error.message : 'Import failed.'} Apply options / preview or reopen to retry.`.slice(0, 4096) }); }
  private receive(value: unknown): void {
    if (this.disposed) { return; }
    if (isCsvImportRequest(value) && value.contextId === this.contextId) {
      if (value.type === 'csvImportStart') { void this.startImport(); }
      else if (value.type === 'csvImportRefresh') { void this.refresh(value.options); }
      else { void this.cancel(); }
    } else if (isCsvPreviewRequest(value) && value.contextId === this.contextId) {
      if (value.type === 'csvPreviewReady') { this.sendState(); }
      else { void this.cancel(); }
    } else if (isCsvPreviewStatus(value) && value.contextId === this.contextId && this.state.preview !== undefined) {
      this.previewStatus(value);
    } else if (this.database?.state.phase === 'opened') {
      if (isBrowserStatus(value)) { this.browserStatus = value; if (value.contextId !== undefined) { this.cells?.activate(value.contextId); } for (const listener of this.listeners) { listener(); } }
      else if (isCellRequest(value)) { this.cells?.handle(value); }
      else if (isBrowserRequest(value)) { void this.database.browser.handle(value, (reply) => { this.send(reply); }); }
    }
  }
  private previewStatus(value: CsvPreviewStatus): void {
    if (value.renderedRows > 0 && value.renderedColumns > 0 && this.firstRowsMs === undefined) { this.firstRowsMs = performance.now() - this.started; }
    for (const listener of this.listeners) { listener(); }
  }
  async cancel(): Promise<void> {
    if (this.state.phase === 'opened' || this.state.phase === 'cancelled') { return; }
    this.update({ phase: 'cancelled', message: 'Import cancelled. Source unchanged; reopen to retry.' });
    this.cancellation.abort(); this.finishTransport(false);
    await this.database?.close(); await this.work; await this.cleanup();
  }
  private async cleanup(): Promise<void> {
    this.cells?.dispose(); this.cells = undefined;
    await this.database?.close(); this.database = undefined;
    const storage = this.storage;
    if (storage !== undefined) { await rm(storage, { recursive: true, force: true }); if (this.storage === storage) { this.storage = undefined; } }
  }
  dispose(): void {
    if (this.disposed) { return; }
    this.disposed = true; this.cancellation.abort(); this.finishTransport(false); this.remove();
    this.cells?.dispose(); this.listeners.clear(); for (const item of this.subscriptions) { item.dispose(); }
    this.shutdown = (async () => { await this.database?.close(); await this.work; await this.cleanup(); })();
    void this.shutdown.then(this.closeComplete, () => { this.closeComplete(); void vscode.window.showErrorMessage('CSV session storage could not be removed. Close programs locking extension storage, then reload VS Code.'); });
  }
}

export class CsvImportController implements vscode.Disposable {
  private readonly active = new Set<CsvImportSession>();
  private disposed = false;
  constructor(private readonly extensionPath: string, private readonly storageRoot: string) {}
  sessions(uri: vscode.Uri): CsvImportSession[] { return [...this.active].filter((session) => session.uri.toString() === uri.toString()); }
  async open(input?: vscode.Uri): Promise<CsvImportSession | undefined> {
    const uri = input ?? (await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFolders: false, filters: { 'CSV / TSV': ['csv', 'tsv'] }, title: 'Import CSV / TSV in Lite Voyager' }))?.[0];
    if (uri === undefined || this.disposed) { return undefined; }
    if (uri.scheme !== 'file') { void vscode.window.showErrorMessage('Import supports saved local UTF-8 CSV / TSV files only.'); return undefined; }
    const started = performance.now(); const directory = join(this.extensionPath, 'dist');
    let panel: vscode.WebviewPanel | undefined;
    try {
      panel = vscode.window.createWebviewPanel('lite-voyager.csvImport', `CSV import: ${basename(uri.fsPath)}`, vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.file(directory)] });
      const session = new CsvImportSession(uri, panel, directory, this.storageRoot, new CsvLoader(directory), () => { this.active.delete(session); }, undefined, started);
      this.active.add(session);
      if (!await session.initialized || this.disposed) { panel.dispose(); await session.closed; return undefined; }
      return session;
    } catch {
      panel?.dispose(); void vscode.window.showErrorMessage('Unable to open the CSV import tab. Rebuild and reopen a local file.'); return undefined;
    }
  }
  dispose(): void { this.disposed = true; for (const session of this.active) { session.panel.dispose(); } this.active.clear(); }
}
