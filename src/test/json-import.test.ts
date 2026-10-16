import * as assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import type { CsvImportSession } from '../editor/csv-import';
import type { BrowserStatus, CsvImportState } from '../protocol';

function wait(session: CsvImportSession, predicate: () => boolean): Promise<void> {
  if (predicate()) { return Promise.resolve(); }
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => { remove(); reject(new Error(`JSON DOM deadline: phase=${session.state.phase}; browser=${JSON.stringify(session.browserStatus)}`)); }, 15000);
    const remove = session.onStatus(() => { if (predicate()) { clearTimeout(timer); remove(); accept(); } });
  });
}
async function open(path: string): Promise<CsvImportSession> {
  const session = await vscode.commands.executeCommand<CsvImportSession>('lite-voyager.jsonImport', vscode.Uri.file(path)); assert.ok(session); await session.finished; return session;
}
async function control(session: CsvImportSession, action: 'start' | 'refresh' | 'cancel', predicate: (state: CsvImportState) => boolean): Promise<void> {
  const before = session.state;
  await Promise.all([wait(session, () => session.state !== before && predicate(session.state)),
    session.panel.webview.postMessage({ type: 'csvImportExercise', contextId: session.contextId, action, options: {} }).then((sent) => { assert.ok(sent); })]);
}
async function browser(session: CsvImportSession, action: 'sql' | 'run' | 'next', predicate: (status: BrowserStatus) => boolean, value?: string): Promise<void> {
  const revision = session.browserStatus?.revision ?? 0;
  await Promise.all([wait(session, () => session.browserStatus !== undefined && session.browserStatus.revision > revision && predicate(session.browserStatus)),
    session.panel.webview.postMessage({ type: 'browserExercise', action, ...(value === undefined ? {} : { value }) }).then((sent) => { assert.ok(sent); })]);
}

suite('T-023 JSON / JSONL production import', () => {
  for (const fallback of [false, true]) {
    test(`FR-005: Given JSON/JSONL controls with fallback=${String(fallback)}, When importing and running nested SQL, Then preview, paging, exact values and SQLite save survive source-safe closure`, async function () {
      this.timeout(60000);
      const directory = await mkdtemp(join(tmpdir(), 'lv-json-host-')); const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      try {
        for (const format of ['json', 'jsonl']) {
          const path = join(directory, `source.${format}`); const rows = Array.from({ length: 250 }, (_, i) => `{"id":${String(9007199254740993n + BigInt(i))},"nested":{"label":"row ${String(i)} 🙂"},"nullable":${i % 2 === 0 ? 'null' : '""'}}`);
          const contents = format === 'json' ? `[${rows.join(',')}]` : rows.join('\r\n'); await writeFile(path, contents); const session = await open(path);
          try {
            assert.equal(session.state.phase, 'ready'); assert.deepEqual(session.state.options, {}); assert.equal(session.state.preview?.rows[0]?.[0], '9007199254740993');
            await wait(session, () => session.firstRowsMs !== undefined); await control(session, 'refresh', (state) => state.phase === 'ready');
            await control(session, 'start', (state) => state.phase === 'importing'); await session.finished; assert.equal(session.state.phase, 'opened');
            assert.equal(session.state.progress?.engine, fallback ? 'sql.js' : 'node:sqlite'); assert.equal(session.state.progress.rows, '250');
            await wait(session, () => session.browserStatus?.editorReady === true && !session.browserStatus.busy && session.browserStatus.renderedRows > 0);
            await browser(session, 'next', (status) => !status.busy && status.offset === 100 && status.renderedRows > 0 && status.firstRow[0]?.text === '9007199254741093');
            assert.equal(session.browserStatus?.firstRow[0]?.text, '9007199254741093');
            const sql = "SELECT id,typeof(id),json_extract(nested,'$.label'),nullable FROM records WHERE rowid=250";
            await browser(session, 'sql', (status) => status.sqlLength === sql.length, sql);
            await browser(session, 'run', (status) => status.query === true && !status.busy && status.cachedRows === 1 && status.renderedRows > 0);
            assert.deepEqual(session.browserStatus?.firstRow.map((cell) => cell.text), ['9007199254741242', 'integer', 'row 249 🙂', '(empty)']);
            assert.equal(session.browserStatus?.firstRow[3]?.label, 'Empty string');
            const destination = join(directory, `${format}.sqlite`); session.configureSqliteSave(() => Promise.resolve(destination));
            await vscode.commands.executeCommand('lite-voyager.saveAsSqlite'); assert.equal(session.saveState.phase, 'saved');
            assert.equal(await readFile(path, 'utf8'), contents);
            process.stdout.write(`T-023 ${format} fallback=${String(fallback)} first DOM=${String(session.firstRowsMs)}ms; exact 250-row paging/nested SQL/save PASS.\n`);
          } finally { session.panel.dispose(); await session.closed; }
        }
      } finally { if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; } await rm(directory, { recursive: true, force: true }); }
    });
  }
  test('FR-005: Given malformed JSON then a valid source, When retrying preview and cancelling a real import, Then errors are visible, source bytes survive and independent sessions recover', async function () {
    this.timeout(60000); const directory = await mkdtemp(join(tmpdir(), 'lv-json-cancel-')); const path = join(directory, 'source.jsonl'); const sessions: CsvImportSession[] = [];
    try {
      await writeFile(path, '{"a":'); const first = await open(path); sessions.push(first); assert.equal(first.state.phase, 'error'); assert.match(first.state.message, /JSON/);
      const contents = '{"a":9007199254740993}\n'.repeat(200000); await writeFile(path, contents); await control(first, 'refresh', (state) => state.phase === 'ready');
      await wait(first, () => first.firstRowsMs !== undefined); const second = await open(path); sessions.push(second); first.panel.reveal(vscode.ViewColumn.Active);
      await control(first, 'start', (state) => state.phase === 'importing'); await wait(first, () => first.state.progress !== undefined);
      const started = performance.now(); await control(first, 'cancel', (state) => state.phase === 'cancelled'); await first.finished;
      assert.ok(performance.now() - started < 1000); assert.equal(second.state.phase, 'ready'); assert.equal(await readFile(path, 'utf8'), contents);
      for (const session of sessions.splice(0)) { session.panel.dispose(); await session.closed; }
      assert.deepEqual(await readdir(directory), ['source.jsonl']); await writeFile(path, '{"a":1}\n'); const recovered = await open(path); sessions.push(recovered);
      await recovered.startImport(); assert.equal(recovered.state.phase, 'opened');
    } finally { for (const session of sessions) { session.panel.dispose(); await session.closed; } await rm(directory, { recursive: true, force: true }); }
  });
});
