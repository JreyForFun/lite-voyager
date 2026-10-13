import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import type { SqliteDocument } from '../editor/sqlite-editor';
import type { BrowserExercise, BrowserStatus } from '../protocol';
import { closeEditor } from './sqlite-editor-lifecycle';

function wait(document: SqliteDocument, predicate: (status: BrowserStatus) => boolean, revision = 0): Promise<BrowserStatus> {
  const previous = document.browserStatus;
  if (previous !== undefined && previous.revision > revision && predicate(previous)) { return Promise.resolve(previous); }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error(`Export DOM deadline: ${JSON.stringify(document.browserStatus)}`)); }, 15000);
    const unsubscribe = document.onBrowserStatus((status) => {
      if (status.revision > revision && predicate(status)) { clearTimeout(timer); unsubscribe(); resolve(status); }
    });
  });
}
async function action(document: SqliteDocument, message: BrowserExercise, predicate: (status: BrowserStatus) => boolean): Promise<BrowserStatus> {
  assert.ok(document.panel); const revision = document.browserStatus?.revision ?? 0;
  const exerciseId = (document.browserStatus?.exerciseId ?? 0) + 1;
  const [, status] = await Promise.all([
    document.panel.webview.postMessage({ ...message, exerciseId } satisfies BrowserExercise).then((delivered) => { assert.equal(delivered, true); }),
    wait(document, (value) => value.exerciseId === exerciseId && predicate(value), revision),
  ]); return status;
}
const ready = (status: BrowserStatus): boolean => !status.busy && status.editorReady === true;

suite('T-015 streamed export in the real editor', () => {
  for (const fallback of [false, true]) {
    test(`FR-014: Given real SQL results and fallback=${String(fallback)}, When exporting CSV/JSON and cancelling, Then all rows save, the page stays intact, timers tick and source/output safety hold`, async function () {
      this.timeout(60000);
      const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
      const api = await extension.activate(); const source = join(extension.extensionPath, 'test/fixtures/sample.sqlite');
      const before = createHash('sha256').update(await readFile(source)).digest('hex');
      const directory = await mkdtemp(join(extension.extensionPath, 'out', 't015-host-'));
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      let document: SqliteDocument | undefined;
      try {
        const uri = vscode.Uri.file(source); await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        document = api.sqliteEditor.getDocument(uri); assert.ok(document); const current = document; await wait(current, ready);
        current.session.configureExport((format) => Promise.resolve(join(directory, `result.${format}`)));
        const sql = 'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<50000) SELECT x AS "", 9223372036854775807 AS "", printf(\'%.*c\',128,\'x\') AS value FROM n';
        await action(current, { type: 'browserExercise', action: 'sql', value: sql }, ready);
        await action(current, { type: 'browserExercise', action: 'run' }, (status) => ready(status) && status.query === true && status.renderedRows > 0 && status.firstRow.length === 3);
        const preserved = current.browserStatus; assert.ok(preserved);
        // Export uses successful SQL even after the editor's text changes.
        await action(current, { type: 'browserExercise', action: 'sql', value: 'SELECT 999' }, ready);
        for (const [command, format] of [['exportCsv', 'csv'], ['exportJson', 'json']] as const) {
          let ticks = 0; let maxGapMs = 0; let last = performance.now(); const began = last;
          const timer = setInterval(() => { const now = performance.now(); maxGapMs = Math.max(maxGapMs, now - last); last = now; ++ticks; }, 10);
          let saved: BrowserStatus;
          try { saved = await action(current, { type: 'browserExercise', action: command }, (status) => !status.busy && /Export saved: 50000 rows/.test(status.message)); }
          finally { clearInterval(timer); }
          console.log(`T-015 host export evidence: ${JSON.stringify({ fallback, format, rows: 50000, milliseconds: performance.now() - began, ticks, maxGapMs })}`);
          assert.ok(ticks >= 5); assert.ok(maxGapMs <= 100, `host export maximum timer interval ${String(maxGapMs)} ms`);
          assert.deepEqual(saved.firstRow, preserved.firstRow); assert.equal(saved.offset, preserved.offset); assert.equal(saved.summary, preserved.summary);
          const text = await readFile(join(directory, `result.${format}`), 'utf8');
          if (format === 'json') {
            const parsed: unknown = JSON.parse(text);
            assert.ok(typeof parsed === 'object' && parsed !== null && 'rows' in parsed && Array.isArray(parsed.rows) && 'columns' in parsed);
            assert.deepEqual(parsed.columns, ['', '', 'value']); assert.equal(parsed.rows.length, 50000);
            assert.deepEqual(parsed.rows.at(-1), ['50000', '9223372036854775807', 'x'.repeat(128)]);
          } else {
            const records = text.split('\r\n'); assert.equal(records.length, 50002);
            assert.equal(records[0], '"","","value"'); assert.equal(records.at(-2), '"50000","9223372036854775807","' + 'x'.repeat(128) + '"');
          }
        }
        await action(current, { type: 'browserExercise', action: 'sql', value: 'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10000000) SELECT x, printf(\'%.*c\',1024,\'x\') FROM n' }, ready);
        await action(current, { type: 'browserExercise', action: 'run' }, (status) => ready(status) && status.query === true);
        await writeFile(join(directory, 'result.json'), 'keep me');
        await action(current, { type: 'browserExercise', action: 'exportJson' }, (status) => status.busy && /bytes written/.test(status.message) && !/0 bytes written/.test(status.message));
        await action(current, { type: 'browserExercise', action: 'cancel' }, (status) => !status.busy && /cancelled/.test(status.message));
        assert.equal(await readFile(join(directory, 'result.json'), 'utf8'), 'keep me');
        assert.deepEqual((await readdir(directory)).sort(), ['result.csv', 'result.json']);
        await closeEditor(current); await current.session.closed; document = undefined;
        assert.equal(createHash('sha256').update(await readFile(source)).digest('hex'), before);
      } finally {
        if (document !== undefined) { await closeEditor(document); await document.session.closed; }
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
});
