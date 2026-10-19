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
let nextExerciseId = 0;
const actionStages = new WeakMap<SqliteDocument, (stage: string) => void>();
async function action(document: SqliteDocument, message: BrowserExercise, predicate: (status: BrowserStatus) => boolean): Promise<BrowserStatus> {
  const stage = actionStages.get(document); stage?.(`action:${message.action}:start`);
  assert.ok(document.panel);
  const revision = document.browserStatus?.revision ?? 0;
  const exerciseId = ++nextExerciseId;
  // Register before yielding: fast operations can report busy and finish before
  // postMessage's transport promise resolves. Keep the delivery assertion too.
  const [, status] = await Promise.all([
    document.panel.webview.postMessage({ ...message, exerciseId } satisfies BrowserExercise).then((delivered) => { assert.equal(delivered, true); }),
    // The receiving view acknowledges this globally unique action. A cached
    // status may still belong to an old context during re-creation.
    waitStatus(document, (status) => status.contextId !== undefined && status.exerciseId === exerciseId && predicate(status), revision),
  ]);
  stage?.(`action:${message.action}:complete`); return status;
}
const settled = (status: BrowserStatus): boolean => !status.busy;
const rowsPainted = (status: BrowserStatus): boolean => !status.busy && status.renderedRows > 0 && status.firstRow.length > 0;
const digest = async (path: string): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');

function startProbePulse(document: SqliteDocument, key: string): () => Promise<void> {
  const panel = document.panel; assert.ok(panel);
  let delivery: Promise<void> | undefined;
  let failure: Error | undefined;
  // Keep at most one API delivery promise pending; pulses also have a fixed
  // 10 ms rate and the enclosing test's existing 60 s deadline.
  const timer = setInterval(() => {
    if (delivery !== undefined || failure !== undefined) { return; }
    delivery = Promise.resolve().then(() => panel.webview.postMessage({
      type: 'browserExercise', action: 'pulseResponsiveness', value: key,
    } satisfies BrowserExercise)).then((delivered) => { assert.equal(delivered, true); })
      .catch((error: unknown) => { failure = error instanceof Error ? error : new Error('The webview probe pulse could not be delivered.'); })
      .finally(() => { delivery = undefined; });
  }, 10);
  return async () => {
    clearInterval(timer); await delivery;
    if (failure !== undefined) { throw failure; }
  };
}

suite('T-014 production SQL cancellation and responsiveness', () => {
  for (const fallback of [false, true]) {
    test(`FR-015: Given the real SQL editor and fallback=${String(fallback)}, When cancelling executing SQL and closing during execution, Then the UI stays responsive, successful results survive and retry works`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager');
      assert.ok(extension); const api = await extension.activate();
      const path = join(extension.extensionPath, 'test/fixtures/sample.sqlite'); const before = await digest(path);
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      let document: SqliteDocument | undefined;
      try {
        const uri = vscode.Uri.file(path);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document);
        await waitStatus(document, (status) => rowsPainted(status) && status.editorReady === true);
        const current = document;
        const edit = (sql: string) => action(current, { type: 'browserExercise', action: 'sql', value: sql }, (status) => status.sqlLength === sql.length && !status.busy);
        const run = async (sql: string) => {
          await edit(sql);
          const busy = await action(current, { type: 'browserExercise', action: 'run' }, (status) => status.busy);
          return waitStatus(current, (status) => status.exerciseId === busy.exerciseId && rowsPainted(status), busy.revision);
        };
        await run('SELECT 42 AS preserved');
        const slow = 'WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<20000000) SELECT sum(x) FROM n';
        for (let attempt = 0; attempt < 2; ++attempt) {
          const old = current.browserStatus; assert.ok(old);
          await edit(slow);
          const probing = await action(current, { type: 'browserExercise', action: 'startResponsiveness' }, (status) => status.responsiveness?.ticks === 0);
          const stopPulse = startProbePulse(current, `${probing.contextId}:${String(probing.exerciseId)}`);
          try {
            const busy = await action(current, { type: 'browserExercise', action: 'run' }, (status) => status.busy);
            await waitStatus(current, (status) => status.exerciseId === busy.exerciseId && status.busy && /executing/.test(status.message), busy.revision);
            await new Promise<void>((resolve) => setTimeout(resolve, 150));
            assert.equal(current.browserStatus?.busy, true, 'query must still be executing when Cancel is clicked');
            const cancelStarted = performance.now();
            const cancelling = await action(current, { type: 'browserExercise', action: 'cancel' }, (status) => status.busy && /Cancelling/.test(status.message));
            // The second click must neither supersede nor duplicate cancellation.
            await action(current, { type: 'browserExercise', action: 'cancel' }, (status) => /Cancelling|cancelled/.test(status.message));
            const ready = await waitStatus(current, (status) => status.contextId === cancelling.contextId && !status.busy && /cancelled/.test(status.message), cancelling.revision);
            const recoveryMs = performance.now() - cancelStarted;
            assert.equal(ready.firstRow[0]?.text, old.firstRow[0]?.text);
            assert.equal(ready.count, '1'); assert.equal(ready.sqlLength, slow.length); assert.match(ready.message, /Run/);
            const measured = await action(current, { type: 'browserExercise', action: 'stopResponsiveness' }, (status) => !status.busy && status.responsiveness !== undefined);
            assert.ok(measured.responsiveness);
            // Preserve evidence on failures too, before either timing assertion.
            console.log(`T-014 DOM evidence: ${JSON.stringify({ fallback, attempt, recoveryMs, ...measured.responsiveness })}`);
            assert.ok(measured.responsiveness.ticks >= 5, `webview probe must collect at least five samples: ${JSON.stringify(measured.responsiveness)}`);
            assert.ok(measured.responsiveness.maxGapMs <= 100, `webview event maximum interval: ${String(measured.responsiveness.maxGapMs)} ms`);
          } finally { await stopPulse(); }
          const retried = await run(`SELECT ${String(7 + attempt)} AS recovered`);
          assert.equal(retried.firstRow[0]?.text, String(7 + attempt));
        }
        await edit(slow);
        const busy = await action(current, { type: 'browserExercise', action: 'run' }, (status) => status.busy);
        await waitStatus(current, (status) => status.exerciseId === busy.exerciseId && status.busy && /executing/.test(status.message), busy.revision);
        await closeEditor(current); await current.session.closed;
        assert.equal(api.sqliteEditor.getDocument(uri), undefined);
        assert.equal(await digest(path), before);
        document = undefined;
      } finally {
        if (document !== undefined) { await closeEditor(document); await document.session.closed; }
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
      }
    });
  }
});

suite('T-018 production cell details and clipboard', () => {
  for (const fallback of [false, true]) {
    test(`FR-018: Given the real editor and fallback=${String(fallback)}, When inspecting Browse/SQL cells and copying TSV, Then exact details, selection and source safety survive`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager');
      assert.ok(extension); const api = await extension.activate();
      const directory = await mkdtemp(join(extension.extensionPath, 'out', 't018-host-'));
      const generated = await promisify(execFile)(process.execPath, [join(extension.extensionPath, 'scripts/browser-fixture.mts'), directory], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      assert.equal(generated.stderr, '');
      const path = join(directory, 'browser.sqlite'); await chmod(path, 0o444); const before = await digest(path);
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      const previousClipboard = await vscode.env.clipboard.readText();
      let document: SqliteDocument | undefined;
      try {
        const uri = vscode.Uri.file(path);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document); await waitStatus(document, rowsPainted);
        const detailsDone = (status: BrowserStatus): boolean => status.cell?.row !== null && status.cell?.busy === false;
        const inspect = (value: string) => action(document!, { type: 'browserExercise', action: 'cell', value }, detailsDone);
        const copy = async (command: 'copyCell' | 'copyRow' | 'copySelection'): Promise<string> => {
          await action(document!, { type: 'browserExercise', action: command }, (status) => status.cell?.message === 'Copied as TSV.');
          return vscode.env.clipboard.readText();
        };
        let status = await inspect('0,0'); assert.equal(status.cell?.kind, 'SQL NULL'); assert.equal(await copy('copyCell'), '\\N');
        status = await inspect('0,1'); assert.equal(status.cell?.kind, 'Empty string'); assert.equal(status.cell?.length, 0); assert.equal(await copy('copyCell'), '""');
        status = await inspect('0,2'); assert.equal(status.cell?.preview, 'NULL'); assert.equal(await copy('copyCell'), 'NULL');
        status = await inspect('0,3'); assert.equal(status.cell?.preview, '9223372036854775807'); assert.equal(await copy('copyCell'), '9223372036854775807');
        status = await inspect('0,5'); assert.equal(status.cell?.preview, '[BLOB 24 bytes]'); assert.equal(await copy('copyCell'), '[BLOB 24 bytes]');
        await action(document, { type: 'browserExercise', action: 'select', value: 'b pages' }, rowsPainted);
        await inspect('0,0');
        await action(document, { type: 'browserExercise', action: 'extendCell', value: '1,1' }, detailsDone);
        assert.equal(await copy('copySelection'), '1\trow 1\n2\trow 2');
        assert.equal(await copy('copyRow'), '2\trow 2');
        await action(document, { type: 'browserExercise', action: 'next' }, (status) => rowsPainted(status) && status.offset === 100);
        assert.equal(document.browserStatus?.cell?.row, null); assert.equal(document.browserStatus?.cell?.length, 0);
        await action(document, { type: 'browserExercise', action: 'select', value: 'd view' }, rowsPainted);
        await inspect('0,1'); assert.equal(await copy('copyCell'), 'row 1');
        await action(document, { type: 'browserExercise', action: 'select', value: 'f wide' }, rowsPainted);
        await inspect('0,999'); assert.equal(await copy('copyCell'), '999');
        assert.ok((document.browserStatus?.renderedColumns ?? 1000) < 30);
        await action(document, { type: 'browserExercise', action: 'size', value: '1' }, rowsPainted);
        await action(document, { type: 'browserExercise', action: 'select', value: 'e large cells' }, rowsPainted);
        status = await inspect('0,0'); assert.equal(status.cell?.length, 1100000); assert.equal(status.cell?.preview, null);
        assert.equal(await copy('copyCell'), 'x'.repeat(1100000));
        const sql = `SELECT '{"n":9223372036854775807,"n":1e999,"s":"<script>x</script>"}' AS v, char(9)||char(10)||'"' AS v, NULL AS n, '' AS e, '\\N' AS marker`;
        await action(document, { type: 'browserExercise', action: 'sql', value: sql }, (status) => status.sqlLength === sql.length);
        await action(document, { type: 'browserExercise', action: 'run' }, (status) => rowsPainted(status) && status.query === true);
        status = await inspect('0,0');
        assert.equal(status.cell?.kind, 'JSON'); assert.ok(status.cell?.preview?.includes('9223372036854775807')); assert.ok(status.cell?.preview?.includes('1e999'));
        assert.equal(await copy('copyCell'), '"{""n"":9223372036854775807,""n"":1e999,""s"":""<script>x</script>""}"');
        assert.equal(await copy('copyRow'), '"{""n"":9223372036854775807,""n"":1e999,""s"":""<script>x</script>""}"\t"\t\n"""\t\\N\t""\t"\\N"');
        const oldContext = status.contextId;
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ content: 'T-018 context restoration' }), { preview: false });
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        const restored = await waitStatus(document, (status) => rowsPainted(status) && status.contextId !== oldContext && status.query === true);
        assert.equal(restored.cell?.row, null); assert.equal(restored.cell?.length, 0);
        await inspect('0,0'); assert.ok((await copy('copyCell')).includes('9223372036854775807'));
        const beforeNul = await vscode.env.clipboard.readText();
        const nulSql = "SELECT 'before'||char(0)||'after' AS value";
        await action(document, { type: 'browserExercise', action: 'sql', value: nulSql }, (status) => status.sqlLength === nulSql.length);
        await action(document, { type: 'browserExercise', action: 'run' }, (status) => rowsPainted(status) && status.query === true);
        status = await inspect('0,0'); assert.equal(status.cell?.length, 12);
        await action(document, { type: 'browserExercise', action: 'copyCell' }, (status) => status.cell?.busy === false && /NUL.*clipboard/.test(status.cell.message));
        assert.equal(await vscode.env.clipboard.readText(), beforeNul);
        await closeEditor(document); assert.equal(await digest(path), before);
        console.log(`T-018 host evidence: ${JSON.stringify({ engine: fallback ? 'sql.js' : 'node:sqlite', browseAndViewAndSql: true, exactJsonAndTsv: true, largeCellCharacters: 1100000, columns: 1000, contextRestored: true, sourceUnchanged: true })}`);
      } finally {
        document?.dispose(); await document?.session.closed;
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await vscode.env.clipboard.writeText(previousClipboard);
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await chmod(path, 0o600); await rm(directory, { recursive: true, force: true });
      }
    });
  }
});

suite('T-017 production sort and filter DOM', () => {
  for (const fallback of [false, true]) {
    test(`FR-017: Given the real grid and fallback=${String(fallback)}, When sorting, filtering, restoring and cancelling, Then engine-backed pages and controls recover without changing the source`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager');
      assert.ok(extension); const api = await extension.activate();
      const directory = await mkdtemp(join(extension.extensionPath, 'out', 't017-host-'));
      const generated = await promisify(execFile)(process.execPath, [join(extension.extensionPath, 'scripts/browser-fixture.mts'), directory], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      assert.equal(generated.stderr, '');
      const path = join(directory, 'browser.sqlite'); await chmod(path, 0o444); const before = await digest(path);
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      let document: SqliteDocument | undefined;
      try {
        const uri = vscode.Uri.file(path);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document);
        await waitStatus(document, rowsPainted);
        await action(document, { type: 'browserExercise', action: 'select', value: 'b pages' }, (status) => rowsPainted(status) && status.table === 'b pages');
        const ascending = await action(document, { type: 'browserExercise', action: 'sort', value: 'value' }, (status) => rowsPainted(status) && /end of table|Showing rows/.test(status.message));
        assert.equal(ascending.firstRow[1]?.text, 'row 1'); assert.equal(ascending.hasMore, true);
        const descending = await action(document, { type: 'browserExercise', action: 'sort', value: 'value' }, rowsPainted);
        assert.equal(descending.firstRow[1]?.text, 'row 99');
        const filtered = await action(document, { type: 'browserExercise', action: 'filter', value: JSON.stringify({ column: 'value', operator: 'contains', value: 'row 20' }) }, rowsPainted);
        assert.equal(filtered.offset, 0); assert.equal(filtered.cachedRows, 3); assert.equal(filtered.firstRow[0]?.text, '201'); assert.equal(filtered.count, null);
        const count = await action(document, { type: 'browserExercise', action: 'count' }, (status) => settled(status) && status.count === '3');
        assert.equal(count.cachedRows, 3);
        const previousContext = document.browserStatus?.contextId; assert.ok(previousContext);
        const text = await vscode.workspace.openTextDocument({ content: 'T-017 filter restoration' });
        await vscode.window.showTextDocument(text, { preview: false });
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        const restored = await waitStatus(document, (status) => rowsPainted(status) && status.contextId !== previousContext && status.table === 'b pages');
        assert.equal(restored.cachedRows, 3); assert.equal(restored.firstRow[0]?.text, '201'); assert.equal(restored.count, null);
        const removed = await action(document, { type: 'browserExercise', action: 'removeFilter' }, (status) => rowsPainted(status) && status.cachedRows === 100);
        assert.equal(removed.cachedRows, 100); assert.equal(removed.firstRow[1]?.text, 'row 99');
        await action(document, { type: 'browserExercise', action: 'clearGrid' }, rowsPainted);
        await action(document, { type: 'browserExercise', action: 'select', value: 'g slow count' }, (status) => rowsPainted(status) && status.table === 'g slow count');
        const warning = await action(document, { type: 'browserExercise', action: 'sort', value: 'x' }, (status) => settled(status) && /confirmation/.test(status.message));
        assert.equal(warning.firstRow[0]?.text, '1');
        const countBlocked = await action(document, { type: 'browserExercise', action: 'count' }, (status) => settled(status) && /confirmation/.test(status.message));
        assert.equal(countBlocked.count, null); assert.equal(countBlocked.offset, 0);
        const pageBlocked = await action(document, { type: 'browserExercise', action: 'next' }, (status) => settled(status) && /confirmation/.test(status.message));
        assert.equal(pageBlocked.firstRow[0]?.text, '1'); assert.equal(pageBlocked.offset, 0);
        const running = await action(document, { type: 'browserExercise', action: 'continueSort' }, (status) => status.busy);
        assert.ok(running.busy);
        const cancelled = await action(document, { type: 'browserExercise', action: 'cancel' }, (status) => settled(status) && /Operation cancelled/.test(status.message));
        assert.equal(cancelled.firstRow[0]?.text, '1');
        const recovered = await action(document, { type: 'browserExercise', action: 'select', value: 'b pages' }, (status) => rowsPainted(status) && status.table === 'b pages');
        assert.equal(recovered.firstRow[0]?.text, '1'); assert.equal(recovered.count, null);
        await closeEditor(document); assert.equal(await digest(path), before);
        console.log(`T-017 browser evidence: ${JSON.stringify({ engine: fallback ? 'sql.js' : 'node:sqlite', indexedSort: true, filteredCount: '3', restored: true, sortCancelledAndRecovered: true, sourceUnchanged: true })}`);
      } finally {
        document?.dispose(); await document?.session.closed;
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await chmod(path, 0o600); await rm(directory, { recursive: true, force: true });
      }
    });
  }
});

suite('T-013 production SQL editor DOM', () => {
  for (const fallback of [false, true]) {
    test(`FR-010: Given CodeMirror and fallback=${String(fallback)}, When running selection, shortcuts and paged SQL, Then errors preserve results, restoration works and sources remain unchanged`, async function () {
      this.timeout(60000);
      const stage = (value: string): void => { console.log(`T-013 stage: fallback=${String(fallback)} ${value}`); };
      stage('activation:start');
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager');
      assert.ok(extension); const api = await extension.activate();
      stage('activation:complete');
      const directory = await mkdtemp(join(extension.extensionPath, 'out', 't013-host-'));
      stage('fixture:start');
      const generated = await promisify(execFile)(process.execPath, [join(extension.extensionPath, 'scripts/browser-fixture.mts'), directory], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      assert.equal(generated.stderr, '');
      stage('fixture:complete');
      const path = join(directory, 'browser.sqlite'); await chmod(path, 0o444);
      stage('source-hash:start');
      const before = await digest(path);
      stage('source-hash:complete');
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      let document: SqliteDocument | undefined;
      try {
        const uri = vscode.Uri.file(path);
        stage('open:start');
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document);
        stage('open:complete'); actionStages.set(document, stage);
        stage('initial-dom:start');
        await waitStatus(document, (status) => rowsPainted(status) && status.editorReady === true);
        stage('initial-dom:complete');
        const current = document;
        const edit = async (sql: string): Promise<BrowserStatus> => {
          const edited = await action(current, { type: 'browserExercise', action: 'sql', value: sql }, (status) => status.sqlLength === sql.length);
          return edited.busy ? waitStatus(current, (status) => status.contextId === edited.contextId && status.exerciseId === edited.exerciseId && settled(status), edited.revision) : edited;
        };
        const execute = async (predicate: (status: BrowserStatus) => boolean, control: 'run' | 'shortcut' = 'run'): Promise<BrowserStatus> => {
          const started = await action(current, { type: 'browserExercise', action: control }, (status) => status.busy && /Running SQL/.test(status.message));
          return waitStatus(current, (status) => status.contextId === started.contextId && status.exerciseId === started.exerciseId && predicate(status), started.revision);
        };
        const run = async (sql: string): Promise<BrowserStatus> => {
          await edit(sql);
          return execute((status) => settled(status) && status.query === true && (status.cachedRows === 0 || status.firstRow.length > 0));
        };
        const sql = 'SELECT id, value FROM "b pages" ORDER BY id';
        const first = await run(sql);
        assert.equal(first.highlighted, true); assert.equal(first.cachedRows, 100); assert.equal(first.count, null);
        assert.equal(first.firstRow[0]?.text, '1'); assert.equal(first.hasMore, true);
        assert.match(first.summary ?? '', /Page execution time: \d+\.\d ms/);
        // Selection must exclude an invalid surrounding document, including emoji.
        const selected = "SELECT '🚀' AS duplicate, 2 AS duplicate";
        const documentSql = `SELECT FROM;\n${selected}\nDELETE FROM "b pages";`;
        await edit(documentSql);
        const from = documentSql.indexOf(selected);
        await action(current, { type: 'browserExercise', action: 'selection', value: `${String(from + selected.length)},${String(from)}` }, (status) => status.selectionLength === selected.length);
        const selection = await execute((status) => rowsPainted(status) && status.firstRow[0]?.text === '🚀', 'shortcut');
        assert.equal(selection.columns, 2); assert.equal(selection.count, '1'); assert.equal(selection.firstRow[1]?.text, '2');
        await run(sql);
        await edit('SELECT FROM');
        const failed = await execute((status) => settled(status) && /syntax error/.test(status.message));
        assert.equal(failed.firstRow[0]?.text, '1'); assert.equal(failed.cachedRows, 100); assert.equal(failed.hasMore, true);
        const second = await action(current, { type: 'browserExercise', action: 'next' }, (status) => rowsPainted(status) && status.offset === 100);
        assert.equal(second.firstRow[0]?.text, '101'); assert.equal(second.count, null);
        const last = await action(current, { type: 'browserExercise', action: 'next' }, (status) => rowsPainted(status) && status.offset === 200);
        assert.equal(last.firstRow[0]?.text, '201'); assert.equal(last.count, '201'); assert.equal(last.hasMore, false);
        await action(current, { type: 'browserExercise', action: 'previous' }, (status) => rowsPainted(status) && status.offset === 100);
        const revision = current.browserStatus?.revision ?? 0;
        const previousContext = current.browserStatus?.contextId; assert.ok(previousContext);
        stage('restore-text:start');
        const text = await vscode.workspace.openTextDocument({ content: 'T-013 SQL hide/show restoration' });
        await vscode.window.showTextDocument(text, { preview: false });
        stage('restore-text:complete');
        assert.equal(current.panel?.visible, false);
        stage('restore-open:start');
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        stage('restore-open:complete'); stage('restore-dom:start');
        const restored = await waitStatus(current, (status) => status.contextId !== undefined && status.contextId !== previousContext && rowsPainted(status) && status.query === true && status.offset === 100, revision);
        stage('restore-dom:complete');
        assert.equal(restored.firstRow[0]?.text, '101'); assert.equal(restored.sqlLength, 'SELECT FROM'.length);
        const fidelity = await run('SELECT nullable, empty, literal, maximum, minimum, bytes FROM "a values"');
        assert.deepEqual(fidelity.firstRow.map((cell) => [cell.text, cell.label]), [
          ['NULL', 'SQL NULL'], ['(empty)', 'Empty string'], ['NULL', null], ['9223372036854775807', null], ['-9223372036854775808', null], ['[BLOB 24 bytes]', null],
        ]);
        for (const invalid of ['SELECT * FROM "<missing 🚀>"', 'SELECT 1; SELECT 2', 'DELETE FROM "b pages"', 'WITH n AS (SELECT 1) DELETE FROM "b pages"']) {
          await edit(invalid);
          const error = await execute((status) => settled(status) && /no such table|read.?only|one read statement/i.test(status.message));
          if (invalid.includes('<missing')) { assert.ok(error.message.includes('no such table: <missing 🚀>')); }
          assert.equal(error.firstRow[3]?.text, '9223372036854775807'); assert.equal(error.count, '1');
        }
        await edit('SELECT sum(x) FROM "g slow count"');
        await action(current, { type: 'browserExercise', action: 'run' }, (status) => status.busy && /Running SQL/.test(status.message));
        const cancelled = await action(current, { type: 'browserExercise', action: 'cancel' }, (status) => settled(status) && /cancelled/.test(status.message));
        assert.equal(cancelled.firstRow[3]?.text, '9223372036854775807'); assert.equal(cancelled.count, '1');
        const empty = await run('SELECT 1 AS value WHERE 0');
        assert.equal(empty.cachedRows, 0); assert.equal(empty.count, '0'); assert.match(empty.summary ?? '', /No rows/);
        await edit('SELECT * FROM "e large cells"');
        const oversized = await execute((status) => settled(status) && /No value was truncated/.test(status.message));
        assert.equal(oversized.count, '0'); assert.equal(oversized.cachedRows, 0);
        const resizing = await action(current, { type: 'browserExercise', action: 'size', value: '1' }, (status) => status.busy);
        await waitStatus(current, settled, resizing.revision);
        const large = await execute((status) => rowsPainted(status) && status.firstRow[0]?.length === 1100000);
        assert.equal(large.firstRow[0]?.text, null); assert.equal(large.cachedRows, 1);
        const wide = await run('SELECT * FROM "f wide"');
        assert.equal(wide.columns, 1000); assert.ok(wide.renderedColumns < 40);
        const end = await action(current, { type: 'browserExercise', action: 'lastCell' }, (status) => rowsPainted(status) && status.firstRow.some((cell) => cell.text === '999'));
        assert.ok(end.renderedColumns < 40);
        stage('close-editor:start'); await closeEditor(current); stage('close-editor:complete');
        assert.equal(await digest(path), before);
        console.log(`T-013 SQL evidence: ${JSON.stringify({ vscode: vscode.version, engine: fallback ? 'sql.js' : 'node:sqlite', selectionShortcut: true, highlighted: first.highlighted, paging: true, retainedErrors: true, restoredEditorAndQuery: true, sourceUnchanged: true })}`);
      } finally {
        stage('dispose:start'); document?.dispose(); stage('dispose:complete');
        stage('finally-helper:start'); await document?.session.closed; stage('finally-helper:complete');
        if (document !== undefined) { actionStages.delete(document); }
        stage('close-all:start');
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        stage('close-all:complete');
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        stage('fixture-cleanup:start');
        await chmod(path, 0o600); await rm(directory, { recursive: true, force: true });
        stage('fixture-cleanup:complete');
      }
    });
  }
});

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
        // The details sidebar reduces available grid width. Read every cell
        // from the real DOM after navigation, using its actual column ordinal;
        // an unrendered column is not a missing SQLite value.
        const fidelity: [string | null, string | null][] = [];
        for (let column = 0; column < 9; column++) {
          const painted = await action(document, { type: 'browserExercise', action: 'cell', value: `0,${String(column)}` },
            (status) => rowsPainted(status) && status.firstRow.some((cell) => cell.column === column));
          const cell = painted.firstRow.find((cell) => cell.column === column); assert.ok(cell);
          fidelity.push([cell.text, cell.label]);
        }
        assert.deepEqual(fidelity, [
          ['NULL', 'SQL NULL'], ['(empty)', 'Empty string'], ['NULL', null], ['9223372036854775807', null], ['-9223372036854775808', null],
          ['[BLOB 24 bytes]', null], ['1e-200', null], ['2026-10-10T12:00:00+08:00', null], ['<script>literal</script>', null],
        ]);
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
        const previousContext = document.browserStatus?.contextId; assert.ok(previousContext);
        const text = await vscode.workspace.openTextDocument({ content: 'T-012 hide/show browser context regression' });
        await vscode.window.showTextDocument(text, { preview: false });
        assert.equal(document.panel?.visible, false);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        const restored = await waitStatus(document, (status) => status.contextId !== undefined && status.contextId !== previousContext && rowsPainted(status) && status.table === 'b pages' && status.offset === 100, revision);
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
