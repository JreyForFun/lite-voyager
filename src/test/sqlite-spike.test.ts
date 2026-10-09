import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import * as vscode from 'vscode';
import { SqliteSpike } from '../worker/sqlite-spike';

suite('T-002 extension-host worker spike', () => {
  for (const simulateUnavailable of [false, true]) {
    test(`NFR-001: Given a live WAL database and missing built-in=${String(simulateUnavailable)}, When opened, Then complete native reads or explicit fallback rejection preserve its bytes`, async function () {
      this.timeout(15000);
      const extension = vscode.extensions.getExtension<unknown>('jreyinnovarev.lite-voyager');
      assert.ok(extension);
      const root = extension.extensionPath;
      const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-host-wal-'));
      const path = join(directory, 'source.sqlite');
      const writer = new DatabaseSync(path);
      const spike = new SqliteSpike(join(root, 'dist/sqlite-spike-worker.js'), { fallbackDirectory: join(root, 'dist'), simulateUnavailable });
      const hash = async (file: string): Promise<string> => createHash('sha256').update(await readFile(file)).digest('hex');
      try {
        writer.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE records(value); INSERT INTO records VALUES(1); PRAGMA wal_checkpoint(TRUNCATE); INSERT INTO records VALUES(2);');
        assert.ok((await readFile(`${path}-wal`)).length > 0);
        const before = [await hash(path), await hash(`${path}-wal`)];
        if (simulateUnavailable) {
          await assert.rejects(spike.open(path), /WAL/);
          await spike.open(join(root, 'test/fixtures/sample.sqlite'));
          assert.deepEqual((await spike.query('SELECT 1')).rows, [['1']]);
        } else {
          await spike.open(path);
          assert.deepEqual((await spike.query('SELECT value FROM records ORDER BY value')).rows, [['1'], ['2']]);
        }
        await spike.close();
        assert.deepEqual([await hash(path), await hash(`${path}-wal`)], before);
      } finally { await spike.close(); writer.close(); await rm(directory, { recursive: true, force: true }); }
    });

    test(`FR-015: Given the extension host and missing built-in=${String(simulateUnavailable)}, When a worker queries and cancels, Then the real engine recovers`, async function () {
      this.timeout(15000);
      const extension = vscode.extensions.getExtension<unknown>('jreyinnovarev.lite-voyager');
      assert.ok(extension);
      await extension.activate();
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('lite-voyager.sqliteSpike'));
      assert.ok(commands.includes('lite-voyager.sqliteSpikeFallback'));
      const root = extension.extensionPath;
      const fixture = join(root, 'test/fixtures/sample.sqlite');
      const bytes = await readFile(fixture);
      const hash = (value: Buffer): string => createHash('sha256').update(value).digest('hex');
      const spike = new SqliteSpike(join(root, 'dist/sqlite-spike-worker.js'), {
        fallbackDirectory: join(root, 'dist'), simulateUnavailable,
      });
      try {
        const opened = await spike.open(fixture);
        assert.equal(opened.engine, simulateUnavailable ? 'sql.js' : 'node:sqlite');
        assert.ok(opened.threadId > 0);
        assert.notEqual(opened.processId, process.pid);
        assert.equal(opened.trustedSchemaOff, true);
        assert.equal(opened.extensionLoadingDisabled, true);
        assert.deepEqual((await spike.query('SELECT integer_value FROM fidelity ORDER BY rowid')).rows,
          [['9223372036854775807'], ['-9223372036854775808'], ['9007199254740993']]);
        let started!: () => void;
        const running = new Promise<void>((resolveStarted) => { started = resolveStarted; });
        const query = spike.query('WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<20000000) SELECT sum(x) FROM n', [], started);
        const rejected = assert.rejects(query, /cancelled/);
        await running;
        await new Promise<void>((resolveTick) => setTimeout(resolveTick, 150));
        const cancelStarted = Date.now();
        await spike.cancel();
        await rejected;
        const cancelMs = Date.now() - cancelStarted;
        console.log(`T-002 cancellation evidence: ${JSON.stringify({ vscode: vscode.version, platform: process.platform, arch: process.arch, ...opened, cancelMs })}`);
        assert.ok(cancelMs < 1000, `Cancelling an executing query took ${String(cancelMs)} ms; the spike expects less than 1000 ms.`);
        assert.throws(() => process.kill(opened.processId, 0), 'The helper must have exited before cancellation reports success.');
        await spike.open(fixture);
        assert.deepEqual((await spike.query('SELECT 42')).rows, [['42']]);
        assert.equal(hash(await readFile(fixture)), hash(bytes));
        console.log(`T-002 evidence: ${JSON.stringify({ vscode: vscode.version, platform: process.platform, arch: process.arch, ...opened, cancelled: true, reopened: true, sourceUnchanged: true })}`);
      } finally { await spike.close(); }
    });
  }
});
