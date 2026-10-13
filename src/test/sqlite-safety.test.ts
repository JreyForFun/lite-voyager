import * as assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { chmod, copyFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { activate } from '../extension';
import { browserAction, painted, runSql, sourceDigest, startSql, waitBrowser } from './sqlite-exercise';
import { closeEditor } from './sqlite-editor-lifecycle';

async function editorApi() {
  const extension = vscode.extensions.getExtension<ReturnType<typeof activate>>('jreyinnovarev.lite-voyager'); assert.ok(extension);
  return { extension, api: await extension.activate() };
}
function restoreFallback(previous: string | undefined): void {
  if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; }
  else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
}
suite('T-016 production SQLite source safety', () => {
  for (const fallback of [false, true]) {
    test(`FR-001: Given invalid headers, damaged database pages and empty input with fallback=${String(fallback)}, When opened, Then visible failures preserve all bytes and recovery opens valid empty data`, async function () {
      this.timeout(45000);
      const { extension, api } = await editorApi();
      const directory = await mkdtemp(join(extension.extensionPath, 'out', 't016-invalid-'));
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      try {
        const damaged = await readFile(join(extension.extensionPath, 'test/fixtures/sample.sqlite'));
        damaged[100] = 0; // Valid 16-byte header, invalid schema b-tree page type.
        await writeFile(join(directory, 'damaged.sqlite'), damaged, { flag: 'wx' });
        for (const name of ['corrupt.sqlite', 'truncated.sqlite', 'zero-byte.sqlite', 'empty.sqlite']) {
          await copyFile(join(extension.extensionPath, 'test/fixtures', name), join(directory, name));
        }
        const names = (await readdir(directory)).sort();
        for (const name of [...names.filter((name) => name !== 'empty.sqlite'), 'empty.sqlite']) {
          const path = join(directory, name); const before = await sourceDigest(path);
          const uri = vscode.Uri.file(path);
          await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
          const document = api.sqliteEditor.getDocument(uri); assert.ok(document);
          if (name === 'empty.sqlite') {
            assert.equal(document.session.state.phase, 'opened');
            const empty = await waitBrowser(document, (status) => !status.busy && /No tables/u.test(status.message));
            assert.equal(empty.cachedRows, 0);
          } else {
            assert.equal(document.session.state.phase, 'error');
            assert.match(document.session.state.message, /exists, is readable, and is a valid complete database/u);
            assert.ok(document.panel?.webview.html.includes('role="alert"'));
            await document.session.closed;
          }
          await closeEditor(document);
          assert.deepEqual(await sourceDigest(path), before);
          assert.deepEqual((await readdir(directory)).sort(), names);
        }
      } finally {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        restoreFallback(previous); await rm(directory, { recursive: true, force: true });
      }
    });

    test(`NFR-001: Given writable and read-only SQLite with fidelity, views, 1000 columns and large cells and fallback=${String(fallback)}, When browsing, querying, refusing writes, cancelling and recovering from a crash, Then sources remain byte-identical`, async function () {
      this.timeout(90000);
      const { extension, api } = await editorApi();
      const directory = await mkdtemp(join(extension.extensionPath, 'out', 't016-source-'));
      const generated = await promisify(execFile)(process.execPath, [join(extension.extensionPath, 'scripts/browser-fixture.mts'), directory], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      assert.equal(generated.stderr, '');
      const path = join(directory, 'browser.sqlite'); const before = await sourceDigest(path);
      const names = (await readdir(directory)).sort();
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      try {
        for (const permission of [0o644, 0o444]) {
          await chmod(path, permission);
          const uri = vscode.Uri.file(path);
          await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
          const document = api.sqliteEditor.getDocument(uri); assert.ok(document);
          await waitBrowser(document, (status) => painted(status) && status.editorReady === true);
          const opened = document.session.state.opened; assert.ok(opened);
          assert.equal(opened.engine, fallback ? 'sql.js' : 'node:sqlite');
          const page = await browserAction(document, 'select', (status) => painted(status) && status.table === 'b pages', 'b pages');
          assert.equal(page.cachedRows, 100);
          assert.equal((await browserAction(document, 'next', (status) => painted(status) && status.offset === 100)).firstRow[0]?.text, '101');
          assert.equal((await browserAction(document, 'select', (status) => painted(status) && status.table === 'd view', 'd view')).firstRow[0]?.text, '1');
          const wide = await browserAction(document, 'select', (status) => painted(status) && status.table === 'f wide', 'f wide');
          assert.equal(wide.columns, 1000); assert.ok(wide.renderedColumns < 40);
          const large = await runSql(document, 'SELECT length(value) AS n FROM "e large cells"');
          assert.equal(large.firstRow[0]?.text, '1100000');
          const exact = await runSql(document, 'SELECT maximum, minimum, nullable, empty, literal, bytes FROM "a values"');
          assert.deepEqual(exact.firstRow.slice(0, 3).map((cell) => cell.text), ['9223372036854775807', '-9223372036854775808', 'NULL']);
          for (const sql of ['UPDATE "b pages" SET value=\'changed\'', 'WITH n(x) AS (VALUES(1)) DELETE FROM "b pages" WHERE id IN (SELECT x FROM n)', 'PRAGMA user_version=7', 'VACUUM', 'ATTACH DATABASE \':memory:\' AS other']) {
            assert.match((await runSql(document, sql)).message, /read.only|readonly/iu);
          }
          const slow = 'WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n';
          await startSql(document, slow);
          await browserAction(document, 'cancel', (status) => !status.busy && /cancelled/u.test(status.message));
          assert.equal((await runSql(document, 'SELECT count(*) AS n FROM "b pages"')).firstRow[0]?.text, '201');
          await closeEditor(document);
          assert.deepEqual(await sourceDigest(path), before);
          // Reopen to obtain the current helper after cancellation, then kill it.
          await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
          const crashing = api.sqliteEditor.getDocument(uri); assert.ok(crashing);
          await waitBrowser(crashing, (status) => painted(status) && status.editorReady === true);
          const helper = crashing.session.state.opened; assert.ok(helper);
          await startSql(crashing, slow); process.kill(helper.processId, 'SIGKILL');
          await waitBrowser(crashing, (status) => !status.busy && /helper|reopen/iu.test(status.message));
          await closeEditor(crashing);
          await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
          const recovered = api.sqliteEditor.getDocument(uri); assert.ok(recovered);
          await waitBrowser(recovered, (status) => painted(status) && status.editorReady === true);
          assert.equal((await runSql(recovered, 'SELECT count(*) AS n FROM "b pages"')).firstRow[0]?.text, '201');
          await closeEditor(recovered);
          assert.deepEqual(await sourceDigest(path), before);
          assert.deepEqual((await readdir(directory)).sort(), names);
        }
        console.log(`T-016 safety evidence: ${JSON.stringify({ engine: fallback ? 'sql.js' : 'node:sqlite', ...before, writableAndReadOnly: true, writesRefused: true, cancelledAndCrashRecovered: true, unchanged: true })}`);
      } finally {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        restoreFallback(previous); await chmod(path, 0o644); await rm(directory, { recursive: true, force: true });
      }
    });
  }

  test('NFR-001: Given an idle external WAL writer, When native reads committed WAL rows and fallback refuses the snapshot, Then database and WAL bytes stay unchanged with only approved SHM reader coordination', async function () {
    this.timeout(30000);
    const { extension, api } = await editorApi();
    const directory = await mkdtemp(join(extension.extensionPath, 'out', 't016-wal-'));
    const path = join(directory, 'live.sqlite');
    const writer = spawn(process.execPath, [join(extension.extensionPath, 'scripts/sqlite-safety-fixture.mts'), path], { windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let diagnostics = ''; writer.stderr.on('data', (chunk: Buffer) => { diagnostics += chunk.toString(); });
    const closed = new Promise<void>((resolve, reject) => { writer.once('error', reject); writer.once('close', (code) => { if (code === 0) { resolve(); } else { reject(new Error('WAL fixture process failed.')); } }); });
    const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK'];
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { reject(new Error('WAL fixture readiness deadline.')); }, 10000);
        writer.stdout.once('data', (chunk: Buffer) => { clearTimeout(timer); if (chunk.toString() === 'ready\n') { resolve(); } else { reject(new Error('Invalid WAL fixture readiness.')); } });
        writer.once('error', (error) => { clearTimeout(timer); reject(error); });
      });
      const names = (await readdir(directory)).sort(); assert.deepEqual(names, ['live.sqlite', 'live.sqlite-shm', 'live.sqlite-wal']);
      const before = await Promise.all(names.map((name) => sourceDigest(join(directory, name))));
      const initialShm = await readFile(`${path}-shm`);
      for (const fallback of [false, true]) {
        const shmBeforeOpen = await readFile(`${path}-shm`);
        process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
        const uri = vscode.Uri.file(path);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'lite-voyager.sqlite', { preview: false });
        const document = api.sqliteEditor.getDocument(uri); assert.ok(document);
        if (fallback) {
          assert.equal(document.session.state.phase, 'error'); assert.match(document.session.state.message, /WAL.*source files are not modified/u);
          await document.session.closed;
        } else {
          await waitBrowser(document, (status) => painted(status) && status.editorReady === true);
          assert.equal((await runSql(document, 'SELECT value FROM records')).firstRow[0]?.text, 'committed WAL row');
        }
        await closeEditor(document);
        assert.deepEqual((await readdir(directory)).sort(), names);
        const after = await Promise.all(names.map((name) => sourceDigest(join(directory, name))));
        assert.deepEqual(after[0], before[0]); assert.deepEqual(after[2], before[2]);
        const shm = await readFile(`${path}-shm`); assert.equal(shm.length, initialShm.length);
        // SQLite walformat.html: five 32-bit reader marks at offsets 100..119.
        // Native readers may coordinate there; no other byte may change. Never
        // restore coordination bytes, since doing so would interfere with SQLite.
        for (let offset = 0; offset < shm.length; offset++) {
          if (offset < 100 || offset >= 120) { assert.equal(shm[offset], initialShm[offset], `Unexpected SHM change at byte ${String(offset)}`); }
        }
        if (fallback) { assert.deepEqual(shm, shmBeforeOpen); }
      }
      console.log('T-016 WAL evidence: native committed row visible; database/WAL byte-identical; SHM changes restricted to reader marks; fallback refuses live WAL.');
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors'); restoreFallback(previous);
      writer.stdin.end(); await closed; assert.equal(diagnostics, ''); await rm(directory, { recursive: true, force: true });
    }
  });
});
