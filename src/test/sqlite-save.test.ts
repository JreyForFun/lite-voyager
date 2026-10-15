import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { CsvImportController, type CsvImportSession } from '../editor/csv-import';
import { EngineClient } from '../engine/engine-client';

function wait(session: CsvImportSession, predicate: () => boolean): Promise<void> {
  if (predicate()) { return Promise.resolve(); }
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => { remove(); reject(new Error(`SQLite save DOM deadline: ${JSON.stringify(session.saveState)}, ${JSON.stringify(session.saveDom)}`)); }, 15000);
    const remove = session.onStatus(() => { if (predicate()) { clearTimeout(timer); remove(); accept(); } });
  });
}
async function click(session: CsvImportSession, action: 'save' | 'cancel'): Promise<void> {
  assert.equal(await session.panel.webview.postMessage({ type: 'sqliteSaveExercise', action }), true);
}

suite('T-022 temporary storage and complete SQLite save', () => {
  for (const fallback of [false, true]) {
    test(`FR-007: Given a real imported browser with fallback=${String(fallback)}, When saving and cancelling from DOM buttons, Then the complete SQLite file survives session cleanup and source safety holds`, async function () {
      this.timeout(45000);
      const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension); await extension.activate();
      assert.ok((await vscode.commands.getCommands()).includes('lite-voyager.saveAsSqlite'));
      const directory = await mkdtemp(join(extension.extensionPath, 'out', 't022-host-')); const source = join(directory, 'source.csv'); const output = join(directory, 'saved.sqlite');
      const storageRoot = join(directory, 'storage'); const controller = new CsvImportController(extension.extensionPath, storageRoot);
      const previous = process.env['LITE_VOYAGER_FORCE_FALLBACK']; process.env['LITE_VOYAGER_FORCE_FALLBACK'] = fallback ? '1' : '0';
      const contents = `id,"select 😀",empty\n${Array.from({ length: 250 }, (_, i) => `${String(9007199254740993n + BigInt(i))},"quote""line\n${String(i)}",${i === 1 ? 'NULL' : ''}`).join('\n')}\n`;
      let session: CsvImportSession | undefined;
      try {
        await writeFile(source, contents); session = await controller.open(vscode.Uri.file(source)); assert.ok(session); const current = session;
        await session.finished; assert.equal(session.state.phase, 'ready'); await session.startImport(); assert.equal(session.state.phase, 'opened');
        await wait(session, () => current.saveDom?.phase === 'idle' && current.browserStatus?.busy === false);
        assert.equal(session.saveDom?.saveDisabled, false); assert.equal(session.saveDom.cancelDisabled, true);
        const owned = await readdir(storageRoot); assert.equal(owned.length, 1);
        const ownerFiles = await readdir(join(storageRoot, owned[0]!)); assert.ok(ownerFiles.some((name) => /^\.helper-\d+$/u.test(name)));
        // A one-row SQL result must not restrict Save as SQLite to that query/page.
        await session.panel.webview.postMessage({ type: 'browserExercise', action: 'sql', value: 'SELECT 1 AS only_visible' });
        await wait(session, () => current.browserStatus?.sqlLength === 'SELECT 1 AS only_visible'.length);
        await session.panel.webview.postMessage({ type: 'browserExercise', action: 'run' });
        await wait(session, () => current.browserStatus?.query === true && current.browserStatus.busy === false);
        session.configureSqliteSave(() => Promise.resolve(output)); await click(session, 'save');
        await wait(session, () => current.saveDom?.phase === 'saved'); assert.equal(session.saveDom?.saveDisabled, false); assert.equal(session.state.phase, 'opened');
        assert.ok(session.saveState.message.includes('Saved complete SQLite'));
        // Actionable protected-source failure is rendered by the real webview.
        session.configureSqliteSave(() => Promise.resolve(source)); await click(session, 'save');
        await wait(session, () => current.saveDom?.phase === 'error'); assert.match(session.saveState.message, /source/iu);
        const moved = join(directory, 'moved.csv'); const alias = join(directory, 'alias.csv');
        await rename(source, moved); await link(moved, alias); await writeFile(source, 'external replacement');
        for (const protectedAlias of [moved, alias]) {
          const before = session.saveState;
          session.configureSqliteSave(() => Promise.resolve(protectedAlias), () => Promise.resolve(true)); await click(session, 'save');
          await wait(session, () => current.saveState !== before && current.saveState.phase === 'error' && current.saveDom?.phase === 'error');
          assert.equal(await readFile(protectedAlias, 'utf8'), contents);
        }
        await rm(source); session.configureSqliteSave(() => Promise.resolve(join(directory, 'recovered.sqlite'))); await click(session, 'save');
        await wait(session, () => current.saveState.phase === 'saved' && current.saveDom?.phase === 'saved');
        assert.deepEqual(await readFile(join(directory, 'recovered.sqlite')), await readFile(output));
        await rm(alias); await rename(moved, source);
        let answer: ((path: string) => void) | undefined;
        session.configureSqliteSave(() => new Promise<string>((accept) => { answer = accept; })); await click(session, 'save');
        await wait(session, () => current.saveDom?.phase === 'choosing'); assert.equal(session.saveDom?.saveDisabled, true); assert.equal(session.saveDom.cancelDisabled, false);
        await click(session, 'cancel'); await wait(session, () => current.saveDom?.phase === 'cancelled');
        assert.ok(answer); answer(join(directory, 'late.sqlite'));
        const helperPid = session.browserProcessId; assert.ok(helperPid);
        session.panel.dispose(); await session.closed; assert.deepEqual(await readdir(storageRoot), []);
        assert.throws(() => process.kill(helperPid, 0));
        const client = new EngineClient({ directory: join(extension.extensionPath, 'dist'), forceFallback: fallback });
        try {
          await client.open(output);
          assert.deepEqual((await client.query('SELECT count(*) FROM records')).rows, [['250']]);
          assert.deepEqual((await client.query('SELECT id,"select 😀",empty FROM records WHERE rowid=2')).rows, [['9007199254740994', 'quote"line\n1', 'NULL']]);
        } finally { await client.close(); }
        assert.equal(await readFile(source, 'utf8'), contents); assert.deepEqual((await readdir(directory)).sort(), ['recovered.sqlite', 'saved.sqlite', 'source.csv', 'storage']);
        process.stdout.write(`T-022 fallback=${String(fallback)}: real Save/cancel/error DOM, all 250 rows after cleanup, helper exit and unchanged source PASS.\n`);
      } finally {
        if (previous === undefined) { delete process.env['LITE_VOYAGER_FORCE_FALLBACK']; } else { process.env['LITE_VOYAGER_FORCE_FALLBACK'] = previous; }
        session?.panel.dispose(); await session?.closed; controller.dispose(); await rm(directory, { recursive: true, force: true });
      }
    });
  }
  test('FR-007: Given abandoned and live storage at startup, When the real controller initializes, Then only the exited owner directory is removed', async function () {
    this.timeout(15000);
    const extension = vscode.extensions.getExtension('jreyinnovarev.lite-voyager'); assert.ok(extension);
    const directory = await mkdtemp(join(extension.extensionPath, 'out', 't022-startup-'));
    const child = await promisify(execFile)(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
    const pid = Number(child.stdout); assert.ok(Number.isSafeInteger(pid) && pid > 0); assert.throws(() => process.kill(pid, 0));
    const orphan = `session-v1-${String(pid)}-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
    const live = `session-v1-${String(process.pid)}-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`;
    for (const name of [orphan, live, 'unknown']) { await mkdir(join(directory, name)); await writeFile(join(directory, name, 'table.sqlite'), 'owned or keep'); }
    const controller = new CsvImportController(extension.extensionPath, directory);
    try { await controller.ready; assert.deepEqual((await readdir(directory)).sort(), [live, 'unknown'].sort()); }
    finally { controller.dispose(); await rm(directory, { recursive: true, force: true }); }
  });
});
