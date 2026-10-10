import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { EngineClient } from '../engine/engine-client';

suite('T-011 production metadata in the extension host', () => {
  for (const fallback of [false, true]) {
    test(`FR-003: Given the real host and fallback=${String(fallback)}, When inspecting columns and indexes, Then paged metadata runs off-thread and source bytes remain unchanged`, async function () {
      this.timeout(15000);
      const extension = vscode.extensions.getExtension<unknown>('jreyinnovarev.lite-voyager');
      assert.ok(extension);
      await extension.activate();
      const directory = await mkdtemp(join(extension.extensionPath, 'out', 't011-host-'));
      const path = join(directory, 'source.sqlite');
      await copyFile(join(extension.extensionPath, 'test/fixtures/sample.sqlite'), path);
      const digest = async (): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');
      const before = await digest();
      const engine = new EngineClient({ directory: join(extension.extensionPath, 'dist'), forceFallback: fallback });
      try {
        const opened = await engine.open(path);
        assert.equal(opened.engine, fallback ? 'sql.js' : 'node:sqlite');
        assert.ok(opened.threadId > 0);
        assert.notEqual(opened.processId, process.pid);
        const first = await engine.columns('records', { limit: 1 });
        assert.deepEqual(first.rows, [['0', 'id', 'INTEGER', '0', null, '1', '0']]);
        assert.equal(first.hasMore, true);
        assert.deepEqual((await engine.columns('records', { offset: 1 })).rows, [
          ['1', 'label', 'TEXT', '1', "'default'", '0', '0'], ['2', 'payload', 'BLOB', '0', null, '0', '0'],
        ]);
        const indexes = await engine.indexes('records');
        assert.equal(indexes.rows[0]?.[0], 'records_label_idx');
        assert.deepEqual((await engine.indexColumns('records', 'records_label_idx')).rows, [
          ['0', '1', 'label', '0', 'BINARY', '1'], ['1', '-1', null, '0', 'BINARY', '0'],
        ]);
        assert.equal((await engine.columns('record_labels')).rows.length, 2);
        assert.deepEqual((await engine.indexes('record_labels')).rows, []);
        assert.deepEqual((await engine.columns('select')).rows.map((row) => row[1]), ['first name', 'quote"name', '😀', 'order']);
        const primary = (await engine.indexes('composite')).rows.find((row) => row[2] === 'pk');
        assert.ok(primary?.[0]);
        assert.deepEqual((await engine.indexColumns('composite', primary[0])).rows.slice(0, 2).map((row) => row[2]), ['region', 'code']);
        await assert.rejects(engine.query('UPDATE records SET label = ?'), /read-only/);
        await engine.cancel();
        assert.equal((await engine.columns('records')).rows.length, 3);
        await engine.close();
        assert.equal(await digest(), before);
        assert.deepEqual(await readdir(directory), ['source.sqlite']);
        console.log(`T-011 metadata evidence: ${JSON.stringify({ vscode: vscode.version, engine: opened.engine, threadId: opened.threadId, sourceUnchanged: true })}`);
      } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
    });

    test(`FR-003: Given the real host and fallback=${String(fallback)}, When schema requests fail, Then errors are actionable and the worker still serves valid metadata`, async function () {
      this.timeout(15000);
      const extension = vscode.extensions.getExtension<unknown>('jreyinnovarev.lite-voyager');
      assert.ok(extension);
      const engine = new EngineClient({ directory: join(extension.extensionPath, 'dist'), forceFallback: fallback });
      try {
        await engine.open(join(extension.extensionPath, 'test/fixtures/sample.sqlite'));
        await assert.rejects(engine.columns("records'); DROP TABLE records; --"), /schema object was not found/);
        await assert.rejects(engine.indexColumns('records', 'missing'), /index was not found/);
        await assert.rejects(engine.indexes('records', { limit: 0 }), /Invalid page/);
        assert.equal((await engine.columns('records')).rows.length, 3);
      } finally { await engine.close(); }
    });
  }
});
