import * as assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import type { CsvPreviewSession } from '../editor/csv-preview';
import { createSparseCsv } from './csv-preview-fixture';

async function preview(path: string): Promise<CsvPreviewSession> {
  const session = await vscode.commands.executeCommand<CsvPreviewSession>('lite-voyager.csvPreview', vscode.Uri.file(path));
  assert.ok(session); await session.finished; return session;
}
async function rendered(session: CsvPreviewSession): Promise<void> {
  if (session.firstRowsMs !== undefined) { return; }
  await new Promise<void>((accept, reject) => {
    const timer = setTimeout(() => { remove(); reject(new Error('CSV preview did not report rendered DOM rows.')); }, 5000);
    const remove = session.onStatus(() => {
      if (session.firstRowsMs !== undefined) { clearTimeout(timer); remove(); accept(); }
    });
  });
}
suite('T-020 real CSV preview', () => {
  test('FR-004: Given BOM/multiline exact CSV and default text association, When the preview command opens a tab, Then real worker/message/CSP/DOM behavior preserves the source', async function () {
    this.timeout(15000);
    const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension); await extension.activate();
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-preview-host-'));
    const path = join(directory, 'source.csv'); const contents = '\ufeffid,text,value\r\n9007199254740993,"first\r\nsecond",\r\n2,"<script>data</script>",NULL\r\n';
    let session: CsvPreviewSession | undefined;
    try {
      await writeFile(path, contents);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path), { preview: false });
      assert.ok(vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputText);
      session = await preview(path); assert.equal(session.state.phase, 'ready');
      assert.deepEqual(session.state.preview.rows, [['9007199254740993', 'first\r\nsecond', ''], ['2', '<script>data</script>', 'NULL']]);
      assert.ok(session.state.preview.threadId > 0); await rendered(session);
      assert.ok(session.status && session.status.renderedRows === 2 && session.status.renderedColumns > 0);
      assert.match(session.panel.webview.html, /default-src 'none'/u);
      assert.ok(vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputWebview);
      assert.equal(await readFile(path, 'utf8'), contents);
    } finally {
      session?.panel.dispose(); await session?.closed;
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('NFR-004: Given a sparse 3 GB CSV, When the command opens its preview, Then first-row DOM is ready under two seconds without whole-file reading', async function () {
    this.timeout(15000);
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-preview-large-host-'));
    const path = join(directory, 'large.csv'); let session: CsvPreviewSession | undefined;
    try {
      await createSparseCsv(path, `id,name\n${Array.from({ length: 101 }, (_, index) => `${String(index)},name`).join('\n')}\n`, 3_000_000_000);
      session = await preview(path); assert.equal(session.state.phase, 'ready');
      assert.equal(session.state.preview.rows.length, 100);
      assert.ok(BigInt(session.state.preview.bytesRead) <= 65_536n); await rendered(session);
      assert.ok(session.firstRowsMs !== undefined && session.firstRowsMs < 2000, `CSV first-row DOM took ${String(session.firstRowsMs)} ms`);
      assert.ok(session.status && session.status.renderedRows < 30 && session.status.renderedColumns <= 2);
      process.stdout.write(`T-020 sparse 3 GB preview: first-row DOM ${String(session.firstRowsMs)} ms, read ${session.state.preview.bytesRead} bytes, 100 cached rows.\n`);
    } finally { session?.panel.dispose(); await session?.closed; await rm(directory, { recursive: true, force: true }); }
  });

  test('FR-004: Given invalid input or cancellation, When reopening the preview, Then errors are visible and closure releases the worker/source handles', async function () {
    this.timeout(15000);
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-preview-close-host-'));
    const path = join(directory, 'input.csv'); const sessions: CsvPreviewSession[] = [];
    try {
      await writeFile(path, 'a\n"unterminated');
      const broken = await preview(path); sessions.push(broken);
      assert.equal(broken.state.phase, 'error'); assert.match(broken.state.message, /quote|malformed/iu);
      broken.panel.dispose(); await broken.closed;
      await writeFile(path, `a\n${'x'.repeat(8 * 1024 * 1024)}\n`);
      const cancelled = await vscode.commands.executeCommand<CsvPreviewSession>('lite-voyager.csvPreview', vscode.Uri.file(path)); assert.ok(cancelled); sessions.push(cancelled);
      await cancelled.cancel(); assert.equal(cancelled.state.phase, 'cancelled'); cancelled.panel.dispose(); await cancelled.closed;
      await writeFile(path, 'a\nrecovered\n');
      const recovered = await preview(path); sessions.push(recovered); assert.equal(recovered.state.phase, 'ready');
      recovered.panel.dispose(); await recovered.closed;
      // On Windows this also exercises that no worker retains the source handle.
      await rm(path); assert.equal(recovered.state.phase, 'ready');
    } finally {
      for (const session of sessions) { session.panel.dispose(); await session.closed; }
      await rm(directory, { recursive: true, force: true });
    }
  });
});
