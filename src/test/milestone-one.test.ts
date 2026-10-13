import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import type { SqliteDocument } from '../editor/sqlite-editor';
import type { BrowserExercise, BrowserStatus } from '../protocol';
import { browserAction, painted, runSql, sourceDigest, waitBrowser } from './sqlite-exercise';
import { closeEditor } from './sqlite-editor-lifecycle';

let sequence = 2_000_000;
// Compiled controller lives in out/integration/test. Disposable fixtures
// belong to the project even when this same suite targets an installed VSIX.
const projectRoot = resolve(__dirname, '../../..');
async function waitView(document: SqliteDocument, panel: vscode.WebviewPanel, predicate: (status: BrowserStatus) => boolean): Promise<BrowserStatus> {
  const deadline = performance.now() + 15000;
  while (performance.now() < deadline) {
    const status = document.views.get(panel)?.status;
    if (status !== undefined && predicate(status)) { return status; }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`T-019 view deadline: ${JSON.stringify(document.views.get(panel)?.status)}`);
}
async function viewAction(document: SqliteDocument, panel: vscode.WebviewPanel, action: BrowserExercise['action'], value: string, predicate: (status: BrowserStatus) => boolean): Promise<BrowserStatus> {
  const exerciseId = ++sequence;
  const result = waitView(document, panel, (status) => status.exerciseId === exerciseId && predicate(status));
  assert.equal(await panel.webview.postMessage({ type: 'browserExercise', action, value, exerciseId } satisfies BrowserExercise), true);
  return result;
}

suite('T-019 milestone schema and independent views', () => {
  for (const fallback of [false, true]) {
    test(`FR-003: Given the real editor and fallback=${String(fallback)}, When inspecting empty/quoted/wide schema and malformed text, Then metadata is paged, literal and source-safe`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
      const api = await extension.activate(); const directory = await mkdtemp(join(projectRoot, 'out', 't019-schema-'));
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      let document: SqliteDocument | undefined;
      try {
        const generated = await promisify(execFile)(process.execPath, [join(projectRoot, 'scripts/milestone-one-fixture.mts'), directory], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
        assert.equal(generated.stderr, ''); const path = join(directory, 'gate.sqlite'); const before = await sourceDigest(path);
        const uri = vscode.Uri.file(path); await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document); const current = document;
        const first = await waitBrowser(current, painted); assert.equal(first.table, ''); assert.equal(first.firstRow[0]?.text, 'blank');
        const columns = await browserAction(current, 'schema', (status) => !status.busy && status.schema?.rows === 2);
        assert.match(columns.schema?.preview ?? '', /TEXT.*1.*'literal'.*1/u); assert.equal(columns.firstRow[0]?.text, 'blank');
        const indexes = await browserAction(current, 'schemaKind', (status) => !status.busy && status.schema?.kind === 'indexes', 'indexes');
        assert.match(indexes.schema?.preview ?? '', /blank_index.*CREATE INDEX/u);
        const terms = await browserAction(current, 'schemaIndex', (status) => !status.busy && status.schema?.kind === 'indexColumns', 'blank_index');
        assert.match(terms.schema?.preview ?? '', /id.*1.*BINARY.*1/u);
        const failed = await browserAction(current, 'schemaIndex', (status) => !status.busy && /not found/u.test(status.schema?.message ?? ''), 'missing');
        assert.equal(failed.schema?.rows, terms.schema?.rows); assert.equal(failed.firstRow[0]?.text, 'blank');
        await browserAction(current, 'select', (status) => painted(status) && status.table === 'wide', 'wide');
        const wide = await browserAction(current, 'schemaKind', (status) => !status.busy && status.schema?.rows === 100 && status.schema.offset === 0, 'columns');
        assert.equal(wide.schema?.hasMore, true);
        for (let offset = 100; offset < 1000; offset += 100) {
          const page = await browserAction(current, 'schemaNext', (status) => !status.busy && status.schema?.offset === offset);
          assert.equal(page.schema?.rows, 100); assert.match(page.schema?.preview ?? '', new RegExp(`column ${String(offset)}\\b`, 'u'));
          assert.equal(page.cachedRows, 1); assert.equal(page.columns, 1000); assert.equal(page.schema?.hasMore, offset < 900);
        }
        const keyboard = await browserAction(current, 'gridKey', (status) => painted(status) && status.cell?.column === 999, 'Control+End');
        assert.equal(keyboard.cell?.row, 0); assert.equal(keyboard.cell.preview, '999');
        const themeConfig = vscode.workspace.getConfiguration('workbench'); const savedTheme = themeConfig.get<string>('colorTheme');
        try {
          for (const [label, theme, foreground, background] of [
            ['T-019 Light', 'vscode-light', 'rgb(17, 17, 17)', 'rgb(255, 255, 255)'],
            ['T-019 Dark', 'vscode-dark', 'rgb(238, 238, 238)', 'rgb(17, 17, 17)'],
          ] as const) {
            await themeConfig.update('colorTheme', label, vscode.ConfigurationTarget.Global);
            const deadline = performance.now() + 10000; let appearance: BrowserStatus['appearance'];
            do {
              appearance = (await browserAction(current, 'appearance', (status) => status.appearance !== undefined)).appearance;
              if (appearance !== undefined && appearance.theme.includes(theme) && appearance.foreground === foreground && appearance.background === background) { break; }
              await new Promise((resolve) => setTimeout(resolve, 50));
            } while (performance.now() < deadline);
            assert.ok(appearance); assert.ok(appearance.theme.includes(theme)); assert.equal(appearance.foreground, foreground); assert.equal(appearance.background, background);
          }
        } finally { await themeConfig.update('colorTheme', savedTheme, vscode.ConfigurationTarget.Global); }
        await browserAction(current, 'select', (status) => !status.busy && status.table === 'select "🚀', 'select "🚀');
        const quoted = await browserAction(current, 'schemaKind', (status) => !status.busy && status.schema?.kind === 'columns' && status.schema.rows === 1, 'columns');
        assert.match(quoted.schema?.preview ?? '', /'<img>'/u);
        const result = await runSql(current, 'SELECT 42 AS retained'); assert.equal(result.firstRow[0]?.text, '42');
        const retained = await browserAction(current, 'schemaKind', (status) => !status.busy && status.schema?.kind === 'indexes', 'indexes');
        assert.equal(retained.query, true); assert.equal(retained.firstRow[0]?.text, '42');
        const malformed = await runSql(current, 'SELECT value FROM malformed'); assert.match(malformed.message, /not valid|encoding/u); assert.equal(malformed.firstRow[0]?.text, '42');
        const session = current.session; await closeEditor(current); await session.closed; document = undefined;
        assert.deepEqual(await sourceDigest(path), before);
        console.log(`T-019 schema evidence: ${JSON.stringify({ fallback, emptyNames: true, quotedNames: true, metadataPages: 10, retainedSql: true, malformedRejected: true, sourceUnchanged: true })}`);
      } finally {
        document?.dispose(); await document?.session.closed; await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await rm(directory, { recursive: true, force: true });
      }
    });
    test(`FR-001: Given two real same-file views and fallback=${String(fallback)}, When one closes while the other queries, Then sessions, results and helper lifetime stay independent`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
      const api = await extension.activate(); const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      const uri = vscode.Uri.file(join(projectRoot, 'test/fixtures/sample.sqlite')); const before = await sourceDigest(uri.fsPath);
      let document: SqliteDocument | undefined;
      try {
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document); const current = document;
        await waitBrowser(current, (status) => painted(status) && status.editorReady === true);
        const first = current.panel; assert.ok(first); const firstSession = current.session;
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { viewColumn: vscode.ViewColumn.Beside, preview: false });
        assert.equal(api.sqliteEditor.getDocument(uri), current); assert.equal(current.views.size, 2);
        const second = [...current.views.keys()].find((panel) => panel !== first); assert.ok(second);
        const secondSession = current.views.get(second)?.session; assert.ok(secondSession); assert.notEqual(firstSession, secondSession);
        await waitView(current, second, (status) => painted(status) && status.editorReady === true);
        const firstResult = await viewAction(current, first, 'sql', 'SELECT 11 AS first_view', (status) => status.sqlLength === 23 && !status.busy);
        assert.equal(firstResult.query, false);
        await viewAction(current, first, 'run', '', (status) => painted(status) && status.firstRow[0]?.text === '11');
        const slow = 'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n';
        await viewAction(current, second, 'sql', slow, (status) => !status.busy && status.sqlLength === slow.length);
        const busy = await viewAction(current, second, 'run', '', (status) => status.busy && /Running SQL/u.test(status.message));
        await waitView(current, second, (status) => status.exerciseId === busy.exerciseId && status.busy && /executing/u.test(status.message));
        first.dispose(); await firstSession.closed; assert.equal(current.views.size, 1); assert.equal(secondSession.state.phase, 'opened');
        await viewAction(current, second, 'cancel', '', (status) => !status.busy && /cancelled/u.test(status.message));
        await viewAction(current, second, 'sql', 'SELECT 22', (status) => !status.busy && status.sqlLength === 9);
        const recovered = await viewAction(current, second, 'run', '', (status) => painted(status) && status.firstRow[0]?.text === '22'); assert.equal(recovered.query, true);
        second.dispose(); await secondSession.closed; assert.equal(api.sqliteEditor.getDocument(uri), undefined); document = undefined;
        assert.deepEqual(await sourceDigest(uri.fsPath), before);
        console.log(`T-019 independent-view evidence: ${JSON.stringify({ fallback, views: 2, closeDuringOtherQuery: true, recovered: true, helpersClosed: true, sourceUnchanged: true })}`);
      } finally {
        const sessions = [...(document?.views.values() ?? [])].map((record) => record.session); document?.dispose(); await Promise.all(sessions.map((session) => session.closed));
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      }
    });
  }
});
