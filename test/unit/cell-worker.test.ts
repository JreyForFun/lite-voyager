import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { expect, test, vi } from 'vitest';
import { CellService } from '../../src/editor/cell-service';
import type { CellResponse } from '../../src/protocol';

test('FR-018: Given the bundled transform worker, When preparing large exact JSON and TSV off-thread, Then clipboard writes follow successful preparation and worker exit is recoverable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-cell-worker-'));
  const replies: CellResponse[] = []; const copied: string[] = []; const workers: Worker[] = [];
  const contextId = '12345678-1234-1234-1234-123456789abc';
  const service = new CellService(directory, (text) => { copied.push(text); return Promise.resolve(); }, (reply) => { replies.push(reply); }, (path) => {
    const worker = new Worker(path); workers.push(worker); expect(worker.threadId).toBeGreaterThan(0); return worker;
  });
  try {
    const result = await build({ entryPoints: [resolve('src/worker/cell-worker.ts')], outfile: join(directory, 'cell-worker.js'), bundle: true, platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent' });
    expect(result.warnings).toEqual([]);
    const raw = '{"n":9223372036854775807,"text":"' + 'x'.repeat(1100000) + '"}';
    let timerRan = false; setTimeout(() => { timerRan = true; }, 0);
    service.handle({ type: 'cellDetails', contextId, id: 1, value: raw });
    await vi.waitFor(() => { expect(replies.at(-1)?.type).toBe('cellDetailsResult'); }, { timeout: 10000 });
    expect(timerRan).toBe(true);
    const details = replies.at(-1); expect(details?.type === 'cellDetailsResult' ? details.detail.text : '').toBe('{\n  "n": 9223372036854775807,\n  "text": "' + 'x'.repeat(1100000) + '"\n}');
    service.handle({ type: 'cellCopy', contextId, id: 2, rows: [[null, raw, '[BLOB 24 bytes]']] });
    await vi.waitFor(() => { expect(replies.at(-1)?.type).toBe('cellCopyResult'); }, { timeout: 10000 });
    expect(copied).toEqual(['\\N\t"' + raw.replaceAll('"', '""') + '"\t[BLOB 24 bytes]']);
    await workers[0]?.terminate();
    service.handle({ type: 'cellDetails', contextId, id: 3, value: '{"recovered":true}' });
    await vi.waitFor(() => { expect(replies.at(-1)).toMatchObject({ type: 'cellDetailsResult', id: 3 }); }, { timeout: 10000 });
    expect(workers).toHaveLength(3);
  } finally {
    service.dispose(); await Promise.all(workers.map((worker) => worker.terminate()));
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
