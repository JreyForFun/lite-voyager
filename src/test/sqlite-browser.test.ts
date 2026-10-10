import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import type { SqliteDocument } from '../editor/sqlite-editor';
import type { BrowserExercise, BrowserStatus } from '../protocol';
import { closeEditor } from './sqlite-editor-lifecycle';

function waitStatus(document: SqliteDocument, predicate: (status: BrowserStatus) => boolean, revision = 0): Promise<BrowserStatus> {
  const previous = document.browserStatus;
  if (previous !== undefined && previous.revision > revision && predicate(previous)) { return Promise.resolve(previous); }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error(`Browser DOM status deadline: ${JSON.stringify(document.browserStatus)}`)); }, 15000);
    const unsubscribe = document.onBrowserStatus((status) => {
      if (status.revision > revision && predicate(status)) { clearTimeout(timer); unsubscribe(); resolve(status); }
    });
  });
}
async function action(document: SqliteDocument, message: BrowserExercise, predicate: (status: BrowserStatus) => boolean): Promise<BrowserStatus> {
  assert.ok(document.panel);
  const revision = document.browserStatus?.revision ?? 0;
  assert.equal(await document.panel.webview.postMessage(message), true);
  return waitStatus(document, predicate, revision);
}
const settled = (status: BrowserStatus): boolean => !status.busy;
const rowsPainted = (status: BrowserStatus): boolean => !status.busy && status.renderedRows > 0 && status.firstRow.length > 0;
const digest = async (path: string): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');

suite('T-012 production browser DOM', () => {
  for (const fallback of [false, true]) {
    test(`FR-002: Given the real custom editor and fallback=${String(fallback)}, When browsing fidelity, paging, views and wide/large data, Then actual DOM values, controls and source safety pass`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager');
      assert.ok(extension); const api = await extension.activate();
      const directory = await mkdtemp(join(extension.extensionPath, 'out', 't012-host-'));
      const generated = await promisify(execFile)(process.execPath, [join(extension.extensionPath, 'scripts/browser-fixture.mts'), directory], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      assert.equal(generated.stderr, '');
      const path = join(directory, 'browser.sqlite'); await chmod(path, 0o444);
      const before = await digest(path);
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      let document: SqliteDocument | undefined;
      try {
        const uri = vscode.Uri.file(path); const started = performance.now();
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document);
        const first = await waitStatus(document, rowsPainted);
        const firstPaintMs = performance.now() - started;
        assert.equal(first.table, 'a values'); assert.equal(first.count, null);
        assert.ok(first.renderedRows > 0 && first.renderedRows <= first.cachedRows);
        assert.deepEqual(first.firstRow.slice(0, 5).map((cell) => [cell.text, cell.label]), [
          ['NULL', 'SQL NULL'], ['(empty)', 'Empty string'], ['NULL', null], ['9223372036854775807', null], ['-9223372036854775808', null],
        ]);
        assert.equal(first.firstRow[5]?.text, '[BLOB 24 bytes]');
        assert.equal(first.firstRow[6]?.text, '1e-200');
        const right = await action(document, { type: 'browserExercise', action: 'lastCell' }, (status) => rowsPainted(status) && status.firstRow.some((cell) => cell.text === '<script>literal</script>'));
        assert.ok(right.firstRow.some((cell) => cell.text === '2026-10-10T12:00:00+08:00'));
        const page = await action(document, { type: 'browserExercise', action: 'select', value: 'b pages' }, (status) => rowsPainted(status) && status.table === 'b pages');
        assert.equal(page.cachedRows, 100); assert.equal(page.count, null); assert.equal(page.hasMore, true);
        assert.ok(page.renderedRows < 100);
        const second = await action(document, { type: 'browserExercise', action: 'next' }, (status) => rowsPainted(status) && status.offset === 100);
        assert.equal(second.firstRow[0]?.text, '101'); assert.equal(second.cachedRows, 100);
        const last = await action(document, { type: 'browserExercise', action: 'next' }, (status) => rowsPainted(status) && status.offset === 200);
        assert.equal(last.firstRow[0]?.text, '201'); assert.equal(last.cachedRows, 1); assert.equal(last.hasMore, false);
        const back = await action(document, { type: 'browserExercise', action: 'previous' }, (status) => rowsPainted(status) && status.offset === 100);
        assert.equal(back.firstRow[0]?.text, '101');
        const revision = document.browserStatus?.revision ?? 0;
        const text = await vscode.workspace.openTextDocument({ content: 'T-012 hide/show browser context regression' });
        await vscode.window.showTextDocument(text, { preview: false });
        assert.equal(document.panel?.visible, false);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        const restored = await waitStatus(document, (status) => rowsPainted(status) && status.table === 'b pages' && status.offset === 100, revision);
        assert.equal(restored.firstRow[0]?.text, '101');
        await action(document, { type: 'browserExercise', action: 'next' }, (status) => rowsPainted(status) && status.offset === 200);
        await action(document, { type: 'browserExercise', action: 'previous' }, (status) => rowsPainted(status) && status.offset === 100);
        assert.equal((await action(document, { type: 'browserExercise', action: 'count' }, (status) => settled(status) && status.count !== null)).count, '201');
        const empty = await action(document, { type: 'browserExercise', action: 'select', value: 'c empty' }, (status) => settled(status) && status.table === 'c empty');
        assert.match(empty.message, /No rows/); assert.equal(empty.cachedRows, 0);
        const view = await action(document, { type: 'browserExercise', action: 'select', value: 'd view' }, (status) => rowsPainted(status) && status.table === 'd view');
        assert.equal(view.cachedRows, 100);
        const large = await action(document, { type: 'browserExercise', action: 'select', value: 'e large cells' }, (status) => settled(status) && status.table === 'e large cells');
        assert.match(large.message, /No value was truncated/);
        const smaller = await action(document, { type: 'browserExercise', action: 'size', value: '1' }, (status) => rowsPainted(status) && status.table === 'e large cells');
        assert.equal(smaller.cachedRows, 1); assert.equal(smaller.firstRow[0]?.length, 1100000); assert.equal(smaller.firstRow[0]?.text, null);
        const wide = await action(document, { type: 'browserExercise', action: 'select', value: 'f wide' }, (status) => rowsPainted(status) && status.table === 'f wide');
        assert.equal(wide.columns, 1000); assert.ok(wide.renderedColumns < 40);
        const end = await action(document, { type: 'browserExercise', action: 'lastCell' }, (status) => rowsPainted(status) && status.firstRow.some((cell) => cell.text === '999'));
        assert.ok(end.renderedColumns < 40);
        await action(document, { type: 'browserExercise', action: 'select', value: 'g slow count' }, (status) => rowsPainted(status) && status.table === 'g slow count');
        const busy = await action(document, { type: 'browserExercise', action: 'count' }, (status) => status.busy && /Counting/.test(status.message));
        assert.equal(busy.count, null);
        const cancelled = await action(document, { type: 'browserExercise', action: 'cancel' }, (status) => settled(status) && /cancelled/.test(status.message));
        assert.equal(cancelled.count, null);
        const recovered = await action(document, { type: 'browserExercise', action: 'select', value: 'b pages' }, (status) => rowsPainted(status) && status.table === 'b pages');
        assert.equal(recovered.firstRow[0]?.text, '1');
        const broken = await action(document, { type: 'browserExercise', action: 'select', value: 'h broken view' }, (status) => settled(status) && status.table === 'h broken view');
        assert.match(broken.message, /reopen|retry/iu);
        const laterObjects = await action(document, { type: 'browserExercise', action: 'listNext' }, (status) => settled(status) && status.table?.startsWith('list 09') === true);
        assert.equal(laterObjects.cachedRows, 0);
        await action(document, { type: 'browserExercise', action: 'listPrevious' }, (status) => rowsPainted(status) && status.table === 'a values');
        await closeEditor(document);
        assert.equal(await digest(path), before);
        console.log(`T-012 browser evidence: ${JSON.stringify({ vscode: vscode.version, engine: fallback ? 'sql.js' : 'node:sqlite', bytes: (await stat(path)).size, firstPaintMs, sourceUnchanged: true, cancellationRecovered: true })}`);
        if (!fallback) { assert.ok(firstPaintMs < 2000, `Measured first rows took ${String(firstPaintMs)}ms`); }
      } finally {
        document?.dispose(); await document?.session.closed;
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await chmod(path, 0o600); await rm(directory, { recursive: true, force: true });
      }
    });
  }

  test('NFR-004: Given a generated ten-million-row SQLite table, When the real custom editor opens, Then first DOM rows appear within two seconds without counting and page/cache sizes stay bounded', async function () {
    this.timeout(60000);
    const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager');
    assert.ok(extension); const api = await extension.activate();
    const directory = await mkdtemp(join(extension.extensionPath, 'out', 't012-large-host-'));
    const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = '0';
    let document: SqliteDocument | undefined;
    try {
      const generated = await promisify(execFile)(process.execPath, [join(extension.extensionPath, 'scripts/browser-fixture.mts'), directory, '--large'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      assert.equal(generated.stderr, '');
      const path = join(directory, 'browser.sqlite'); await chmod(path, 0o444);
      const before = await digest(path); const bytes = (await stat(path)).size;
      const started = performance.now(); const uri = vscode.Uri.file(path);
      await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
      document = api.sqliteEditor.getDocument(uri); assert.ok(document);
      const first = await waitStatus(document, rowsPainted); const firstDomMs = performance.now() - started;
      assert.equal(document.session.state.opened?.engine, 'node:sqlite');
      assert.equal(first.table, '0 ten million'); assert.equal(first.count, null); assert.equal(first.cachedRows, 100);
      assert.equal(first.firstRow[0]?.text, '1'); assert.ok(first.renderedRows < 100); assert.ok(first.hasMore);
      const next = await action(document, { type: 'browserExercise', action: 'next' }, (status) => rowsPainted(status) && status.offset === 100);
      assert.equal(next.cachedRows, 100); assert.equal(next.firstRow[0]?.text, '101'); assert.equal(next.count, null);
      await closeEditor(document);
      assert.equal(await digest(path), before);
      console.log(`T-012 large browser evidence: ${JSON.stringify({ vscode: vscode.version, engine: 'node:sqlite', rows: 10000000, bytes, firstDomMs, cachedRows: first.cachedRows, renderedRows: first.renderedRows, sourceUnchanged: true, scope: 'warm generated file; openWith through first rendered DOM report; excludes fixture generation/hash and physical-paint judgement' })}`);
      assert.ok(firstDomMs < 2000, `Ten-million-row first DOM report took ${String(firstDomMs)}ms`);
      await chmod(path, 0o600);
    } finally {
      document?.dispose(); await document?.session.closed;
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      const path = join(directory, 'browser.sqlite'); await chmod(path, 0o600).catch(() => { /* Generation may have failed before creating the file. */ });
      await rm(directory, { recursive: true, force: true });
    }
  });
});
