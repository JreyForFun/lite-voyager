import { constants } from 'node:fs';
import type * as vscode from 'vscode';
import { expect, test, vi } from 'vitest';
import { TabularEditorProvider, TabularDocument } from '../../src/editor/tabular-editor';
import type { SqliteEditorProvider } from '../../src/editor/sqlite-editor';
import type { CsvImportController } from '../../src/editor/csv-import';

const io = vi.hoisted(() => ({ open: vi.fn(), read: vi.fn(), stat: vi.fn(), close: vi.fn() }));
vi.mock('vscode', () => ({}));
vi.mock('node:fs/promises', () => ({ open: io.open }));

test.each(['csv', 'json', 'xlsx'])('NFR-005: Given a nonregular %s handle, When detecting a SQLite header, Then open is nonblocking and the handle is closed without reading', async (format) => {
  io.read.mockReset(); io.close.mockReset(); io.stat.mockResolvedValue({ isFile: () => false });
  io.open.mockResolvedValue({ read: io.read, stat: io.stat, close: io.close });
  const sqlite = { openCustomDocument: vi.fn() };
  const provider = new TabularEditorProvider(sqlite as unknown as SqliteEditorProvider, {} as Readonly<Record<'csv' | 'json' | 'xlsx', CsvImportController>>);
  const source = { fsPath: `/fifo.${format}`, scheme: 'file' } as vscode.Uri;
  const document = await provider.openCustomDocument(source, { backupId: undefined, untitledDocumentData: undefined }, { isCancellationRequested: false } as vscode.CancellationToken);
  try {
    expect(io.open).toHaveBeenLastCalledWith(source.fsPath, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NONBLOCK));
    expect(io.stat).toHaveBeenCalled(); expect(io.read).not.toHaveBeenCalled(); expect(io.close).toHaveBeenCalledOnce();
    expect(document).toBeInstanceOf(TabularDocument); expect(sqlite.openCustomDocument).not.toHaveBeenCalled();
  } finally { document.dispose(); provider.dispose(); }
});
