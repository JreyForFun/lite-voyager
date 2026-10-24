import type * as vscode from 'vscode';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { CsvImportController } from './csv-import';
import type { SqliteDocument, SqliteEditorProvider } from './sqlite-editor';
import { fileFormat, type TabularFormat } from './file-opening';

async function hasSqliteHeader(path: string): Promise<boolean> {
  try {
    const file = await open(path, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NONBLOCK));
    try {
      if (!(await file.stat()).isFile()) { return false; }
      const header = Buffer.alloc(16); const read = await file.read(header, 0, header.length, 0);
      return read.bytesRead === header.length && header.equals(Buffer.from('SQLite format 3\0'));
    } finally { await file.close(); }
  } catch { return false; } // The selected loader retains its actionable read error.
}

export class TabularDocument implements vscode.CustomDocument {
  readonly panels = new Set<vscode.WebviewPanel>();
  disposed = false;
  constructor(readonly uri: vscode.Uri, readonly format: TabularFormat, private readonly remove: () => void) {}
  dispose(): void {
    if (this.disposed) { return; } this.disposed = true; this.remove();
    for (const panel of this.panels) { panel.dispose(); } this.panels.clear();
  }
}
/** One picker entry preserves SQLite's arbitrary-extension header validation. */
export class TabularEditorProvider implements vscode.CustomReadonlyEditorProvider<TabularDocument | SqliteDocument>, vscode.Disposable {
  private readonly documents = new Set<TabularDocument>();
  private disposed = false;
  constructor(private readonly sqlite: SqliteEditorProvider, private readonly controllers: Readonly<Record<TabularFormat, CsvImportController>>) {}
  async openCustomDocument(uri: vscode.Uri, context: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): Promise<TabularDocument | SqliteDocument> {
    const format = uri.scheme === 'file' ? fileFormat(uri.fsPath) : undefined;
    const sqliteHeader = format !== undefined && await hasSqliteHeader(uri.fsPath);
    if (this.disposed) { throw new Error('Lite Voyager is closing. Reopen the saved local file after reload.'); }
    if (format === undefined || sqliteHeader) { return this.sqlite.openCustomDocument(uri, context, token); }
    if (context.backupId !== undefined || context.untitledDocumentData !== undefined) { throw new Error('Open a saved local data file. Import editors do not restore unsaved source backups.'); }
    const document = new TabularDocument(uri, format, () => { this.documents.delete(document); }); this.documents.add(document); return document;
  }
  async resolveCustomEditor(document: TabularDocument | SqliteDocument, panel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
    if (!(document instanceof TabularDocument)) { await this.sqlite.resolveCustomEditor(document, panel, token); return; }
    let closed = false; document.panels.add(panel);
    const close = panel.onDidDispose(() => { closed = true; document.panels.delete(panel); close.dispose(); });
    const cancellation = token.onCancellationRequested(() => { closed = true; panel.dispose(); });
    try {
      const controller = this.controllers[document.format]; await controller.ready;
      if (closed || document.disposed || token.isCancellationRequested) { panel.dispose(); return; }
      await controller.attach(document.uri, panel);
    } finally { cancellation.dispose(); }
  }
  dispose(): void { this.disposed = true; for (const document of this.documents) { document.dispose(); } this.documents.clear(); }
}
