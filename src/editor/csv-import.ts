import { randomBytes } from 'node:crypto';
import { basename, dirname, extname, join } from 'node:path';
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
import { checkImportSpace, TempStorage, type SpaceApproval } from '../storage/temp-storage';
import { captureOriginalSource, SqliteSaveService, type OriginalSourceSnapshot } from './sqlite-save';
import { isSqliteSaveDom, isSqliteSaveRequest, type SqliteSaveDom, type SqliteSaveState } from '../protocol';

export class CsvImportSession {
  readonly contextId = randomBytes(16).toString('hex');
  readonly initialized: Promise<boolean>;
  readonly closed: Promise<void>;
  state: CsvImportState = { type: 'csvImportState', contextId: this.contextId, phase: 'loading', message: 'Reading preview…', options: {} };
  firstRowsMs: number | undefined;
  browserStatus: BrowserStatus | undefined;
  saveDom: SqliteSaveDom | undefined;
  saveState: SqliteSaveState = { type: 'sqliteSaveState', contextId: this.contextId, phase: 'idle', message: 'Save the entire imported database, including all rows and original BLOB bytes.', bytes: '0', total: '0' };
  private readonly started = performance.now();
  private readonly listeners = new Set<() => void>();
  private readonly subscriptions: vscode.Disposable[] = [];
  private work: Promise<void> = Promise.resolve();
  private cancellation = new AbortController();
  private storage: string | undefined;
  private database: SqliteSession | undefined;
  private cells: CellService | undefined;
  private save: SqliteSaveService | undefined;
  private saving: Promise<void> | undefined;
  private originalSource: OriginalSourceSnapshot | undefined;
  private spaceApproval: SpaceApproval | undefined;
  private disposed = false;
  private closeComplete: () => void = () => {};
  private finishTransport: (ready: boolean) => void = () => {};
  private shutdown: Promise<void> | undefined;
  private sendingState = false;
  private latestState: CsvImportState | undefined;
  get finished(): Promise<void> { return this.work; }
  get browserProcessId(): number | undefined { return this.database?.state.opened?.processId; }
  constructor(readonly uri: vscode.Uri, readonly panel: vscode.WebviewPanel, private readonly directory: string, private readonly storageRoot: string,
    private readonly loader: FileLoader, private readonly remove: () => void,
    private readonly createEngine: (fallback: boolean) => Engine = (fallback) => new EngineClient({ directory, forceFallback: fallback, ...(this.storage === undefined ? {} : { ownerDirectory: this.storage }) }), started?: number) {
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
      if (this.storage !== undefined && !await this.cleanup()) { return; }
      const storage = new TempStorage(this.storageRoot); const root = await storage.initialize();
      const original = await captureOriginalSource(this.uri.fsPath);
      await checkImportSpace(root, original.metadata.size, this.spaceApproval ?? (async ({ available, required }) => {
        const answer = await vscode.window.showWarningMessage(`Low disk space: ${String(available)} bytes available; estimated ${String(required)} bytes needed (three source copies plus 64 MiB). This is an estimate, not reserved space. Import can fail if space runs out.`, { modal: true }, 'Import anyway');
        return answer === 'Import anyway' && !this.disposed && !this.cancellation.signal.aborted;
      }), undefined, this.cancellation.signal);
      if (this.disposed || this.cancellation.signal.aborted) { return; }
      this.storage = await storage.create();
      if (this.disposed || this.cancellation.signal.aborted) { return; }
      const path = join(this.storage, 'table.sqlite'); let fallback = process.env['LITE_VOYAGER_FORCE_FALLBACK'] === '1';
      const tables = await this.loader.import(this.uri.fsPath, { path, engine: fallback ? 'sql.js' : 'node:sqlite', ownerDirectory: this.storage }, this.state.options, (progress) => {
        fallback = progress.engine === 'sql.js';
        this.update({ phase: 'importing', progress,
          message: `${progress.notice ?? ''} ${progress.phase === 'publishing' ? 'Finalizing types' : 'Reading'}: ${progress.bytes} / ${progress.totalBytes} bytes; ${progress.rows} rows. Preview remains browsable.` });
      }, this.cancellation.signal);
      if (this.disposed || this.cancellation.signal.aborted) { return; }
      const current = await captureOriginalSource(this.uri.fsPath);
      if (current.path !== original.path || current.metadata.dev !== original.metadata.dev || current.metadata.ino !== original.metadata.ino
        || current.metadata.size !== original.metadata.size || current.metadata.mtimeNs !== original.metadata.mtimeNs || current.metadata.ctimeNs !== original.metadata.ctimeNs) {
        throw new Error('The source changed while importing. Reopen the source after its writer closes it.');
      }
      this.originalSource = original;
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
      this.configureSqliteSave();
      this.panel.webview.html = sqliteEditorHtml(basename(this.uri.fsPath), { ...database.state, message: this.state.message }, this.assets('sqlite-browser'), this.contextId);
    } catch (error: unknown) {
      await this.cleanup(); this.failure(error);
    } finally { if (this.disposed || this.cancellation.signal.aborted) { await this.cleanup(); } }
  }
  private failure(error: unknown): void { this.update({ phase: 'error', message: `${error instanceof Error ? error.message : 'Import failed.'} Apply options / preview or reopen to retry.`.slice(0, 4096) }); }
  private receive(value: unknown): void {
    if (this.disposed) { return; }
    if (isSqliteSaveDom(value) && value.contextId === this.contextId) {
      this.saveDom = value; for (const listener of this.listeners) { listener(); }
    } else if (isSqliteSaveRequest(value) && value.contextId === this.contextId && this.state.phase === 'opened') {
      if (value.type === 'sqliteSaveReady') { this.send(this.saveState); }
      else if (value.type === 'sqliteSaveCancel') { this.save?.abort(); }
      else { void this.saveAsSqlite(); }
    } else if (isCsvImportRequest(value) && value.contextId === this.contextId) {
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
  private async cleanup(): Promise<boolean> {
    this.cells?.dispose(); this.cells = undefined;
    this.save?.abort(); await this.saving;
    const save = this.save; this.save = undefined;
    try { await save?.settled(); }
    catch (error: unknown) { void vscode.window.showErrorMessage(error instanceof Error ? error.message : 'SQLite save could not finish. Check the output and retry.'); }
    await this.database?.close(); this.database = undefined;
    const storage = this.storage;
    if (storage !== undefined) {
      try { await new TempStorage(this.storageRoot).remove(storage); if (this.storage === storage) { this.storage = undefined; } }
      catch {
        const message = 'Import session storage could not be removed. Check permissions and close programs locking extension storage, then retry or reload VS Code. Owned files were retained for cleanup.';
        this.failure(new Error(message)); void vscode.window.showErrorMessage(message); return false;
      }
    }
    return true;
  }
  dispose(): void {
    if (this.disposed) { return; }
    this.disposed = true; this.cancellation.abort(); this.save?.abort(); this.finishTransport(false); this.remove();
    this.cells?.dispose(); this.listeners.clear(); for (const item of this.subscriptions) { item.dispose(); }
    this.shutdown = (async () => { await this.database?.close(); await this.work; await this.cleanup(); })();
    void this.shutdown.then(this.closeComplete, () => { this.closeComplete(); void vscode.window.showErrorMessage('CSV session storage could not be removed. Close programs locking extension storage, then reload VS Code.'); });
  }
  configureImportSpace(approve: SpaceApproval): void {
    if (this.disposed || this.state.phase !== 'ready') { throw new Error('Review an import preview before configuring its disk-space decision.'); }
    this.spaceApproval = approve;
  }
  configureSqliteSave(choose: () => Promise<string | undefined> = async () => {
    const choice = await vscode.window.showSaveDialog({ title: 'Save imported database as SQLite', saveLabel: 'Save SQLite',
      defaultUri: vscode.Uri.file(join(dirname(this.uri.fsPath), basename(this.uri.fsPath, extname(this.uri.fsPath)) + '.sqlite')), filters: { SQLite: ['sqlite', 'sqlite3', 'db'] } });
    if (choice === undefined || this.disposed) { return undefined; }
    if (choice.scheme !== 'file') { throw new Error('Choose a local SQLite save destination.'); } return choice.fsPath;
  }, confirmReplace: (path: string) => Promise<boolean> = async () => {
    return await vscode.window.showWarningMessage('Replace the existing file with the entire imported SQLite database? Existing contents will be replaced only after the complete copy is ready.', { modal: true }, 'Replace') === 'Replace';
  }): void {
    if (this.storage === undefined || this.originalSource === undefined || this.state.phase !== 'opened' || this.saving !== undefined) { throw new Error('Open an imported database and wait for the current save before configuring Save as SQLite.'); }
    this.save = new SqliteSaveService({ source: join(this.storage, 'table.sqlite'), original: this.uri.fsPath, storageRoot: this.storageRoot,
      workerDirectory: this.directory, choose, confirmReplace, originalSnapshot: this.originalSource });
  }
  saveAsSqlite(): Promise<void> {
    if (this.disposed || this.state.phase !== 'opened' || this.save === undefined) { return Promise.resolve(); }
    if (this.saving !== undefined) { void vscode.window.showErrorMessage('A SQLite save is already running. Wait or cancel it.'); return this.saving; }
    const service = this.save; this.updateSave({ phase: 'choosing', message: 'Choose a local SQLite destination. Cancel save prevents late dialog answers from saving.', bytes: '0', total: '0' });
    const task = (async () => {
      try {
        const result = await service.run((value) => { this.updateSave({ ...value, message: value.phase === 'saving' ? 'Saving complete SQLite database. The atomic save cannot be cancelled.' : `Copying SQLite database: ${value.bytes} / ${value.total} bytes.` }); });
        this.updateSave({ phase: result === undefined ? 'idle' : 'saved', message: result === undefined ? 'Save dismissed. Choose Save as SQLite to try again.' : `Saved complete SQLite database (${result.bytes} bytes). The original source is unchanged.`, ...(result === undefined ? {} : { bytes: result.bytes, total: result.bytes }) });
      } catch (error: unknown) { this.updateSave({ phase: service.isCancelled ? 'cancelled' : 'error', message: error instanceof Error ? error.message : 'SQLite save failed. Check the destination and retry.' }); }
    })();
    this.saving = task;
    void task.then(() => { if (this.saving === task) { this.saving = undefined; } }); return task;
  }
  private updateSave(value: Partial<SqliteSaveState>): void {
    if (this.disposed) { return; }
    this.saveState = { ...this.saveState, ...value, message: (value.message ?? this.saveState.message).slice(0, 4096) }; this.send(this.saveState);
    for (const listener of this.listeners) { listener(); }
  }
}

export class CsvImportController implements vscode.Disposable {
  private readonly active = new Set<CsvImportSession>();
  private disposed = false;
  readonly ready: Promise<void>;
  constructor(private readonly extensionPath: string, private readonly storageRoot: string) {
    this.ready = new TempStorage(storageRoot).cleanupOrphans().catch((error: unknown) => {
      void vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Import storage cleanup failed. Check extension storage permissions and reload VS Code.');
    });
  }
  sessions(uri: vscode.Uri): CsvImportSession[] { return [...this.active].filter((session) => session.uri.toString() === uri.toString()); }
  async open(input?: vscode.Uri): Promise<CsvImportSession | undefined> {
    await this.ready;
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
  async saveActive(): Promise<void> {
    const session = [...this.active].find((item) => item.panel.active && item.state.phase === 'opened');
    if (session === undefined) { void vscode.window.showInformationMessage('Open an imported CSV / TSV database tab before choosing Save as SQLite.'); return; }
    await session.saveAsSqlite();
  }
  dispose(): void { this.disposed = true; for (const session of this.active) { session.panel.dispose(); } this.active.clear(); }
}
