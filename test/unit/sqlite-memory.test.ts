import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { parseProcessJson, parseProcessTable, parseMemorySample, memorySample, checkMemoryRun, checkMemoryComparison, type MemorySample } from '../../src/test/sqlite-memory-support';
import { TestBudget } from '../../src/test/sqlite-budget';
import { sourceDigest } from '../../src/test/sqlite-exercise';
import { createHash } from 'node:crypto';
import { digestChunks } from '../../src/test/sqlite-digest';
import { observeProcessLines } from '../../src/test/sqlite-memory-observer';

test('NFR-003: Given a cold observer that starts slower than its sampling interval, When snapshots begin, Then startup completes separately and every later snapshot still meets the unchanged deadline', async () => {
  const abort = new AbortController(); const seen: number[] = []; let observerPid = 0;
  const code = 'setTimeout(() => { console.log(JSON.stringify({n:1,pid:process.pid})); setInterval(() => console.log(JSON.stringify({n:2,pid:process.pid})), 20); }, 500)';
  await observeProcessLines(process.execPath, ['-e', code], (line) => {
    const row: unknown = JSON.parse(line); expect(row).toHaveProperty('n');
    if (typeof row === 'object' && row !== null && 'pid' in row && typeof row.pid === 'number') { observerPid = row.pid; }
    seen.push(performance.now());
    if (seen.length === 4) { abort.abort(); }
  }, abort.signal, 3000, 250);
  expect(seen).toHaveLength(4);
  expect(observerPid).toBeGreaterThan(0); expect(() => process.kill(observerPid, 0)).toThrow();
  await expect(observeProcessLines(process.execPath, ['-e', 'console.log("first"); setInterval(() => {}, 1000)'], () => {}, new AbortController().signal, 3000, 100))
    .rejects.toThrow(/snapshot.*100 ms/);
  await expect(observeProcessLines(process.execPath, ['-e', 'console.error("unexpected diagnostic"); setInterval(() => {}, 1000)'], () => {}, new AbortController().signal, 3000, 100))
    .rejects.toThrow(/unexpected diagnostic/);
  await expect(observeProcessLines(process.execPath, ['-e', 'console.log("first")'], () => {}, new AbortController().signal, 3000, 100))
    .rejects.toThrow(/stopped unexpectedly/);
  await expect(observeProcessLines(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], () => {}, new AbortController().signal, 100, 100))
    .rejects.toThrow(/startup.*100 ms/);
}, 10000);

test('NFR-003: Given a many-chunk source hash, When reading outside the measured workload, Then one fixed buffer is reused instead of retaining size-dependent chunk allocations in the extension host', async () => {
  const buffers = new Set<Buffer>(); const expected = createHash('sha256'); let remaining = 12 * 1024 * 1024 + 7;
  const result = await digestChunks((buffer) => {
    buffers.add(buffer); expect(buffer.length).toBe(1024 * 1024);
    const count = Math.min(buffer.length, remaining); buffer.fill(97, 0, count); remaining -= count;
    expected.update(buffer.subarray(0, count)); return Promise.resolve(count);
  });
  expect(result).toEqual({ bytes: 12 * 1024 * 1024 + 7, sha256: expected.digest('hex') });
  expect(buffers.size).toBe(1);
  const abort = new AbortController(); let reads = 0;
  await expect(digestChunks(() => { reads++; abort.abort(); return Promise.resolve(1); }, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(reads).toBe(1);
});

test('NFR-003: Given a running fixture child, When the internal test budget expires, Then abort closes the child and cleanup completes before the outer test deadline', async () => {
  const budget = new TestBudget(100);
  const started = performance.now();
  let cleaned = false;
  const execution = promisify(execFile)(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { signal: budget.signal });
  const child = execution.child;
  const closed = new Promise<void>((resolve) => { child.once('close', () => { resolve(); }); });
  try { await expect(execution).rejects.toMatchObject({ name: 'AbortError' }); }
  finally { await closed; budget.dispose(); cleaned = true; }
  expect(cleaned).toBe(true); expect(budget.signal.aborted).toBe(true);
  expect(() => budget.remaining(1000)).toThrow(/budget/);
  expect(performance.now() - started).toBeLessThan(1000);
  const pid = child.pid; expect(pid).toBeDefined();
  if (pid !== undefined) { expect(() => process.kill(pid, 0)).toThrow(); }
}, 3000);

test('NFR-001: Given multiple hash chunks and a final partial chunk, When streamed or cancelled, Then the full byte count and final-byte changes are detected and abort stops the read', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t016-hash-'));
  try {
    const path = join(directory, 'bytes'); const bytes = Buffer.alloc(3 * 1024 * 1024 + 7, 97);
    await writeFile(path, bytes);
    const before = await sourceDigest(path);
    expect(before).toEqual({ bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    const file = await open(path, 'r+');
    try { await file.write(Buffer.from([98]), 0, 1, bytes.length - 1); } finally { await file.close(); }
    const after = await sourceDigest(path); expect(after.bytes).toBe(before.bytes); expect(after.sha256).not.toBe(before.sha256);
    const cancelled = new AbortController(); cancelled.abort();
    await expect(sourceDigest(path, cancelled.signal)).rejects.toMatchObject({ name: 'AbortError' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const rows = [
  { pid: 10, parent: 1, rss: 100_000_000, command: 'Code main' },
  { pid: 20, parent: 10, rss: 200_000_000, command: 'Code extensionHost' },
  { pid: 30, parent: 20, rss: 60_000_000, command: 'Code "C:\\project\\dist\\db-process.js"' },
  { pid: 40, parent: 10, rss: 300_000_000, command: 'Code --type=renderer' },
  { pid: 50, parent: 20, rss: 800_000_000, command: 'powershell observer' },
  { pid: 60, parent: 1, rss: 900_000_000, command: 'Code /other/dist/db-process.js' },
];
const sample = (at: number): MemorySample => memorySample(rows, 20, at);
const samples = Array.from({ length: 6 }, (_value, index) => sample(index * 200));

test('NFR-003: Given OS process snapshots, When parsed and attributed, Then byte units, all helpers and separate renderers are exact without counting observers or other hosts', () => {
  expect(parseProcessTable('20 10 195312 Code extensionHost\n30 20 58593 Code /dist/db-process.js\n')[0]?.rss).toBe(195312 * 1024);
  expect(parseProcessJson(JSON.stringify(rows))).toEqual(rows);
  const idle = { pid: 0, parent: 0, rss: 0, command: '' };
  expect(parseProcessJson(JSON.stringify([idle, ...rows]))).toEqual([idle, ...rows]);
  expect(sample(0)).toMatchObject({ hostBytes: 200_000_000, helperBytes: 60_000_000, rendererBytes: 300_000_000, helperIds: [30], rendererIds: [40] });
  expect(memorySample([...rows, { pid: 31, parent: 20, rss: 10_000_000, command: 'Code /dist/db-process.js' }], 20, 0).helperBytes).toBe(70_000_000);
  for (const invalid of ['20 10 bad Code', '20 10 -1 Code', '20 10 1.2 Code']) { expect(() => parseProcessTable(invalid)).toThrow(); }
  for (const invalid of ['{}', '[{}]', '[{"pid":20,"parent":10,"rss":"42","command":"Code"}]']) { expect(() => parseProcessJson(invalid)).toThrow(); }
  expect(() => memorySample(rows.filter((row) => row.pid !== 20), 20, 0)).toThrow(/host/);
  expect(() => memorySample(rows.filter((row) => row.pid !== 40), 20, 0)).toThrow(/renderer/);
  expect(parseMemorySample(JSON.stringify(sample(0)))).toEqual(sample(0));
  for (const incomplete of [{}, { ...sample(0), hostBytes: 0 }, { ...sample(0), rendererIds: [] }, { ...sample(0), helperIds: ['30'] }, { ...sample(0), at: -1 }]) {
    expect(() => parseMemorySample(JSON.stringify(incomplete))).toThrow();
  }
});

test('NFR-003: Given complete or fabricated memory evidence, When applying the gate, Then the strict peak, size and paging growth, helper coverage and sampling limits cannot be bypassed', () => {
  const good = checkMemoryRun(samples, 30);
  expect(good).toMatchObject({ peakBytes: 260_000_000, samples: 6, maxGapMs: 200, pagingGrowthBytes: 0 });
  expect(() => checkMemoryRun(samples.slice(0, 4), 30)).toThrow(/samples/);
  expect(() => checkMemoryRun(samples, 99)).toThrow(/helper/);
  expect(() => checkMemoryRun(samples.map((value) => ({ ...value, hostBytes: 440_000_000 })), 30)).toThrow(/500/);
  expect(() => checkMemoryRun(samples.map((value, index) => ({ ...value, hostBytes: index < 3 ? 200_000_000 : 250_000_001 })), 30)).toThrow(/growth/);
  expect(() => checkMemoryRun(samples.map((value, index) => ({ ...value, at: index * 3001 })), 30)).toThrow(/gap/);
  expect(() => checkMemoryRun([...samples].reverse(), 30)).toThrow(/monotonic/);
  expect(() => checkMemoryRun(samples, 30, 900)).toThrow(/settled/);
  checkMemoryComparison(good, { ...good, peakBytes: 310_000_000 });
  expect(() => checkMemoryComparison(good, { ...good, peakBytes: 310_000_001 })).toThrow(/growth/);
});

test('NFR-003: Given a new fixture directory, When generating populated SQLite files, Then exact unsafe integer IDs, row counts and payloads are stored and existing destinations are refused', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t016-fixture-'));
  const output = join(directory, 'data');
  try {
    const args = [resolve('scripts/sqlite-memory-fixture.mts'), output, '--rows', '301'];
    const generated = await promisify(execFile)(process.execPath, args);
    expect(generated.stderr).toBe('');
    const evidence: unknown = JSON.parse(await readFile(join(output, 'generation.json'), 'utf8'));
    expect(evidence).toMatchObject({ rows: 301, payloadBytes: [100, 512] });
    for (const name of ['one-gb.sqlite', 'five-gb.sqlite']) {
      const path = join(output, name); expect((await stat(path)).size).toBeGreaterThan(0);
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        const query = db.prepare('SELECT count(*) AS n, min(id) AS first, max(id) AS last, min(length(payload)) AS payload FROM records');
        query.setReadBigInts(true);
        expect(query.get()).toMatchObject({ n: 301n, first: 9007199254740993n, last: 9007199254741293n, payload: name === 'one-gb.sqlite' ? 100n : 512n });
        expect(db.prepare('PRAGMA integrity_check').get()).toMatchObject({ integrity_check: 'ok' });
      } finally { db.close(); }
    }
    await expect(promisify(execFile)(process.execPath, args)).rejects.toThrow();
    await expect(promisify(execFile)(process.execPath, [args[0] ?? '', join(directory, 'bad'), '--rows', '0'])).rejects.toThrow();
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 15000);
